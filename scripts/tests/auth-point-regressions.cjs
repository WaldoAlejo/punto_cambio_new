const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function fixture(scheduleResult, valid = true) {
  const oldPoint = { id: 'old', nombre: 'Punto anterior' };
  const storage = new Map([['puntoAtencionSeleccionado', JSON.stringify(oldPoint)], ['pc_selected_point_id', 'old']]);
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  const state = [], effects = [], requests = [];
  const user = { id: 'operator', rol: 'OPERADOR', punto_atencion_id: null };
  const mocks = {
    react: { createContext: () => ({ Provider: 'provider' }), useState: value => {
      const i = state.push(value) - 1; return [value, next => { state[i] = next; }];
    }, useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx: (_type, props) => props.value },
    '../services/authService': { authService: {
      verifyToken: async () => ({ valid, user: valid ? user : null }),
      login: async () => ({ user, token: 'dummy-token', error: null }), removeStoredToken() {},
    } },
    '../services/scheduleService': { scheduleService: { getActiveSchedule: async options => {
      requests.push(options); if (scheduleResult instanceof Error) throw scheduleResult; return scheduleResult;
    } } },
    '../services/pointService': { pointService: { getAllPoints: async () => ({ points: [] }) } },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/hooks/useAuth.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'localStorage', 'sessionStorage', 'window', 'console', outputText)(
    name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; }, module, module.exports,
    localStorage, { getItem: () => null }, {}, { error() {} });
  const context = module.exports.AuthProvider({ children: null });
  return { context, state, storage, requests, async initialize() {
    effects.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve));
  } };
}

for (const [name, response] of [
  ['sin jornada', { schedule: null, error: null }],
  ['error de API', { schedule: null, error: 'Sin conexion' }],
  ['excepcion de red', new Error('Sin conexion')],
]) {
  test(`recarga ${name}: nunca recupera el punto almacenado`, async () => {
    const f = fixture(response); await f.initialize();
    assert.equal(f.state[2], null);
    assert.equal(f.storage.has('puntoAtencionSeleccionado'), false);
    assert.deepEqual(f.requests, [{ force: true }]);
  });
}
test('recarga con jornada vigente usa su punto en lugar del almacenado', async () => {
  const point = { id: 'current' };
  const f = fixture({ schedule: { puntoAtencion: point } }); await f.initialize();
  assert.equal(f.state[2], point);
});
test('login sin jornada elimina una seleccion anterior y no consulta cache de otra sesion', async () => {
  const f = fixture({ schedule: null, error: null }, false); await f.initialize();
  f.context.setSelectedPoint({ id: 'another-session' });
  assert.deepEqual(await f.context.login('dummy', 'dummy'), { success: true });
  assert.equal(f.state[2], null);
  assert.equal(f.storage.has('pc_selected_point_id'), false);
  assert.deepEqual(f.requests, [{ force: true }]);
});
test('login con jornada vigente selecciona el punto confirmado', async () => {
  const point = { id: 'current' };
  const f = fixture({ schedule: { puntoAtencion: point } }, false); await f.initialize();
  assert.deepEqual(await f.context.login('dummy', 'dummy'), { success: true });
  assert.equal(f.state[2], point);
});
