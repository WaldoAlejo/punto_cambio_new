// Run: node --test scripts/tests/frontend-regressions.cjs
// Isolated checks: no browser, network, database, or production credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSource(relativePath, mocks = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const isolatedRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency in isolated test: ${name}`);
  };
  new Function('require', 'module', 'exports', outputText)(isolatedRequire, module, module.exports);
  return module.exports;
}

function exchangeHook(point, getExchangesByPoint) {
  const state = [];
  const effects = [];
  const { useExchangeData } = loadSource('src/hooks/useExchangeData.ts', {
    react: {
      useState: (initial) => {
        const index = state.push(initial) - 1;
        return [initial, (value) => { state[index] = value; }];
      },
      useEffect: (effect) => effects.push(effect),
      useCallback: (callback) => callback,
    },
    '../services/currencyService': {
      currencyService: { getAllCurrencies: async () => ({ currencies: [] }) },
    },
    '../services/exchangeService': { exchangeService: { getExchangesByPoint } },
  });
  return { hook: useExchangeData(point), state, effects };
}

test('exchange reload forwards the selected point and date filters and updates history', async () => {
  const calls = [];
  const exchanges = [{ id: 'exchange-1' }];
  const { hook, state } = exchangeHook({ id: 'point-1' }, async (...args) => {
    calls.push(args);
    return { exchanges };
  });
  const range = { from: '2026-09-01', to: '2026-09-13' };
  await hook.reload(range);
  assert.deepEqual(calls, [['point-1', range]]);
  assert.deepEqual(state[1], exchanges);
  assert.equal(state[3], null);
  await hook.reload();
  assert.deepEqual(calls[1], ['point-1', undefined]);
});

test('exchange reload makes no request when no point is selected', async () => {
  const { hook } = exchangeHook(null, async () => {
    assert.fail('No request should be sent without a point');
  });
  await hook.reload();
});

test('opening service preserves differences and incident flags returned by the API', async () => {
  const calls = [];
  const response = {
    success: true,
    apertura: { id: 'opening-1' },
    con_diferencia: true,
    apertura_abierta_con_incidencia: true,
    message: 'Incidencia registrada',
  };
  const { aperturaCajaService } = loadSource('src/services/aperturaCajaService.ts', {
    './apiService': {
      ApiError: class extends Error {},
      apiService: { post: async (...args) => { calls.push(args); return response; } },
    },
  });
  const incident = { motivo: 'Diferencia', detalle: 'Revisar', monedas_afectadas: ['USD'] };
  const result = await aperturaCajaService.confirmarApertura('opening-1', incident);
  assert.deepEqual(calls, [['/apertura-caja/confirmar', {
    apertura_id: 'opening-1', incidencia_apertura: incident,
  }]]);
  assert.equal(result.con_diferencia, true);
  assert.equal(result.apertura_abierta_con_incidencia, true);
  assert.equal(result.error, null);
  response.con_diferencia = false;
  response.apertura_abierta_con_incidencia = false;
  const normal = await aperturaCajaService.confirmarApertura('opening-1');
  assert.equal(normal.con_diferencia, false);
  assert.equal(normal.apertura_abierta_con_incidencia, false);
});

test('Excel rows preserve signed amounts, dates, booleans and nested report details', () => {
  const { toExcelRows } = loadSource('src/utils/exportToExcel.ts', {
    exceljs: {}, 'file-saver': {},
  });
  const date = new Date('2026-09-13T05:00:00Z');
  const row = { monto: -125.35, tasa: 1.234, fecha: date, activo: false,
    vacio: null, ausente: undefined, detalle: { USD: 12 }, monedas: ['USD', 'EUR'] };
  const [result] = toExcelRows([row]);
  assert.equal(result.monto, -125.35);
  assert.equal(result.tasa, 1.234);
  assert.equal(result.fecha, date);
  assert.equal(result.activo, false);
  assert.equal(result.vacio, null);
  assert.equal(result.ausente, undefined);
  assert.deepEqual(JSON.parse(result.detalle), row.detalle);
  assert.deepEqual(JSON.parse(result.monedas), row.monedas);
  assert.deepEqual(row.detalle, { USD: 12 });
});

test('user transformation preserves every supported role', () => {
  const { validateAndTransformUser } = loadSource('src/utils/typeValidation.ts');
  for (const rol of ['SUPER_USUARIO', 'ADMIN', 'OPERADOR', 'CONCESION', 'ADMINISTRATIVO']) {
    const user = validateAndTransformUser({ id: 'user-1', username: 'test', nombre: 'Test',
      rol, activo: true, created_at: '2026-09-13', updated_at: '2026-09-13' });
    assert.equal(user.rol, rol);
  }
});
