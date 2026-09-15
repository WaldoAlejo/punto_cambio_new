// Windows-only isolated integration check. Run: node --import tsx scripts/tests/integration-local.mjs
// Requires the portable runtime documented in docs/PRUEBAS_INTEGRACION_LOCAL.md.
// Creates a NEW temporary PostgreSQL cluster each run. Never reads DATABASE_URL or .env.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const browserMode = process.argv.includes('--browser');
const bin = path.join(root, 'node_modules/.cache/pg-sandbox-runtime/node_modules/@embedded-postgres/windows-x64/native/bin');
await fs.access(path.join(bin, 'initdb.exe'));
const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-integration-'));
const cluster = path.join(runDir, 'postgres');
const password = randomBytes(24).toString('hex');
const passwordFile = path.join(runDir, 'init-password');
const dbName = 'punto_cambio_test';
const port = 55439;
const url = `postgresql://pc_test:${password}@127.0.0.1:${port}/${dbName}`;
// Only explicit environment values reach application modules and Prisma CLI.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(SystemRoot|WINDIR|PATH|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|COMSPEC)$/i.test(key)));
Object.assign(cleanEnv, { NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: randomBytes(32).toString('hex'), TZ: 'America/Guayaquil' });
const command = (file, args) => exec(file, args, {
  cwd: runDir, env: cleanEnv, windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
});
// pg_ctl's child can inherit pipes on Windows: wait for pg_ctl exit, not pipe EOF.
const control = (args) => new Promise((resolve, reject) => {
  const child = spawn(path.join(bin, 'pg_ctl.exe'), args, {
    cwd: runDir, env: cleanEnv, windowsHide: true, stdio: 'ignore',
  });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl exit ${code}`)));
});
let started = false;
let server;
let prisma;
let pool;
const results = [];
const diagnostics = {};
const originalWarn = console.warn;
// Application logs contain synthetic records only, kept outside the repository.
console.warn = (...args) => { void fs.appendFile(path.join(runDir, 'application.log'), args.map(String).join(' ') + '\n'); };
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
try {
  await fs.writeFile(passwordFile, password);
  await command(path.join(bin, 'initdb.exe'), ['-D', cluster, '-U', 'pc_test', '--pwfile', passwordFile,
    '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
  await fs.unlink(passwordFile);
  await control(['-D', cluster, '-l', path.join(runDir, 'postgres.log'),
    '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  const admin = new Client({ connectionString: url.replace(`/${dbName}`, '/postgres') });
  await admin.connect();
  try {
    const identity = await admin.query('SHOW data_directory');
    assert.equal(path.resolve(identity.rows[0].data_directory).toLowerCase(), cluster.toLowerCase());
    await admin.query('CREATE DATABASE punto_cambio_test');
  } finally { await admin.end(); }
  const { stdout: schemaSql } = await command(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'),
    'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script']);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(schemaSql);
    await db.query(await fs.readFile(path.join(root, 'scripts/migrations/2026-09-14-staged-opening.sql'), 'utf8'));
    await db.query(await fs.readFile(path.join(root, 'scripts/migrations/2026-09-14-metal-purchases-checks.sql'), 'utf8'));
  } finally { await db.end(); }
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, cleanEnv);
  process.chdir(runDir); // No .env file in this new temporary directory.
  const { default: express } = await import('express');
  const { default: bcrypt } = await import('bcryptjs');
  prisma = (await import('../../server/lib/prisma.ts')).default;
  pool = (await import('../../server/lib/database.ts')).pool;
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', "connect-src 'self'");
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  for (const [mount, module] of [
    ['/api/auth', '../../server/routes/auth.ts'],
    ['/api/points', '../../server/routes/points.ts'],
    ['/api/reportes/saldos-por-punto', '../../server/routes/reportes-saldos-puntos.ts'],
    ['/api/schedules', '../../server/routes/schedules.ts'],
    ['/api/apertura-caja', '../../server/routes/apertura-caja.ts'],
    ['/api/exchanges', '../../server/routes/exchanges.ts'],
    ['/api/metal-purchases', '../../server/routes/metal-purchases.ts'],
    ['/api/contabilidad-diaria', '../../server/routes/contabilidad-diaria.ts'],
    ['/api/guardar-cierre', '../../server/routes/guardar-cierre.ts'],
    ['/api/cuadre-caja', '../../server/routes/cuadreCaja.ts'],
    ['/api/cuadre-caja', '../../server/routes/cuadre-caja-conteo.ts'],
    ['/api/transfers', '../../server/routes/transfers.ts'],
    ['/api/transfer-approvals', '../../server/routes/transfer-approvals.ts'],
  ]) app.use(mount, (await import(module)).default);
  if (browserMode) {
    for (const [mount, module] of [
      ['/api/users', '../../server/routes/users.ts'],
      ['/api/currencies', '../../server/routes/currencies.ts'],
      ['/api/admin', '../../server/routes/admin-dashboard.ts'],
    ]) app.use(mount, (await import(module)).default);
    app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Ruta no incluida en esta prueba aislada' }));
    const assets = path.join(root, 'node_modules/.cache/frontend-check');
    await fs.access(path.join(assets, 'index.html'));
    app.use(express.static(assets));
    app.get('*', (_req, res) => res.sendFile(path.join(assets, 'index.html')));
  }
  server = await new Promise((resolve, reject) => {
    const s = app.listen(browserMode ? 4173 : 0, '127.0.0.1', () => resolve(s));
    s.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const point = await prisma.puntoAtencion.create({ data: { nombre: 'PRUEBA LOCAL', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
  const user = await prisma.usuario.create({ data: { username: 'prueba_local', nombre: 'Operador ficticio',
    password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: point.id } });
  const morning = new Date(); morning.setHours(10, 0, 0, 0);
  const jornada = await prisma.jornada.create({ data: { usuario_id: user.id, punto_atencion_id: point.id, fecha_inicio: morning, estado: 'ACTIVO' } });
  const currencies = [];
  for (const codigo of ['USD', 'EUR']) {
    const moneda = await prisma.moneda.create({ data: { codigo, nombre: codigo, simbolo: codigo,
      comportamiento_compra: 'MULTIPLICA', comportamiento_venta: 'DIVIDE' } });
    currencies.push(moneda);
    await prisma.saldo.create({ data: { punto_atencion_id: point.id, moneda_id: moneda.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
    await prisma.saldoInicial.create({ data: { punto_atencion_id: point.id, moneda_id: moneda.id, cantidad_inicial: 1000, asignado_por: user.id } });
  }
  const [usd, eur] = currencies;
  let token;
  async function post(route, body, key, authToken = token) {
    const res = await fetch(base + route, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    return { status: res.status, body: await res.json() };
  }
  function ok(result) { assert.ok(result.status >= 200 && result.status < 300 && result.body.success !== false, JSON.stringify(result)); }
  await check('Login con usuario ficticio', async () => {
    const result = await post('/auth/login', { username: user.username, password: 'PruebaLocal_123!' });
    ok(result); token = result.body.token; assert.ok(token);
  });
  // Explicit evening boundary regression; a failure must not hide the remaining workflow.
  try {
    await check('Jornada 19:30 GYE mantiene punto en autenticacion', async () => {
      const evening = new Date(); evening.setHours(19, 30, 0, 0);
      await prisma.jornada.update({ where: { id: jornada.id }, data: { fecha_inicio: evening } });
      const { gyeDayRangeUtcFromDate } = await import('../../server/utils/timezone.ts');
      const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
      const sql = 'SELECT count(*)::int AS matches FROM "Jornada" WHERE id=$1 AND fecha_inicio >= $2 AND fecha_inicio < $3';
      diagnostics.evening = {
        storedUtc: evening.toISOString(),
        expectedRangeUtc: [gte.toISOString(), lt.toISOString()],
        dateParameters: (await pool.query('SELECT $1::timestamp::text AS start, $2::timestamp::text AS end', [gte, lt])).rows[0],
        matchesWithDate: (await pool.query(sql, [jornada.id, gte, lt])).rows[0].matches,
        matchesWithUtcText: (await pool.query(sql, [jornada.id, gte.toISOString(), lt.toISOString()])).rows[0].matches,
      };
      const res = await fetch(base + '/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      assert.equal(body.user?.punto_atencion_id, point.id, 'La autenticacion ignora el punto pese a existir jornada activa del mismo dia GYE');
    });
  } catch { process.exitCode = 1; }
  finally { await prisma.jornada.update({ where: { id: jornada.id }, data: { fecha_inicio: morning } }); }
  const { gyeDayRangeUtcFromDate } = await import('../../server/utils/timezone.ts');
  const { gte: dayStart, lt: dayEnd } = gyeDayRangeUtcFromDate(new Date());
  for (const [name, date, state, expectedPoint] of [
    ['Instante anterior al dia GYE excluido', new Date(dayStart.getTime() - 1), 'ACTIVO', null],
    ['Medianoche inicial GYE incluida', dayStart, 'ACTIVO', point.id],
    ['Ultimo milisegundo del dia GYE incluido', new Date(dayEnd.getTime() - 1), 'ACTIVO', point.id],
    ['Medianoche del dia siguiente excluida', dayEnd, 'ACTIVO', null],
    ['Jornada en almuerzo reconocida', morning, 'ALMUERZO', point.id],
    ['Jornada completada no habilita punto', morning, 'COMPLETADO', null],
    ['Jornada cancelada no habilita punto', morning, 'CANCELADO', null],
  ]) {
    try {
      await check(name, async () => {
        await prisma.jornada.update({ where: { id: jornada.id }, data: { fecha_inicio: date, estado: state } });
        const res = await fetch(base + '/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.user?.punto_atencion_id, expectedPoint);
        // The middleware may normalize the request, but must never mutate stored assignments.
        assert.equal((await prisma.usuario.findUnique({ where: { id: user.id } })).punto_atencion_id, point.id);
        assert.equal((await prisma.jornada.findUnique({ where: { id: jornada.id } })).fecha_inicio.toISOString(), date.toISOString());
      });
    } catch { process.exitCode = 1; }
  }
  await prisma.jornada.update({ where: { id: jornada.id }, data: { fecha_inicio: morning, estado: 'ACTIVO' } });
  for (const [scenario, state, date, exitDate, active] of [
    ['antigua sin salida', 'ACTIVO', new Date(dayStart.getTime() - 86400000), null, false],
    ['completada sin salida', 'COMPLETADO', morning, null, false],
    ['cancelada sin salida', 'CANCELADO', morning, null, false],
    ['activa', 'ACTIVO', morning, null, true],
    ['almuerzo', 'ALMUERZO', morning, null, true],
    ['activa con salida', 'ACTIVO', morning, morning, false],
  ]) {
    await check(`Login ${scenario}: informa jornada vigente sin escribir registros`, async () => {
      const u = await prisma.usuario.create({ data: { username: `login_${randomUUID().replaceAll('-', '').slice(0, 16)}`, nombre: 'Operador ficticio login',
        password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: active ? point.id : null } });
      await prisma.jornada.create({ data: { usuario_id: u.id, punto_atencion_id: point.id, fecha_inicio: date, estado: state, fecha_salida: exitDate } });
      const snapshot = async () => JSON.stringify({ user: await prisma.usuario.findUnique({ where: { id: u.id } }),
        schedules: await prisma.jornada.findMany({ where: { usuario_id: u.id } }) });
      const before = await snapshot();
      const response = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' });
      ok(response);
      assert.equal(response.body.hasActiveJornada, active);
      assert.equal(response.body.user.punto_atencion_id, active ? point.id : null);
      assert.equal(await snapshot(), before);
    });
  }
  const exchange = { moneda_origen_id: eur.id, moneda_destino_id: usd.id, monto_origen: 100, monto_destino: 110,
    tasa_cambio_billetes: 1.1, tasa_cambio_monedas: 1.1, tipo_operacion: 'COMPRA', punto_atencion_id: point.id,
    datos_cliente: { nombre: 'Cliente', apellido: 'Ficticio', cedula: '0000000000' },
    divisas_entregadas_billetes: 100, divisas_entregadas_monedas: 0, divisas_entregadas_total: 100,
    divisas_recibidas_billetes: 110, divisas_recibidas_monedas: 0, divisas_recibidas_total: 110,
    metodo_entrega: 'efectivo', metodo_pago_origen: 'EFECTIVO' };
  await check('Cambio bloqueado antes de apertura', async () => {
    const result = await post('/exchanges', exchange);
    assert.equal(result.status, 403, JSON.stringify(result));
    assert.equal(await prisma.cambioDivisa.count(), 0);
  });
  let apertura;
  await check('Iniciar apertura', async () => {
    const result = await post('/apertura-caja/iniciar', { jornada_id: jornada.id });
    ok(result); apertura = result.body.apertura; assert.ok(apertura.id);
  });
  await check('Apertura bloqueada sin conteos obligatorios', async () => {
    const result = await post('/apertura-caja/confirmar', { apertura_id: apertura.id });
    assert.equal(result.status, 400, JSON.stringify(result));
  });
  await check('Guardar conteos USD y EUR y confirmar apertura', async () => {
    ok(await post('/apertura-caja/conteo', { apertura_id: apertura.id, conteos: currencies.map(m => ({
      moneda_id: m.id, billetes: [{ denominacion: 100, cantidad: 10 }], monedas: [], total: 1000,
    })) }));
    const result = await post('/apertura-caja/confirmar', { apertura_id: apertura.id });
    ok(result); assert.equal(result.body.apertura.estado, 'ABIERTA');
  });
  const key = randomUUID();
  await check('Comprar 100 EUR por 110 USD y verificar saldos', async () => {
    ok(await post('/exchanges', exchange, key));
    for (const [moneda, expected] of [[usd, 890], [eur, 1100]]) {
      const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: point.id, moneda_id: moneda.id } } });
      assert.equal(Number(saldo.cantidad), expected);
      assert.equal(Number(saldo.bancos), 25);
    }
  });
  await check('Reintento idempotente no duplica cambio', async () => {
    ok(await post('/exchanges', exchange, key));
    assert.equal(await prisma.cambioDivisa.count(), 1);
  });
  await check('Reporte actualiza bancos teoricos sin pisar el conteo guardado', async () => {
    const getReport = async () => {
      const res = await fetch(base + '/cuadre-caja', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      assert.equal(res.status, 200); const body = await res.json(); assert.equal(body.success, true);
      return body.data;
    };
    const first = await getReport();
    assert.equal(await prisma.cuadreCaja.count({ where: { punto_atencion_id: point.id } }), 1, 'El reporte debe reutilizar el cuadre creado en la apertura');
    ok(await post('/cuadre-caja/conteo-fisico', { cuadre_id: first.cuadre_id, moneda_id: usd.id, billetes: 890, monedas_fisicas: 0, conteo_bancos: 23 }));
    // Simulate a bank balance change after the operator saved the count.
    await prisma.saldo.update({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: point.id, moneda_id: usd.id } }, data: { bancos: 30 } });
    try {
      const report = await getReport();
      const detail = report.detalles.find(d => d.moneda_id === usd.id);
      assert.equal(detail.saldo_cierre, 890);
      assert.equal(detail.bancos_teorico, 30);
      assert.equal(detail.conteo_bancos, 23);
      const stored = await prisma.detalleCuadreCaja.findFirst({ where: { cuadre_id: report.cuadre_id, moneda_id: usd.id } });
      assert.equal(Number(stored.diferencia_bancos), -7);
    } finally {
      await prisma.saldo.update({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: point.id, moneda_id: usd.id } }, data: { bancos: 25 } });
    }
  });
  await check('Cierre exacto conserva saldo y finaliza jornada', async () => {
    const res = await fetch(base + '/cuadre-caja', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    assert.equal(res.status, 200);
    const report = await res.json();
    for (const [m, expected] of [[usd, 890], [eur, 1100]]) {
      const d = report.data.detalles.find(d => d.moneda_id === m.id);
      assert.equal(d.saldo_cierre, expected); assert.equal(d.bancos_teorico, 25);
    }
    ok(await post('/guardar-cierre', { tipo_cierre: 'CERRADO', detalles: [[usd, 890], [eur, 1100]].map(([m, amount]) => ({
      moneda_id: m.id, saldo_apertura: 1000, saldo_cierre: amount, conteo_fisico: amount,
      billetes: amount, monedas: 0, bancos_teorico: 25, conteo_bancos: 25,
    })) }, randomUUID()));
    assert.equal((await prisma.jornada.findUnique({ where: { id: jornada.id } })).estado, 'COMPLETADO');
    assert.equal((await prisma.usuario.findUnique({ where: { id: user.id } })).punto_atencion_id, null);
    for (const [m, expected] of [[usd, 890], [eur, 1100]]) {
      const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: point.id, moneda_id: m.id } } });
      assert.equal(Number(saldo.cantidad), expected); assert.equal(Number(saldo.bancos), 25);
    }
  });
  // Independent points keep discrepancy scenarios separate from the exact-close baseline.
  for (const tipo of ['CERRADO', 'PARCIAL']) {
    const p = await prisma.puntoAtencion.create({ data: { nombre: `PRUEBA ${tipo}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    await prisma.usuario.update({ where: { id: user.id }, data: { punto_atencion_id: p.id } });
    const j = await prisma.jornada.create({ data: { usuario_id: user.id, punto_atencion_id: p.id, fecha_inicio: morning, estado: 'ACTIVO' } });
    for (const m of currencies) {
      await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: user.id } });
    }
    const initiated = await post('/apertura-caja/iniciar', { jornada_id: j.id });
    ok(initiated);
    const aid = initiated.body.apertura.id;
    ok(await post('/apertura-caja/conteo', { apertura_id: aid, conteos: currencies.map(m => ({
      moneda_id: m.id, billetes: [{ denominacion: 100, cantidad: m.id === usd.id ? 9 : 10 }], monedas: [], total: m.id === usd.id ? 900 : 1000,
    })) }));
    await check(`${tipo}: apertura descuadrada exige incidencia`, async () => {
      assert.equal((await post('/apertura-caja/confirmar', { apertura_id: aid })).status, 400);
      assert.notEqual((await prisma.aperturaCaja.findUnique({ where: { id: aid } })).estado, 'ABIERTA');
    });
    await check(`${tipo}: apertura con incidencia conserva saldos y requiere revision`, async () => {
      const result = await post('/apertura-caja/confirmar', { apertura_id: aid, incidencia_apertura: {
        motivo: 'Faltante de prueba', detalle: 'Datos ficticios: faltan 100 USD', monedas_afectadas: ['USD'],
      } });
      ok(result);
      assert.equal(result.body.apertura_abierta_con_incidencia, true);
      const opened = await prisma.aperturaCaja.findUnique({ where: { id: aid } });
      assert.equal(opened.estado, 'ABIERTA'); assert.equal(opened.requiere_aprobacion, true);
      assert.equal(Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: p.id, moneda_id: usd.id } })).cantidad), 1000);
    });
    await check(`${tipo}: aprobar una incidencia registrada conserva la habilitacion de efectivo`, async () => {
      // Simulate the persisted approval flag, without committing any fixture changes.
      const client = new Client({ connectionString: url }); await client.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE "AperturaCaja" SET metodo_verificacion=\'INCIDENCIA_APROBADA\' WHERE id=$1', [aid]);
        const updated = await client.query('UPDATE "Saldo" SET cantidad=cantidad+1 WHERE punto_atencion_id=$1 AND moneda_id=$2 RETURNING cantidad', [p.id, usd.id]);
        assert.equal(Number(updated.rows[0].cantidad), 1001);
      } finally { await client.query('ROLLBACK'); await client.end(); }
    });
    const detalles = currencies.map(m => ({ moneda_id: m.id, saldo_apertura: 1000, saldo_cierre: 1000,
      conteo_fisico: m.id === usd.id ? 900 : 1010, billetes: m.id === usd.id ? 900 : 1010, monedas: 0,
      bancos_teorico: 25, conteo_bancos: 25 }));
    const snapshot = async () => JSON.stringify(await Promise.all([
      prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { moneda_id: 'asc' } }),
      prisma.cuadreCaja.findMany({ where: { punto_atencion_id: p.id }, include: { detalles: true } }),
      prisma.movimientoSaldo.findMany({ where: { punto_atencion_id: p.id } }),
      prisma.jornada.findUnique({ where: { id: j.id } }),
      prisma.usuario.findUnique({ where: { id: user.id } }),
    ]));
    await check(`${tipo}: diferencia sin autorizacion rechazada sin escrituras contables`, async () => {
      const before = await snapshot();
      assert.equal((await post('/guardar-cierre', { tipo_cierre: tipo, detalles })).status, 400);
      assert.equal(await snapshot(), before);
    });
    await check(`${tipo}: allowMismatch no admite desglose inconsistente`, async () => {
      const before = await snapshot();
      const invalid = detalles.map(d => ({ ...d, billetes: d.billetes + 50 }));
      assert.equal((await post('/guardar-cierre', { tipo_cierre: tipo, allowMismatch: true, detalles: invalid })).status, 400);
      assert.equal(await snapshot(), before);
    });
    await check(`${tipo}: diferencia aceptada respeta saldos y movimientos`, async () => {
      ok(await post('/guardar-cierre', { tipo_cierre: tipo, allowMismatch: true, detalles }, randomUUID()));
      for (const d of detalles) {
        const saldo = await prisma.saldo.findFirst({ where: { punto_atencion_id: p.id, moneda_id: d.moneda_id } });
        assert.equal(Number(saldo.cantidad), tipo === 'CERRADO' ? d.conteo_fisico : 1000);
        assert.equal(Number(saldo.billetes), Number(saldo.cantidad)); assert.equal(Number(saldo.bancos), 25);
        const moves = await prisma.movimientoSaldo.findMany({ where: { punto_atencion_id: p.id, moneda_id: d.moneda_id, descripcion: { contains: 'AJUSTE CIERRE' } } });
        assert.equal(moves.length, tipo === 'CERRADO' ? 1 : 0);
        if (tipo === 'CERRADO') assert.equal(Number(moves[0].monto), d.conteo_fisico - 1000);
      }
      assert.equal((await prisma.jornada.findUnique({ where: { id: j.id } })).estado, 'COMPLETADO');
      assert.equal((await prisma.usuario.findUnique({ where: { id: user.id } })).punto_atencion_id, null);
    });
  }
  const transferPoints = [];
  for (const label of ['ORIGEN', 'DESTINO']) {
    const p = await prisma.puntoAtencion.create({ data: { nombre: `TRANSFER ${label}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const u = await prisma.usuario.create({ data: { username: `transfer_${label}`, nombre: label,
      password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: p.id } });
    const j = await prisma.jornada.create({ data: { usuario_id: u.id, punto_atencion_id: p.id, fecha_inicio: morning, estado: 'ACTIVO' } });
    for (const m of currencies) {
      await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: u.id } });
    }
    const login = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' }); ok(login);
    const t = login.body.token;
    const opening = await post('/apertura-caja/iniciar', { jornada_id: j.id }, undefined, t); ok(opening);
    const aid = opening.body.apertura.id;
    ok(await post('/apertura-caja/conteo', { apertura_id: aid, conteos: currencies.map(m => ({
      moneda_id: m.id, billetes: [{ denominacion: 100, cantidad: 10 }], monedas: [], total: 1000,
    })) }, undefined, t));
    ok(await post('/apertura-caja/confirmar', { apertura_id: aid }, undefined, t));
    transferPoints.push({ id: p.id, token: t, userId: u.id });
  }
  const [origin, destination] = transferPoints;
  await check('Finalizar jornada: informa conteos pendientes y libera punto solo al completar', async () => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: 'CIERRE JORNADA', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const u = await prisma.usuario.create({ data: { username: 'cierre_jornada', nombre: 'Prueba cierre', password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: p.id } });
    const date = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const start = new Date(date + 'T05:00:00Z');
    const j = await prisma.jornada.create({ data: { usuario_id: u.id, punto_atencion_id: p.id, fecha_inicio: start, estado: 'ACTIVO' } });
    const login = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' }); ok(login);
    const close = () => post('/schedules', { usuario_id: u.id, punto_atencion_id: p.id, fecha_salida: new Date().toISOString() }, undefined, login.body.token);
    await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: eur.id, cantidad: 2, billetes: 0, monedas_fisicas: 2 } });
    const opening = await prisma.aperturaCaja.create({ data: { jornada_id: j.id, usuario_id: u.id, punto_atencion_id: p.id,
      fecha: start, estado: 'ABIERTA', saldo_esperado: [{ moneda_id: eur.id, codigo: 'EUR', cantidad: 2, apertura_por_etapas: true }], conteo_fisico: [] } });
    const missing = await close();
    assert.equal(missing.status, 409); assert.equal(missing.body.code, 'PENDING_CURRENCY_COUNT');
    assert.match(missing.body.error, /Apertura de Caja/);
    const unchanged = await prisma.jornada.findUniqueOrThrow({ where: { id: j.id } });
    assert.equal(unchanged.estado, 'ACTIVO'); assert.equal(unchanged.fecha_salida, null);
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } })).punto_atencion_id, p.id);
    await prisma.aperturaCaja.update({ where: { id: opening.id }, data: { conteo_fisico: [{ moneda_id: eur.id, total: 2 }] } });
    ok(await close());
    assert.equal((await prisma.jornada.findUniqueOrThrow({ where: { id: j.id } })).estado, 'COMPLETADO');
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } })).punto_atencion_id, null);
  });
  await check('Cierre Diario: conserva centavos personalizados y rechaza cantidades invalidas', async () => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: 'CENTAVOS CIERRE', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const u = await prisma.usuario.create({ data: { username: 'centavos_cierre', nombre: 'Centavos', password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: p.id } });
    const date = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    await prisma.jornada.create({ data: { usuario_id: u.id, punto_atencion_id: p.id, fecha_inicio: new Date(date + 'T05:00:00Z'), estado: 'ACTIVO' } });
    await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: eur.id, cantidad: 0.82, billetes: 0, monedas_fisicas: 0.82 } });
    const login = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' }); ok(login);
    const breakdown = [{ denominacion: 0.25, cantidad: 3, tipo: 'MONEDA' }, { denominacion: 0.01, cantidad: 7, tipo: 'MONEDA' }];
    const detail = { moneda_id: eur.id, codigo: 'EUR', nombre: 'Euro', simbolo: '?', saldo_apertura: 0.82, saldo_cierre: 0.82, saldo_cierre_teorico: 0.82,
      conteo_fisico: 0.82, billetes: 0, monedas_fisicas: 0.82, diferencia: 0, ingresos_periodo: 0, egresos_periodo: 0, movimientos_periodo: 0, desglose_denominaciones: breakdown };
    const route = '/contabilidad-diaria/' + p.id + '/' + date + '/cerrar';
    const invalid = await post(route, { detalles: [{ ...detail, desglose_denominaciones: [{ denominacion: 0.01, cantidad: -1, tipo: 'MONEDA' }] }] }, undefined, login.body.token);
    assert.equal(invalid.status, 400); assert.equal(invalid.body.codigo, 'DESGLOSE_INVALIDO');
    assert.equal(await prisma.cierreDiario.count({ where: { punto_atencion_id: p.id } }), 0);
    const closed = await post(route, { detalles: [detail] }, undefined, login.body.token); ok(closed);
    const saved = await prisma.detalleCuadreCaja.findFirstOrThrow({ where: { cuadre_id: closed.body.cuadre_id, moneda_id: eur.id } });
    assert.deepEqual(saved.desglose_denominaciones, breakdown); assert.equal(Number(saved.conteo_fisico), 0.82);
    const saldo = await prisma.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: eur.id } } });
    assert.equal(Number(saldo.cantidad), 0.82); assert.equal(Number(saldo.monedas_fisicas), 0.82); assert.equal(Number(saldo.billetes), 0);
  });
  // Report fixtures are isolated from operational points and intentionally include an inconsistent breakdown.
  const reportPoint = await prisma.puntoAtencion.create({ data: { nombre: '=PUNTO REPORTE', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha', activo: false } });
  const reportPrincipal = await prisma.puntoAtencion.create({ data: { nombre: 'PRINCIPAL REPORTES', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha', es_principal: true } });
  const reportAdmin = await prisma.usuario.create({ data: { username: 'report_admin', nombre: 'Admin reportes', password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'ADMIN', punto_atencion_id: reportPrincipal.id } });
  const reportLogin = await post('/auth/login', { username: reportAdmin.username, password: 'PruebaLocal_123!' }); ok(reportLogin);
  const reportToken = reportLogin.body.token;
  await prisma.saldo.create({ data: { punto_atencion_id: reportPoint.id, moneda_id: usd.id, cantidad: 12.34, billetes: 10, monedas_fisicas: 1, bancos: 8.88, updated_at: new Date('2026-09-10T12:00:00Z') } });
  for (const date of ['2026-08-30T05:00:00Z', '2026-08-31T04:59:59Z', '2026-08-31T05:00:00Z']) {
    await prisma.cuadreCaja.create({ data: { punto_atencion_id: reportPoint.id, usuario_id: reportAdmin.id, fecha: new Date(date), estado: 'ABIERTO', detalles: { create: { moneda_id: usd.id, saldo_apertura: 10, saldo_cierre: 12.34, conteo_fisico: 11, billetes: 10, monedas_fisicas: 1, diferencia: -1.34, bancos_teorico: 8.88 } } } });
  }
  const reportRoute = '/reportes/saldos-por-punto';
  const reportFetch = (query = '', auth = reportToken) => fetch(base + reportRoute + query, { headers: auth ? { Authorization: `Bearer ${auth}` } : {}, signal: AbortSignal.timeout(30000) });
  await check('Saldos por punto: Excel filtra historico por dia Ecuador y mantiene actuales, bancos y diferencias', async () => {
    const before = await prisma.saldo.findMany({ where: { punto_atencion_id: reportPoint.id } });
    const response = await reportFetch(`?punto_atencion_id=${reportPoint.id}&desde=2026-08-30&hasta=2026-08-30`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheetml/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.equal(wb.worksheets.length, 3);
    const current = wb.worksheets[0], history = wb.worksheets[1];
    assert.equal(current.rowCount, 2); assert.equal(current.getCell('A2').value, '=PUNTO REPORTE');
    assert.equal(current.getCell('D2').value, 12.34); assert.equal(current.getCell('G2').value, 11);
    assert.equal(current.getCell('H2').value, 1.34); assert.equal(current.getCell('I2').value, 8.88);
    assert.equal(current.getCell('B2').value, 'No');
    assert.equal(history.rowCount, 3); assert.equal(history.getCell('A2').value, '2026-08-30 00:00:00');
    assert.equal(history.getCell('A3').value, '2026-08-30 23:59:59');
    assert.equal(history.getCell('J2').value, -1.34); assert.equal(history.getCell('D2').value, 'ABIERTO');
    assert.notEqual(history.getCell('P2').value, history.getCell('P3').value);
    assert.deepEqual(await prisma.saldo.findMany({ where: { punto_atencion_id: reportPoint.id } }), before);
  });
  await check('Saldos por punto: sin filtros incluye varios puntos y conserva todas las fechas', async () => {
    const response = await reportFetch(); assert.equal(response.status, 200);
    const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.ok(wb.worksheets[0].rowCount > 2); assert.ok(wb.worksheets[1].rowCount > 3);
  });
  await check('Saldos por punto: valida fechas, rango, UUID y punto inexistente', async () => {
    for (const q of ['?desde=2026-02-30', '?desde=2026-09-03&hasta=2026-09-01', '?hasta=texto', '?punto_atencion_id=otro', '?desde=2026-08-01&desde=2026-08-02']) assert.equal((await reportFetch(q)).status, 400);
    assert.equal((await reportFetch('?punto_atencion_id=' + randomUUID())).status, 404);
  });
  await check('Saldos por punto: no permite operadores ni solicitudes anonimas', async () => {
    assert.equal((await reportFetch('', origin.token)).status, 403);
    assert.equal((await reportFetch('', null)).status, 401);
  });
  await check('Saldos por punto: administrativo y super usuario pueden exportar', async () => {
    for (const rol of ['ADMINISTRATIVO', 'SUPER_USUARIO']) {
      await prisma.usuario.update({ where: { id: reportAdmin.id }, data: { rol } });
      const response = await reportFetch(`?punto_atencion_id=${reportPoint.id}&desde=2026-08-30&hasta=2026-08-30`);
      assert.equal(response.status, 200); await response.arrayBuffer();
    }
  });
  await prisma.usuario.update({ where: { id: reportAdmin.id }, data: { rol: 'ADMINISTRATIVO', punto_atencion_id: null } });
  await prisma.puntoAtencion.delete({ where: { id: reportPrincipal.id } });
  const transferBody = { origen_id: origin.id, destino_id: destination.id, moneda_id: usd.id, monto: 100,
    tipo_transferencia: 'ENTRE_PUNTOS', via: 'EFECTIVO' };
  const balance = async (p) => {
    const s = await prisma.saldo.findFirst({ where: { punto_atencion_id: p.id, moneda_id: usd.id } });
    assert.equal(Number(s.bancos), 25); assert.equal(Number(s.cantidad), Number(s.billetes) + Number(s.monedas_fisicas));
    return Number(s.cantidad);
  };
  for (const detail of [{ billetes: 0, monedas: 50.25, total: 50.25 }, { billetes: 12.1, monedas: 38.15, total: 50.25 }]) {
    for (const action of ['accept', 'reject', 'cancel']) await check('Desglose transferencia ' + detail.billetes + '/' + detail.monedas + ': ' + action, async () => {
      for (const p of [origin, destination]) await prisma.saldo.update({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } }, data: { cantidad: 1000, billetes: 800, monedas_fisicas: 200 } });
      const key = randomUUID();
      const body = { ...transferBody, monto: detail.total, detalle_divisas: detail };
      const created = await post('/transfers', body, key, origin.token); ok(created);
      ok(await post('/transfers', body, key, origin.token));
      const id = created.body.transfer.id;
      const read = p => prisma.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } } });
      const sent = await read(origin);
      assert.equal(Number(sent.billetes), +(800 - detail.billetes).toFixed(2));
      assert.equal(Number(sent.monedas_fisicas), +(200 - detail.monedas).toFixed(2));
      const receipt = await prisma.recibo.findFirstOrThrow({ where: { referencia_id: id } });
      assert.deepEqual(receipt.datos_operacion.desglose_contabilizado_v1, detail);
      const pending = await fetch(base + '/transfers/pending-acceptance', { headers: { Authorization: `Bearer ${destination.token}` }, signal: AbortSignal.timeout(20000) });
      assert.equal(pending.status, 200);
      assert.deepEqual((await pending.json()).transfers.find(t => t.id === id).detalle_divisas, detail);
      // Change the origin proportions while the transfer is in transit: return must use the posted evidence.
      await prisma.saldo.update({ where: { id: sent.id }, data: { billetes: { decrement: 100 }, monedas_fisicas: { increment: 100 } } });
      ok(await post(action === 'cancel' ? '/transfers/' + id + '/cancel' : '/transfer-approvals/' + id + '/' + action, {}, undefined, action === 'cancel' ? origin.token : destination.token));
      const source = await read(origin), target = await read(destination);
      assert.equal(Number(source.billetes), action === 'accept' ? +(700 - detail.billetes).toFixed(2) : 700);
      assert.equal(Number(source.monedas_fisicas), action === 'accept' ? +(300 - detail.monedas).toFixed(2) : 300);
      assert.equal(Number(target.billetes), action === 'accept' ? +(800 + detail.billetes).toFixed(2) : 800);
      assert.equal(Number(target.monedas_fisicas), action === 'accept' ? +(200 + detail.monedas).toFixed(2) : 200);
      assert.equal(Number(source.bancos), 25); assert.equal(Number(target.bancos), 25);
    });
  }
  for (const detail of [{ billetes: 0, monedas: 500, total: 500 }, { billetes: 0, monedas: 10, total: 50 }, { billetes: 0, monedas: 50.001, total: 50.001 }]) await check('Desglose invalido o monedas insuficientes: ' + JSON.stringify(detail), async () => {
    const before = await prisma.saldo.findMany({ where: { punto_atencion_id: origin.id }, orderBy: { id: 'asc' } });
    const count = await prisma.transferencia.count();
    assert.equal((await post('/transfers', { ...transferBody, monto: detail.total, detalle_divisas: detail }, randomUUID(), origin.token)).status, 400);
    assert.equal(await prisma.transferencia.count(), count);
    assert.deepEqual(await prisma.saldo.findMany({ where: { punto_atencion_id: origin.id }, orderBy: { id: 'asc' } }), before);
  });
  await check('Transferencia: fallo de recibo revierte saldo y transferencia', async () => {
    const before = await prisma.saldo.findMany({ where: { punto_atencion_id: origin.id } });
    const count = await prisma.transferencia.count();
    await pool.query(`CREATE FUNCTION fail_transfer_receipt() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.tipo_operacion='TRANSFERENCIA' THEN RAISE EXCEPTION 'synthetic receipt failure'; END IF; RETURN NEW; END $body$; CREATE TRIGGER fail_transfer_receipt BEFORE INSERT ON "Recibo" FOR EACH ROW EXECUTE FUNCTION fail_transfer_receipt();`);
    try {
      assert.equal((await post('/transfers', { ...transferBody, monto: 10, detalle_divisas: { billetes: 0, monedas: 10, total: 10 } }, randomUUID(), origin.token)).status, 500);
      assert.equal(await prisma.transferencia.count(), count);
      assert.deepEqual(await prisma.saldo.findMany({ where: { punto_atencion_id: origin.id } }), before);
    } finally { await pool.query('DROP TRIGGER fail_transfer_receipt ON "Recibo"; DROP FUNCTION fail_transfer_receipt();'); }
  });
  for (const p of [origin, destination]) await prisma.saldo.update({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } }, data: { cantidad: 1000, billetes: 1000, monedas_fisicas: 0 } });
  for (const action of ['accept', 'reject']) {
    let tid;
    const initialOrigin = await balance(origin), initialDestination = await balance(destination);
    const transferKey = randomUUID();
    await check(`Transfer ${action}: envio descuenta solo origen e idempotencia`, async () => {
      const result = await post('/transfers', transferBody, transferKey, origin.token); ok(result);
      tid = result.body.transfer.id;
      assert.equal(result.body.transfer.estado, 'EN_TRANSITO');
      ok(await post('/transfers', transferBody, transferKey, origin.token));
      assert.equal(await balance(origin), initialOrigin - 100); assert.equal(await balance(destination), initialDestination);
      const moves = await prisma.movimientoSaldo.findMany({ where: { referencia_id: tid } });
      assert.equal(moves.length, 1); assert.equal(Number(moves[0].monto), -100);
    });
    await check(`Transfer ${action}: origen no puede resolver por destino`, async () => {
      assert.equal((await post(`/transfer-approvals/${tid}/${action}`, {}, undefined, origin.token)).status, 403);
      assert.equal((await prisma.transferencia.findUnique({ where: { id: tid } })).estado, 'EN_TRANSITO');
      assert.equal(await balance(origin), initialOrigin - 100); assert.equal(await balance(destination), initialDestination);
    });
    await check(`Transfer ${action}: destino resuelve una sola vez`, async () => {
      ok(await post(`/transfer-approvals/${tid}/${action}`, {}, undefined, destination.token));
      assert.equal((await prisma.transferencia.findUnique({ where: { id: tid } })).estado, action === 'accept' ? 'COMPLETADO' : 'CANCELADO');
      assert.equal((await post(`/transfer-approvals/${tid}/${action}`, {}, undefined, destination.token)).status, 400);
      assert.equal(await balance(origin), initialOrigin - (action === 'accept' ? 100 : 0));
      assert.equal(await balance(destination), initialDestination + (action === 'accept' ? 100 : 0));
      const moves = await prisma.movimientoSaldo.findMany({ where: { referencia_id: tid } });
      assert.equal(moves.length, 2); assert.equal(moves.reduce((sum, m) => sum + Number(m.monto), 0), 0);
    });
  }
  await check('Transfer: operador no puede descontar otro punto', async () => {
    const before = [await balance(origin), await balance(destination), await prisma.transferencia.count(), await prisma.movimientoSaldo.count()];
    const result = await post('/transfers', { ...transferBody, origen_id: destination.id, destino_id: origin.id }, undefined, origin.token);
    assert.equal(result.status, 403);
    assert.deepEqual([await balance(origin), await balance(destination), await prisma.transferencia.count(), await prisma.movimientoSaldo.count()], before);
  });
  await check('Transfer: operador no puede omitir origen', async () => {
    const before = await prisma.transferencia.count();
    for (const origen_id of [null, undefined]) {
      assert.equal((await post('/transfers', { ...transferBody, origen_id }, undefined, origin.token)).status, 403);
    }
    assert.equal(await prisma.transferencia.count(), before);
  });
  await check('Transfer: concesion no puede descontar otro punto', async () => {
    await prisma.usuario.update({ where: { id: origin.userId }, data: { rol: 'CONCESION' } });
    const before = await balance(destination);
    assert.equal((await post('/transfers', { ...transferBody, origen_id: destination.id, destino_id: origin.id }, undefined, origin.token)).status, 403);
    assert.equal(await balance(destination), before);
  });
  for (const rol of ['ADMIN', 'SUPER_USUARIO']) {
    await check(`Transfer: ${rol} conserva envio desde otro punto`, async () => {
      await prisma.puntoAtencion.update({ where: { id: origin.id }, data: { es_principal: true } });
      await prisma.usuario.update({ where: { id: origin.userId }, data: { rol } });
      const before = await balance(destination);
      ok(await post('/transfers', { ...transferBody, origen_id: destination.id, destino_id: origin.id }, randomUUID(), origin.token));
      assert.equal(await balance(destination), before - 100);
    });
  }
  for (const actions of [['accept', 'accept'], ['reject', 'reject'], ['accept', 'reject'], ['accept', 'cancel']]) {
    await check(`Transfer concurrente: ${actions.join(' / ')} solo resuelve una vez`, async () => {
      const beforeOrigin = await balance(origin), beforeDestination = await balance(destination);
      const created = await post('/transfers', transferBody, randomUUID(), origin.token); ok(created);
      const tid = created.body.transfer.id;
      // Force both requests to reach the state write after reading EN_TRANSITO.
      const blocker = new Client({ connectionString: url });
      await blocker.connect();
      let requests = [];
      let responses;
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM "Transferencia" WHERE id=$1 FOR UPDATE', [tid]);
        requests = actions.map(action => post(action === 'cancel' ? `/transfers/${tid}/cancel` : `/transfer-approvals/${tid}/${action}`,
          {}, undefined, action === 'cancel' ? origin.token : destination.token));
        const deadline = Date.now() + 10000;
        let waiting = 0;
        while (Date.now() < deadline) {
          const locks = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Transferencia%'");
          waiting = locks.rows[0].n;
          if (waiting >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.ok(waiting >= 2, 'Ambas solicitudes deben competir por la misma transferencia');
      } finally {
        await blocker.query('ROLLBACK'); await blocker.end();
        responses = await Promise.all(requests);
      }
      assert.equal(responses.filter(r => r.status >= 200 && r.status < 300).length, 1, JSON.stringify(responses.map(r => r.status)));
      assert.ok(responses.some(r => r.status === 409), 'La solicitud que pierde la carrera debe recibir 409');
      const transfer = await prisma.transferencia.findUnique({ where: { id: tid } });
      const accepted = transfer.estado === 'COMPLETADO';
      assert.ok(accepted || transfer.estado === 'CANCELADO');
      assert.equal(await balance(origin), beforeOrigin - (accepted ? 100 : 0));
      assert.equal(await balance(destination), beforeDestination + (accepted ? 100 : 0));
      const moves = await prisma.movimientoSaldo.findMany({ where: { referencia_id: tid } });
      assert.equal(moves.length, 2); assert.equal(moves.reduce((sum, m) => sum + Number(m.monto), 0), 0);
    });
  }
  // Hold the shared balance until both independent transactions reach a lock.
  async function raceBalance(p, operations, missing = false, ordered = false) {
    const blocker = new Client({ connectionString: url });
    await blocker.connect();
    let pending = [];
    let responses;
    try {
      await blocker.query('BEGIN');
      if (missing) {
        await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`transfer-balance:${p.id}:${usd.id}`]);
      } else {
        await blocker.query('SELECT id FROM "Saldo" WHERE punto_atencion_id=$1 AND moneda_id=$2 FOR UPDATE', [p.id, usd.id]);
      }
      if (ordered) {
        pending = [operations[0]()];
        const firstDeadline = Date.now() + 10000;
        let firstWaiting = 0;
        while (Date.now() < firstDeadline) {
          firstWaiting = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n;
          if (firstWaiting >= 1) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.ok(firstWaiting >= 1, 'La primera solicitud debe adquirir turno antes de lanzar la segunda');
        pending.push(...operations.slice(1).map(fn => fn()));
      } else {
        pending = operations.map(fn => fn());
      }
      const deadline = Date.now() + 10000;
      let waiting = 0;
      while (Date.now() < deadline) {
        waiting = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n;
        if (waiting >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.ok(waiting >= 2, 'Dos operaciones deben competir por el saldo');
    } finally {
      await blocker.query('ROLLBACK'); await blocker.end();
      responses = await Promise.all(pending);
    }
    return responses;
  }
  for (const limited of [false, true]) {
    await check(`Saldo concurrente: envios con fondos ${limited ? 'insuficientes para ambos' : 'suficientes'}`, async () => {
      const before = await balance(origin), destBefore = await balance(destination);
      const amount = limited ? Math.ceil(before * 0.75) : 10;
      const countBefore = await prisma.transferencia.count();
      const movesBefore = await prisma.movimientoSaldo.count();
      const responses = await raceBalance(origin, [0, 1].map(() => () => post('/transfers', { ...transferBody, monto: amount }, randomUUID(), origin.token)));
      const successes = responses.filter(r => r.status === 201);
      assert.equal(successes.length, limited ? 1 : 2, JSON.stringify(responses.map(r => r.status)));
      if (limited) assert.ok(responses.some(r => r.status === 400), 'Saldo insuficiente debe responder 400');
      assert.equal(await balance(origin), before - amount * successes.length);
      assert.equal(await balance(destination), destBefore);
      assert.equal(await prisma.transferencia.count(), countBefore + successes.length);
      assert.equal(await prisma.movimientoSaldo.count(), movesBefore + successes.length);
      const ids = successes.map(r => r.body.transfer.id);
      const moves = await prisma.movimientoSaldo.findMany({ where: { referencia_id: { in: ids } }, orderBy: { saldo_anterior: 'desc' } });
      assert.equal(Number(moves[0].saldo_anterior), before);
      if (moves.length === 2) assert.equal(Number(moves[1].saldo_anterior), Number(moves[0].saldo_nuevo));
    });
  }
  for (const action of ['accept', 'reject', 'cancel']) {
    await check(`Saldo concurrente: ${action} de dos transferencias distintas`, async () => {
      const beforeOrigin = await balance(origin), beforeDestination = await balance(destination);
      const ids = [];
      for (let i = 0; i < 2; i++) {
        const created = await post('/transfers', { ...transferBody, monto: 10 }, randomUUID(), origin.token); ok(created);
        ids.push(created.body.transfer.id);
      }
      const responses = await raceBalance(action === 'accept' ? destination : origin, ids.map(id => () => post(
        action === 'cancel' ? `/transfers/${id}/cancel` : `/transfer-approvals/${id}/${action}`, {}, undefined,
        action === 'cancel' ? origin.token : destination.token)));
      responses.forEach(ok);
      assert.equal(await balance(origin), beforeOrigin - (action === 'accept' ? 20 : 0));
      assert.equal(await balance(destination), beforeDestination + (action === 'accept' ? 20 : 0));
      for (const id of ids) {
        const moves = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
        assert.equal(moves.length, 2); assert.equal(moves.reduce((sum, m) => sum + Number(m.monto), 0), 0);
      }
    });
  }
  await check('Saldo concurrente: dos primeras recepciones crean un solo saldo completo', async () => {
    const emptyPoint = await prisma.puntoAtencion.create({ data: { nombre: 'DESTINO SIN SALDO', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const created = await post('/transfers', { ...transferBody, destino_id: emptyPoint.id, monto: 10 }, randomUUID(), origin.token); ok(created);
      ids.push(created.body.transfer.id);
    }
    assert.equal(await prisma.saldo.count({ where: { punto_atencion_id: emptyPoint.id } }), 0);
    const responses = await raceBalance(emptyPoint, ids.map(id => () => post(`/transfer-approvals/${id}/accept`, {}, undefined, origin.token)), true);
    responses.forEach(ok);
    const rows = await prisma.saldo.findMany({ where: { punto_atencion_id: emptyPoint.id } });
    assert.equal(rows.length, 1); assert.equal(Number(rows[0].cantidad), 20);
    assert.equal(Number(rows[0].billetes), 20); assert.equal(Number(rows[0].bancos), 0);
    const moves = await prisma.movimientoSaldo.findMany({ where: { punto_atencion_id: emptyPoint.id }, orderBy: { saldo_anterior: 'asc' } });
    assert.deepEqual(moves.map(m => [Number(m.saldo_anterior), Number(m.saldo_nuevo)]), [[0, 10], [10, 20]]);
  });
  await check('Cambio y transferencia simultaneos conservan ambos egresos', async () => {
    const before = await balance(destination), otherBefore = await balance(origin);
    const eurBefore = Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: destination.id, moneda_id: eur.id } })).cantidad);
    const responses = await raceBalance(destination, [
      () => post('/exchanges', { ...exchange, punto_atencion_id: destination.id }, randomUUID(), destination.token),
      () => post('/transfers', { ...transferBody, origen_id: destination.id, destino_id: origin.id, monto: 10 }, randomUUID(), destination.token),
    ]);
    responses.forEach(ok);
    assert.equal(await balance(destination), before - 120);
    assert.equal(await balance(origin), otherBefore);
    assert.equal(Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: destination.id, moneda_id: eur.id } })).cantidad), eurBefore + 100);
  });
  await check('Dos cambios simultaneos conservan ambas monedas y sus movimientos', async () => {
    const before = await balance(destination);
    const eurBefore = Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: destination.id, moneda_id: eur.id } })).cantidad);
    const changesBefore = await prisma.cambioDivisa.count();
    const movesBefore = await prisma.movimientoSaldo.count();
    const responses = await raceBalance(destination, [0, 1].map(() => () => post('/exchanges', { ...exchange, punto_atencion_id: destination.id }, randomUUID(), destination.token)));
    responses.forEach(ok);
    assert.equal(await balance(destination), before - 220);
    assert.equal(Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: destination.id, moneda_id: eur.id } })).cantidad), eurBefore + 200);
    assert.equal(await prisma.cambioDivisa.count(), changesBefore + 2);
    assert.equal(await prisma.movimientoSaldo.count(), movesBefore + 4);
  });
  for (const kind of ['transfer', 'exchange']) for (const closeFirst of [false, true]) {
  await check(`Cierre concurrente con ${kind}: primero ${closeFirst ? 'cierre' : 'operacion'}`, async () => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: `CIERRE ${kind} ${closeFirst}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const destination = { ...transferPoints[1], id: p.id };
    await prisma.usuario.update({ where: { id: destination.userId }, data: { punto_atencion_id: p.id } });
    const j = await prisma.jornada.create({ data: { usuario_id: destination.userId, punto_atencion_id: p.id, fecha_inicio: morning, estado: 'ACTIVO' } });
    for (const m of currencies) {
      await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: destination.userId } });
    }
    const started = await post('/apertura-caja/iniciar', { jornada_id: j.id }, undefined, destination.token); ok(started);
    const aid = started.body.apertura.id;
    ok(await post('/apertura-caja/conteo', { apertura_id: aid, conteos: currencies.map(m => ({ moneda_id: m.id,
      billetes: [{ denominacion: 100, cantidad: 10 }], monedas: [], total: 1000 })) }, undefined, destination.token));
    ok(await post('/apertura-caja/confirmar', { apertura_id: aid }, undefined, destination.token));
    const before = await balance(destination);
    const eurAmount = Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: destination.id, moneda_id: eur.id } })).cantidad);
    const detalles = [[usd, before], [eur, eurAmount]].map(([m, amount]) => ({
      moneda_id: m.id, saldo_apertura: 1000, saldo_cierre: amount, conteo_fisico: amount,
      billetes: amount, monedas: 0, bancos_teorico: 25, conteo_bancos: 25,
    }));
    const operation = kind === 'transfer'
      ? () => post('/transfers', { ...transferBody, origen_id: destination.id, destino_id: origin.id, monto: 10 }, randomUUID(), destination.token)
      : () => post('/exchanges', { ...exchange, punto_atencion_id: destination.id }, randomUUID(), destination.token);
    const close = () => post('/guardar-cierre', { tipo_cierre: 'CERRADO', detalles }, randomUUID(), destination.token);
    const responses = await raceBalance(destination, closeFirst ? [close, operation] : [operation, close], false, true);
    assert.equal(responses.filter(r => r.status >= 200 && r.status < 300).length, 1, JSON.stringify(responses.map(r => r.status)));
    assert.ok(responses.some(r => r.status === 409));
    ok(responses[0]); assert.equal(responses[1].status, 409);
    const sent = !closeFirst;
    assert.equal(await balance(destination), before - (sent ? (kind === 'transfer' ? 10 : 110) : 0));
    assert.equal(Number((await prisma.saldo.findFirst({ where: { punto_atencion_id: p.id, moneda_id: eur.id } })).cantidad), eurAmount + (sent && kind === 'exchange' ? 100 : 0));
    assert.equal((await prisma.jornada.findUnique({ where: { id: j.id } })).estado, closeFirst ? 'COMPLETADO' : 'ACTIVO');
    const u = await prisma.usuario.findUnique({ where: { id: destination.userId } });
    assert.equal(u.punto_atencion_id, sent ? destination.id : null);
  });
  }
  await check('Consultar cierre historico sin movimientos conserva snapshot y fecha', async () => {
    const historicalDate = new Date(dayStart.getTime() - 2 * 86400000);
    const historyPoint = await prisma.puntoAtencion.create({ data: { nombre: 'HISTORICO', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const closed = await prisma.cuadreCaja.create({ data: { punto_atencion_id: historyPoint.id, usuario_id: origin.userId,
      fecha: historicalDate, fecha_cierre: historicalDate, estado: 'CERRADO', observaciones: 'Cierre ficticio conservado',
      detalles: { create: { moneda_id: usd.id, saldo_apertura: 100, saldo_cierre: 120, conteo_fisico: 119,
        billetes: 119, monedas_fisicas: 0, bancos_teorico: 15, conteo_bancos: 14, diferencia: -1,
        diferencia_bancos: -1, movimientos_periodo: 1 } } } });
    await prisma.saldo.create({ data: { punto_atencion_id: historyPoint.id, moneda_id: usd.id, cantidad: 500, billetes: 500, bancos: 50 } });
    // A later open report must not be selected when requesting an earlier date.
    await prisma.cuadreCaja.create({ data: { punto_atencion_id: historyPoint.id, usuario_id: origin.userId, fecha: dayStart, estado: 'ABIERTO' } });
    const snapshot = () => prisma.cuadreCaja.findMany({ where: { punto_atencion_id: historyPoint.id }, include: { detalles: true }, orderBy: { fecha: 'asc' } });
    const before = JSON.stringify(await snapshot());
    const date = historicalDate.toISOString().slice(0, 10);
    const res = await fetch(`${base}/cuadre-caja?pointId=${historyPoint.id}&fecha=${date}`, { headers: { Authorization: `Bearer ${origin.token}` }, signal: AbortSignal.timeout(20000) });
    assert.equal(res.status, 200); const report = (await res.json()).data;
    assert.equal(report.cuadre_id, closed.id);
    assert.equal(report.detalles.length, 1);
    const d = report.detalles[0];
    assert.equal(d.saldo_cierre, 120); assert.equal(d.conteo_fisico, 119);
    assert.equal(d.bancos_teorico, 15); assert.equal(d.conteo_bancos, 14);
    assert.equal(d.movimientos_periodo, 1);
    assert.equal(JSON.stringify(await snapshot()), before);
    await check('Cierre historico con movimientos y moneda inactiva no se recalcula', async () => {
      const template = await prisma.movimientoSaldo.findFirst();
      await prisma.movimientoSaldo.create({ data: { ...template, id: randomUUID(), punto_atencion_id: historyPoint.id,
        moneda_id: usd.id, fecha: new Date(historicalDate.getTime() + 3600000), monto: 300,
        saldo_anterior: 200, saldo_nuevo: 500 } });
      await prisma.moneda.update({ where: { id: usd.id }, data: { activo: false } });
      try {
        const next = await fetch(`${base}/cuadre-caja?pointId=${historyPoint.id}&fecha=${date}`, { headers: { Authorization: `Bearer ${origin.token}` }, signal: AbortSignal.timeout(20000) });
        assert.equal(next.status, 200);
        const data = (await next.json()).data;
        assert.equal(data.cuadre_id, closed.id); assert.equal(data.detalles.length, 1);
        assert.equal(data.detalles[0].saldo_cierre, 120); assert.equal(data.detalles[0].bancos_teorico, 15);
        assert.equal(JSON.stringify(await snapshot()), before);
      } finally { await prisma.moneda.update({ where: { id: usd.id }, data: { activo: true } }); }
    });
  });
  for (const requestKind of ['GET', 'conteo']) {
  await check(`${requestKind} iniciado con cuadre abierto no modifica detalles si se cierra mientras espera`, async () => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: `LECTURA EN CIERRE ${requestKind}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: usd.id, cantidad_inicial: 1000, asignado_por: origin.userId } });
    await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: usd.id, cantidad: 1005, billetes: 1005, bancos: 25 } });
    const template = await prisma.movimientoSaldo.findFirst();
    await prisma.movimientoSaldo.create({ data: { ...template, id: randomUUID(), punto_atencion_id: p.id,
      moneda_id: usd.id, fecha: new Date(), monto: 5, saldo_anterior: 1000, saldo_nuevo: 1005 } });
    const c = await prisma.cuadreCaja.create({ data: { punto_atencion_id: p.id, usuario_id: origin.userId, fecha: dayStart, estado: 'ABIERTO',
      detalles: { create: { moneda_id: usd.id, saldo_apertura: 1000, saldo_cierre: 1005, conteo_fisico: 1005, billetes: 1005 } } }, include: { detalles: true } });
    const counter = await prisma.usuario.create({ data: { username: `contador_${requestKind}`, nombre: 'Contador ficticio',
      password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: p.id } });
    await prisma.jornada.create({ data: { usuario_id: counter.id, punto_atencion_id: p.id, fecha_inicio: morning, estado: 'ACTIVO' } });
    const login = await post('/auth/login', { username: counter.username, password: 'PruebaLocal_123!' }); ok(login);
    const countBody = { cuadre_id: c.id, moneda_id: usd.id, billetes: 700, monedas_fisicas: 3, conteo_bancos: 8 };
    const blocker = new Client({ connectionString: url }); await blocker.connect();
    let request, response, expected;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM "CuadreCaja" WHERE id=$1 FOR UPDATE', [c.id]);
      await blocker.query('SELECT id FROM "DetalleCuadreCaja" WHERE cuadre_id=$1 FOR UPDATE', [c.id]);
      request = requestKind === 'GET'
        ? fetch(`${base}/cuadre-caja?pointId=${p.id}`, { headers: { Authorization: `Bearer ${origin.token}` }, signal: AbortSignal.timeout(20000) })
        : post('/cuadre-caja/conteo-fisico', countBody, undefined, login.body.token);
      const deadline = Date.now() + 10000; let waiting = 0;
      while (Date.now() < deadline) {
        waiting = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.ok(waiting, 'El GET debe alcanzar la escritura antes del cierre simulado');
      // Simulate the final transaction of a closer while the GET has an old snapshot.
      await blocker.query('UPDATE "CuadreCaja" SET estado=\'CERRADO\', fecha_cierre=now() WHERE id=$1', [c.id]);
      await blocker.query('UPDATE "DetalleCuadreCaja" SET saldo_apertura=100, saldo_cierre=120, conteo_fisico=119, diferencia=-1 WHERE cuadre_id=$1', [c.id]);
      expected = (await blocker.query('SELECT to_jsonb(d) AS data FROM "DetalleCuadreCaja" d WHERE cuadre_id=$1', [c.id])).rows;
      await blocker.query('COMMIT');
    } finally {
      await blocker.query('ROLLBACK'); await blocker.end();
      if (request) response = await request;
    }
    assert.equal(response.status, 409);
    const after = (await pool.query('SELECT to_jsonb(d) AS data FROM "DetalleCuadreCaja" d WHERE cuadre_id=$1', [c.id])).rows;
    assert.deepEqual(after, expected);
    const reread = await fetch(`${base}/cuadre-caja?pointId=${p.id}`, { headers: { Authorization: `Bearer ${origin.token}` } });
    assert.equal(reread.status, 200); assert.equal((await reread.json()).data.detalles[0].saldo_cierre, 120);
    if (requestKind === 'conteo') {
      assert.equal((await post('/cuadre-caja/conteo-fisico', countBody, undefined, login.body.token)).status, 404);
    }
  });
  }
  const permissionPoint = await prisma.puntoAtencion.create({ data: { nombre: 'PERMISOS CUADRE', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
  const reader = await prisma.usuario.create({ data: { username: 'lector_cuadre', nombre: 'Lector ficticio', password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR', punto_atencion_id: permissionPoint.id } });
  await prisma.jornada.create({ data: { usuario_id: reader.id, punto_atencion_id: permissionPoint.id, fecha_inicio: morning, estado: 'ACTIVO' } });
  const readerLogin = await post('/auth/login', { username: reader.username, password: 'PruebaLocal_123!' }); ok(readerLogin);
  const ownReport = await prisma.cuadreCaja.create({ data: { usuario_id: reader.id, punto_atencion_id: permissionPoint.id, fecha: dayStart, estado: 'ABIERTO', detalles: { create: { moneda_id: usd.id, saldo_apertura: 100, saldo_cierre: 100, conteo_fisico: 100, billetes: 100 } } } });
  const otherReport = await prisma.cuadreCaja.findFirst({ where: { punto_atencion_id: origin.id } });
  async function permissionRequest(endpoint, report, pointId, authToken) {
    if (endpoint === 'validar') return post('/cuadre-caja/validar', { cuadre_id: report.id }, undefined, authToken);
    const route = endpoint === 'detalles' ? `/cuadre-caja/detalles/${report.id}` : `/cuadre-caja/movimientos-auditoria?punto_atencion_id=${pointId}`;
    const res = await fetch(base + route, { headers: { Authorization: `Bearer ${authToken}` }, signal: AbortSignal.timeout(20000) });
    return { status: res.status, body: await res.json() };
  }
  for (const endpoint of ['detalles', 'validar', 'auditoria']) {
    await check(`Permisos ${endpoint}: operador consulta su punto y rechaza otro`, async () => {
      ok(await permissionRequest(endpoint, ownReport, permissionPoint.id, readerLogin.body.token));
      const denied = await permissionRequest(endpoint, otherReport, origin.id, readerLogin.body.token);
      assert.equal(denied.status, 403);
      assert.equal(denied.body.success, false); assert.equal(denied.body.data, undefined);
    });
    for (const rol of ['ADMIN', 'SUPER_USUARIO', 'ADMINISTRATIVO']) {
      await check(`Permisos ${endpoint}: conserva alcance de ${rol}`, async () => {
        await prisma.usuario.update({ where: { id: origin.userId }, data: { rol } });
        const result = await permissionRequest(endpoint, ownReport, permissionPoint.id, origin.token);
        if (rol === 'ADMINISTRATIVO' && endpoint === 'validar') assert.equal(result.status, 403);
        else ok(result);
      });
    }
  }
  async function pendingFixture(pointId, estado = 'PENDIENTE') {
    return prisma.cambioDivisa.create({ data: {
      usuario_id: reader.id, punto_atencion_id: pointId,
      moneda_origen_id: eur.id, moneda_destino_id: usd.id,
      monto_origen: 100, monto_destino: 110, tipo_operacion: 'COMPRA',
      metodo_entrega: 'efectivo', estado,
    } });
  }
  async function patchExchange(id, action, authToken) {
    const response = await fetch(`${base}/exchanges/${id}/${action}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ abono_inicial_monto: 10 }),
      signal: AbortSignal.timeout(20000),
    });
    return { status: response.status, body: await response.json() };
  }
  for (const action of ['cerrar', 'completar', 'register-partial-payment']) {
    for (const scenario of ['otro punto', 'cancelado']) {
      await check(`Cambio ${action}: rechaza ${scenario} sin alterar datos`, async () => {
        const record = await pendingFixture(scenario === 'otro punto' ? origin.id : permissionPoint.id,
          scenario === 'cancelado' ? 'CANCELADO' : 'PENDIENTE');
        const snapshot = async () => JSON.stringify({
          cambio: await prisma.cambioDivisa.findUnique({ where: { id: record.id } }),
          saldos: await prisma.saldo.findMany({ orderBy: { id: 'asc' } }),
          movimientos: await prisma.movimientoSaldo.count(),
        });
        const before = await snapshot();
        const result = await patchExchange(record.id, action, readerLogin.body.token);
        assert.equal(result.status, scenario === 'otro punto' ? 403 : 409);
        assert.equal(await snapshot(), before);
      });
    }
    for (const rol of ['OPERADOR', 'ADMIN', 'SUPER_USUARIO']) {
      await check(`Cambio ${action}: conserva acceso permitido de ${rol}`, async () => {
        await prisma.usuario.update({ where: { id: origin.userId }, data: { rol: rol === 'OPERADOR' ? 'ADMIN' : rol } });
        const record = await pendingFixture(permissionPoint.id);
        const result = await patchExchange(record.id, action, rol === 'OPERADOR' ? readerLogin.body.token : origin.token);
        assert.equal(result.status, 200, JSON.stringify(result.body));
      });
    }
  }
  await prisma.usuario.update({ where: { id: origin.userId }, data: { rol: 'ADMIN' } });
  for (const action of ['cerrar', 'completar', 'complete-partial']) {
    for (const scenario of ['concurrente', 'saldo insuficiente', 'fallo recibo', 'contabilizado completo', 'sin historial', 'historial incompatible']) {
      await check(`Cambio ${action}: abono ${scenario} conserva atomicidad`, async () => {
        const p = await prisma.puntoAtencion.create({ data: { nombre: `ABONO ${action} ${scenario}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
        for (const moneda of [usd, eur]) await prisma.saldo.create({ data: {
          punto_atencion_id: p.id, moneda_id: moneda.id, cantidad: scenario === 'saldo insuficiente' ? 1 : 1000,
          billetes: scenario === 'saldo insuficiente' ? 1 : 1000, bancos: 25,
        } });
        const record = await pendingFixture(p.id);
        await prisma.cambioDivisa.update({ where: { id: record.id }, data: {
          abono_inicial_monto: 55, saldo_pendiente: 55,
          divisas_entregadas_total: 100, divisas_entregadas_billetes: 100,
          divisas_recibidas_total: 110, divisas_recibidas_billetes: 110,
          usd_entregado_efectivo: 110, usd_entregado_transfer: 0,
        } });
        if (scenario !== 'sin historial') {
          for (const [currency, amount] of [[eur, scenario === 'contabilizado completo' ? 100 : scenario === 'historial incompatible' ? 49 : 50],
            [usd, scenario === 'contabilizado completo' ? -110 : -55]]) {
            await prisma.movimientoSaldo.create({ data: {
              punto_atencion_id: p.id, moneda_id: currency.id, usuario_id: origin.userId,
              referencia_id: record.id, tipo_referencia: 'CAMBIO_DIVISA',
              tipo_movimiento: amount > 0 ? 'INGRESO' : 'EGRESO', monto: amount,
              saldo_anterior: 1000 - amount, saldo_nuevo: 1000, descripcion: 'Cambio ficticio (CAJA)',
            } });
          }
        }
        const snapshot = async () => JSON.stringify({
          cambio: await prisma.cambioDivisa.findUnique({ where: { id: record.id } }),
          saldos: await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { id: 'asc' } }),
          movimientos: await prisma.movimientoSaldo.count({ where: { referencia_id: record.id } }),
          recibos: await prisma.recibo.count({ where: { referencia_id: record.id } }),
        });
        const before = await snapshot();
        if (scenario === 'fallo recibo') {
          await pool.query(`CREATE FUNCTION reject_test_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.referencia_id = '${record.id}' THEN RAISE EXCEPTION 'Fallo ficticio de recibo'; END IF; RETURN NEW; END $$`);
          await pool.query('CREATE TRIGGER reject_test_receipt BEFORE INSERT ON "Recibo" FOR EACH ROW EXECUTE FUNCTION reject_test_receipt()');
        }
        try {
          if (scenario === 'concurrente') {
            const responses = await raceBalance(p, [
              () => patchExchange(record.id, action, origin.token),
              () => patchExchange(record.id, action, origin.token),
            ]);
            assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
            assert.equal(await balance(p), 945);
            const eurBalance = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: eur.id } } });
            assert.equal(Number(eurBalance.cantidad), 1050);
            assert.equal(Number(eurBalance.billetes), 1050);
            assert.equal(await prisma.movimientoSaldo.count({ where: { referencia_id: record.id } }), 4);
            assert.equal(await prisma.recibo.count({ where: { referencia_id: record.id } }), 1);
          } else if (scenario === 'contabilizado completo') {
            const result = await patchExchange(record.id, action, origin.token);
            assert.equal(result.status, 200, JSON.stringify(result.body));
            const beforeData = JSON.parse(before); const afterData = JSON.parse(await snapshot());
            assert.deepEqual(afterData.saldos, beforeData.saldos);
            assert.equal(afterData.movimientos, 2); assert.equal(afterData.recibos, 1);
            assert.equal(afterData.cambio.estado, 'COMPLETADO');
          } else {
            const result = await patchExchange(record.id, action, origin.token);
            assert.equal(result.status, scenario === 'saldo insuficiente' ? 400 : scenario === 'fallo recibo' ? 500 : 409);
            assert.equal(await snapshot(), before);
          }
        } finally {
          if (scenario === 'fallo recibo') {
            await pool.query('DROP TRIGGER reject_test_receipt ON "Recibo"');
            await pool.query('DROP FUNCTION reject_test_receipt()');
          }
        }
      });
    }
  }
  for (const action of ['complete-partial', 'register-partial-payment']) {
    await check(`Cambio ${action}: no revive estado cambiado mientras espera`, async () => {
      const record = await pendingFixture(permissionPoint.id);
      await prisma.cambioDivisa.update({ where: { id: record.id }, data: { saldo_pendiente: 55 } });
      const blocker = new Client({ connectionString: url }); await blocker.connect();
      let request, response;
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM "CambioDivisa" WHERE id=$1 FOR UPDATE', [record.id]);
        request = patchExchange(record.id, action, origin.token);
        const deadline = Date.now() + 10000; let waiting = 0;
        while (Date.now() < deadline) {
          waiting = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n;
          if (waiting) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.ok(waiting, 'La solicitud debe alcanzar la escritura bloqueada');
        await blocker.query('UPDATE "CambioDivisa" SET estado=\'CANCELADO\' WHERE id=$1', [record.id]);
        await blocker.query('COMMIT');
      } finally {
        await blocker.query('ROLLBACK'); await blocker.end();
        if (request) response = await request;
      }
      assert.equal(response.status, 409);
      const after = await prisma.cambioDivisa.findUnique({ where: { id: record.id } });
      assert.equal(after.estado, 'CANCELADO'); assert.equal(Number(after.saldo_pendiente), 55);
      assert.equal(after.abono_inicial_monto, null);
      assert.equal((await patchExchange(record.id, action, origin.token)).status, 409);
    });
  }
  for (const scenario of ['concurrente', 'saldo insuficiente']) {
    await check(`Eliminar cambio completado: ${scenario} conserva saldos y reverso`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `REVERSO ${scenario}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      for (const moneda of [usd, eur]) await prisma.saldo.create({ data: {
        punto_atencion_id: p.id, moneda_id: moneda.id,
        cantidad: scenario === 'saldo insuficiente' ? 1 : 1000,
        billetes: scenario === 'saldo insuficiente' ? 1 : 1000, bancos: 25,
      } });
      const record = await pendingFixture(p.id, 'COMPLETADO');
      await prisma.cambioDivisa.update({ where: { id: record.id }, data: {
        divisas_entregadas_total: 100, divisas_entregadas_billetes: 100,
        divisas_recibidas_total: 110, divisas_recibidas_billetes: 110,
        usd_entregado_efectivo: 110, usd_recibido_efectivo: 100,
      } });
      const remove = () => fetch(`${base}/exchanges/${record.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${origin.token}` }, signal: AbortSignal.timeout(20000),
      });
      if (scenario === 'concurrente') {
        const responses = await raceBalance(p, [remove, remove]);
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
        assert.equal(await balance(p), 1110);
        const eurSaldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: eur.id } } });
        assert.equal(Number(eurSaldo.cantidad), 900); assert.equal(Number(eurSaldo.billetes), 900);
        assert.equal(await prisma.cambioDivisa.count({ where: { id: record.id } }), 0);
        const movements = await prisma.movimientoSaldo.findMany({ where: { referencia_id: record.id } });
        assert.equal(movements.length, 2);
        for (const m of movements) assert.equal(Number(m.saldo_nuevo) - Number(m.saldo_anterior), Number(m.monto));
      } else {
        const snapshot = async () => JSON.stringify({
          cambio: await prisma.cambioDivisa.findUnique({ where: { id: record.id } }),
          saldos: await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { id: 'asc' } }),
          movimientos: await prisma.movimientoSaldo.count({ where: { referencia_id: record.id } }),
        });
        const before = await snapshot();
        assert.equal((await remove()).status, 409);
        assert.equal(await snapshot(), before);
      }
    });
  }
  for (const action of ['cerrar', 'completar', 'complete-partial']) {
    for (const initialPayment of [false, true]) {
    await check(`Flujo API ${action}: abono ${initialPayment ? 'en creacion' : 'posterior'} contabiliza exactamente el total`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `FLUJO REAL ${action} ${initialPayment}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      for (const m of [usd, eur]) await prisma.saldo.create({ data: {
        punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25,
      } });
      const created = await post('/exchanges', { ...exchange, punto_atencion_id: p.id,
        saldo_pendiente: initialPayment ? 55 : 110, ...(initialPayment ? { abono_inicial_monto: 55 } : {}),
      }, randomUUID(), origin.token);
      ok(created); const id = created.body.exchange.id;
      const snapshot = async () => JSON.stringify({
        saldos: await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { id: 'asc' } }),
        movimientos: await prisma.movimientoSaldo.findMany({ where: { referencia_id: id }, orderBy: { id: 'asc' } }),
      });
      const before = await snapshot();
      if (!initialPayment) assert.equal((await patchExchange(id, 'register-partial-payment', origin.token)).status, 200);
      const result = await patchExchange(id, action, origin.token);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      if (!initialPayment) assert.equal(await snapshot(), before);
      const actual = JSON.parse(await snapshot());
      for (const [currencyId, expected, net] of [[usd.id, 890, -110], [eur.id, 1100, 100]]) {
        const saldo = actual.saldos.find(s => s.moneda_id === currencyId);
        assert.equal(Number(saldo.cantidad), expected); assert.equal(Number(saldo.billetes), expected);
        assert.equal(actual.movimientos.filter(m => m.moneda_id === currencyId).reduce((sum, m) => sum + Number(m.monto), 0), net);
      }
      assert.equal((await prisma.cambioDivisa.findUnique({ where: { id } })).estado, 'COMPLETADO');
    });
    }
  }
  await check('Cierre administrativo parcial bancario requiere revision sin modificar estado', async () => {
    const record = await pendingFixture(permissionPoint.id);
    await prisma.cambioDivisa.update({ where: { id: record.id }, data: { saldo_pendiente: 55, metodo_entrega: 'transferencia' } });
    assert.equal((await patchExchange(record.id, 'complete-partial', origin.token)).status, 409);
    assert.equal((await prisma.cambioDivisa.findUnique({ where: { id: record.id } })).estado, 'PENDIENTE');
    assert.equal((await patchExchange(record.id, 'complete-partial', readerLogin.body.token)).status, 403);
  });
  for (const action of ['cerrar', 'completar', 'complete-partial']) {
    await check(`Abono con centavos ${action}: efectivo coincide con billetes y monedas en cada paso`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `CENTAVOS ${action}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      for (const m of [usd, eur]) await prisma.saldo.create({ data: {
        punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 500, monedas_fisicas: 500, bancos: 25,
      } });
      const created = await post('/exchanges', { ...exchange, punto_atencion_id: p.id,
        monto_origen: 10, monto_destino: 10, tasa_cambio_billetes: 1, tasa_cambio_monedas: 1,
        divisas_entregadas_billetes: 5, divisas_entregadas_monedas: 5, divisas_entregadas_total: 10,
        divisas_recibidas_billetes: 5, divisas_recibidas_monedas: 5, divisas_recibidas_total: 10,
        abono_inicial_monto: 5.01, saldo_pendiente: 4.99,
      }, randomUUID(), origin.token);
      ok(created);
      const verify = async (amount) => {
        for (const [m, sign] of [[eur, 1], [usd, -1]]) {
          const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: m.id } } });
          assert.equal(Math.round(Number(saldo.cantidad) * 100), 100000 + sign * amount);
          assert.equal(Math.round(Number(saldo.billetes) * 100) + Math.round(Number(saldo.monedas_fisicas) * 100), Math.round(Number(saldo.cantidad) * 100));
          assert.equal(Number(saldo.bancos), 25);
        }
      };
      await verify(501);
      const completed = await patchExchange(created.body.exchange.id, action, origin.token);
      assert.equal(completed.status, 200, JSON.stringify(completed.body));
      await verify(1000);
    });
  }
  for (const mixed of [false, true]) {
  for (const scenario of ['parcial', 'completado', 'cerrar', 'completar', 'abono posterior', 'sustitucion', 'sin evidencia', 'completo sin evidencia', 'evidencia alterada', 'historial ambiguo', 'concurrente', 'fallo recibo']) {
    if (!mixed && ['historial ambiguo', 'completo sin evidencia'].includes(scenario)) continue;
    await check(`Anulacion con evidencia ${mixed ? 'mixta' : 'efectivo'}: ${scenario}`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `ANULACION ${mixed} ${scenario}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      for (const m of [usd, eur]) await prisma.saldo.create({ data: {
        punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, bancos: 25,
        billetes: scenario === 'sustitucion' && m.id === usd.id ? 0 : 500,
        monedas_fisicas: scenario === 'sustitucion' && m.id === usd.id ? 1000 : 500,
      } });
      const balancesSnapshot = () => prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { moneda_id: 'asc' },
        select: { moneda_id: true, cantidad: true, billetes: true, monedas_fisicas: true, bancos: true } });
      const initial = JSON.stringify(await balancesSnapshot());
      const later = scenario === 'abono posterior';
      const created = await post('/exchanges', { ...exchange, punto_atencion_id: p.id,
        monto_origen: 10, monto_destino: 10, tasa_cambio_billetes: 1, tasa_cambio_monedas: 1,
        divisas_entregadas_billetes: 5, divisas_entregadas_monedas: 5, divisas_entregadas_total: 10,
        divisas_recibidas_billetes: 5, divisas_recibidas_monedas: 5, divisas_recibidas_total: 10,
        ...(scenario === 'completo sin evidencia' ? {} : later ? { saldo_pendiente: 10 } : { abono_inicial_monto: 5.01, saldo_pendiente: 4.99 }),
        ...(mixed ? { metodo_pago_origen: 'MIXTO', metodo_entrega: 'mixto',
          usd_recibido_efectivo: 5, usd_recibido_transfer: 5, usd_entregado_efectivo: 5, usd_entregado_transfer: 5 } : {}),
      }, randomUUID(), origin.token);
      ok(created); const id = created.body.exchange.id;
      if (later) {
        const response = await fetch(`${base}/exchanges/${id}/register-partial-payment`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${origin.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ abono_inicial_monto: 5.01 }),
        }); assert.equal(response.status, 200);
      }
      if (mixed && !later && scenario !== 'completo sin evidencia') {
        const posted = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
        for (const m of [usd, eur]) assert.equal(Math.abs(posted.filter(row => row.moneda_id === m.id)
          .reduce((sum, row) => sum + Math.round(Number(row.monto) * 100), 0)), 501);
      }
      if (['completado', 'cerrar', 'completar'].includes(scenario)) assert.equal((await patchExchange(id, scenario === 'completado' ? 'complete-partial' : scenario, origin.token)).status, 200);
      if (scenario === 'sin evidencia' || scenario === 'completo sin evidencia' || scenario === 'evidencia alterada') {
        const receipt = await prisma.recibo.findFirst({ where: { referencia_id: id } });
        const data = receipt.datos_operacion;
        const key = mixed ? 'balance_delta_v2' : 'cash_delta_v1';
        if (scenario === 'sin evidencia' || scenario === 'completo sin evidencia') delete data[key];
        else if (mixed) data[key][0].bank += 1;
        else { data[key][0].total += 1; data[key][0].bills += 1; }
        await prisma.recibo.update({ where: { id: receipt.id }, data: { datos_operacion: data } });
      }
      if (scenario === 'historial ambiguo') {
        const movement = await prisma.movimientoSaldo.findFirst({ where: { referencia_id: id } });
        await prisma.movimientoSaldo.update({ where: { id: movement.id }, data: { descripcion: 'Efectivo y bancos sin clasificacion' } });
      }
      const snapshot = async () => JSON.stringify({ balances: await balancesSnapshot(),
        exchange: await prisma.cambioDivisa.findUnique({ where: { id } }),
        receipts: await prisma.recibo.findMany({ where: { referencia_id: id }, orderBy: { id: 'asc' } }),
        movements: await prisma.movimientoSaldo.findMany({ where: { referencia_id: id }, orderBy: { id: 'asc' } }),
      });
      const before = await snapshot();
      const remove = () => fetch(`${base}/exchanges/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${origin.token}` }, signal: AbortSignal.timeout(20000) });
      let response;
      if (scenario === 'concurrente') {
        const responses = await raceBalance(p, [remove, remove]);
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
        response = responses.find(r => r.status === 200);
      } else if (scenario === 'fallo recibo') {
        await pool.query(`CREATE FUNCTION reject_reversal_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.referencia_id = '${id}' THEN RAISE EXCEPTION 'Fallo ficticio al borrar recibo'; END IF; RETURN OLD; END $$`);
        await pool.query('CREATE TRIGGER reject_reversal_receipt BEFORE DELETE ON "Recibo" FOR EACH ROW EXECUTE FUNCTION reject_reversal_receipt()');
        try { response = await remove(); } finally {
          await pool.query('DROP TRIGGER reject_reversal_receipt ON "Recibo"');
          await pool.query('DROP FUNCTION reject_reversal_receipt()');
        }
      } else response = await remove();
      if (scenario === 'sin evidencia' || scenario === 'completo sin evidencia' || scenario === 'evidencia alterada' || scenario === 'historial ambiguo') {
        assert.equal(response.status, 409); assert.equal(await snapshot(), before);
      } else if (scenario === 'fallo recibo') {
        assert.equal(response.status, 500); assert.equal(await snapshot(), before);
      } else {
        assert.equal(response.status, 200, await response.text());
        assert.equal(JSON.stringify(await balancesSnapshot()), initial);
        assert.equal(await prisma.cambioDivisa.count({ where: { id } }), 0);
        assert.equal(await prisma.recibo.count({ where: { referencia_id: id } }), 0);
        const movements = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
        for (const m of [usd, eur]) assert.equal(movements.filter(row => row.moneda_id === m.id)
          .reduce((sum, row) => sum + Math.round(Number(row.monto) * 100), 0), 0);
      }
    });
  }
  }
  const gbp = await prisma.moneda.create({ data: { codigo: 'GBP', nombre: 'Libra ficticia', simbolo: 'GBP', comportamiento_compra: 'MULTIPLICA', comportamiento_venta: 'DIVIDE' } });
  for (const [sourceCurrency, destinationCurrency, operation] of [[eur, usd, 'COMPRA'], [usd, eur, 'VENTA'], [gbp, eur, 'COMPRA']]) {
  for (const [sourceMethod, deliveryMethod] of [['EFECTIVO', 'efectivo'], ['BANCO', 'efectivo'], ['BANCO', 'transferencia'], ['EFECTIVO', 'transferencia'], ['MIXTO', 'efectivo'], ['EFECTIVO', 'mixto'], ['MIXTO', 'mixto']]) {
    for (const partial of [false, true]) {
    for (const settlementAction of partial ? ['sin liquidar', 'cerrar', 'completar', 'complete-partial'] : [null]) {
      await check(`${operation} ${sourceCurrency.codigo}/${destinationCurrency.codigo}: ${sourceMethod}/${deliveryMethod} ${partial ? settlementAction : 'completo'} conserva y revierte caja y bancos`, async () => {
        const p = await prisma.puntoAtencion.create({ data: { nombre: `VIAS ${sourceCurrency.codigo} ${destinationCurrency.codigo} ${sourceMethod} ${deliveryMethod} ${partial} ${settlementAction}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
        for (const m of [sourceCurrency, destinationCurrency]) await prisma.saldo.create({ data: {
          punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25,
        } });
        const fraction = partial ? 0.5 : 1;
        const sourceCash = (sourceMethod === 'EFECTIVO' ? 100 : sourceMethod === 'BANCO' ? 0 : 40) * fraction;
        const sourceBank = 100 * fraction - sourceCash;
        const destinationCash = (deliveryMethod === 'efectivo' ? 110 : deliveryMethod === 'transferencia' ? 0 : 60) * fraction;
        const destinationBank = 110 * fraction - destinationCash;
        const result = await post('/exchanges', { ...exchange, punto_atencion_id: p.id,
          moneda_origen_id: sourceCurrency.id, moneda_destino_id: destinationCurrency.id, tipo_operacion: operation,
          // Older clients can send the USD equivalent here for non-USD delivery.
          divisas_recibidas_total: destinationCurrency.codigo === 'USD' ? 110 : 100,
          metodo_pago_origen: sourceMethod, metodo_entrega: deliveryMethod,
          usd_recibido_efectivo: 40, usd_recibido_transfer: 60,
          usd_entregado_efectivo: 60, usd_entregado_transfer: 50,
          transferencia_banco: 'BANCO FICTICIO', transferencia_numero: 'REFERENCIA FICTICIA',
          ...(partial ? { abono_inicial_monto: 55, saldo_pendiente: 55 } : {}),
        }, randomUUID(), origin.token);
        ok(result); const id = result.body.exchange.id;
        assert.equal(Number((await prisma.cambioDivisa.findUnique({ where: { id } })).divisas_recibidas_total), 110);
        const movements = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
        assert.equal(movements.length, [sourceCash, sourceBank, destinationCash, destinationBank].filter(n => n > 0).length);
        for (const [m, cashDelta, bankDelta] of [[sourceCurrency, sourceCash, sourceBank], [destinationCurrency, -destinationCash || 0, -destinationBank || 0]]) {
          const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: m.id } } });
          assert.equal(Number(saldo.cantidad), 1000 + cashDelta);
          assert.equal(Number(saldo.billetes), 1000 + cashDelta);
          assert.equal(Number(saldo.monedas_fisicas), 0);
          assert.equal(Number(saldo.bancos), 25 + bankDelta);
          const rows = movements.filter(row => row.moneda_id === m.id);
          assert.equal(rows.filter(row => /\bbancos?\b/i.test(row.descripcion)).reduce((sum, row) => sum + Number(row.monto), 0), bankDelta);
          assert.equal(rows.filter(row => !/\bbancos?\b/i.test(row.descripcion)).reduce((sum, row) => sum + Number(row.monto), 0), cashDelta);
          for (const row of rows) assert.equal(Number(row.saldo_nuevo) - Number(row.saldo_anterior), Number(row.monto));
        }
        if (partial && settlementAction !== 'sin liquidar') {
          if (settlementAction === 'cerrar' && [sourceCurrency.codigo, destinationCurrency.codigo].includes('USD')) {
            const responses = await raceBalance(p, [
              () => patchExchange(id, settlementAction, origin.token),
              () => patchExchange(id, settlementAction, origin.token),
            ]);
            assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
          } else {
            const response = await patchExchange(id, settlementAction, origin.token);
            assert.equal(response.status, 200, JSON.stringify(response));
          }
          const posted = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
          for (const [m, cashDelta, bankDelta] of [[sourceCurrency, sourceCash * 2, sourceBank * 2], [destinationCurrency, -destinationCash * 2 || 0, -destinationBank * 2 || 0]]) {
            const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: m.id } } });
            assert.equal(Number(saldo.cantidad), 1000 + cashDelta);
            assert.equal(Number(saldo.billetes), 1000 + cashDelta);
            assert.equal(Number(saldo.bancos), 25 + bankDelta);
            const rows = posted.filter(row => row.moneda_id === m.id);
            assert.equal(rows.filter(row => /\bbancos?\b/i.test(row.descripcion)).reduce((sum, row) => sum + Number(row.monto), 0), bankDelta);
            assert.equal(rows.filter(row => !/\bbancos?\b/i.test(row.descripcion)).reduce((sum, row) => sum + Number(row.monto), 0), cashDelta);
          }
          assert.equal(await prisma.recibo.count({ where: { referencia_id: id } }), 2);
          assert.equal((await prisma.cambioDivisa.findUnique({ where: { id } })).estado, 'COMPLETADO');
        }
        const removed = await fetch(`${base}/exchanges/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${origin.token}` } });
        assert.equal(removed.status, 200, await removed.text());
        assert.equal(await prisma.cambioDivisa.count({ where: { id } }), 0);
        assert.equal(await prisma.recibo.count({ where: { referencia_id: id } }), 0);
        const reversed = await prisma.movimientoSaldo.findMany({ where: { referencia_id: id } });
        for (const m of [sourceCurrency, destinationCurrency]) {
          const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: m.id } } });
          assert.equal(Number(saldo.cantidad), 1000);
          assert.equal(Number(saldo.billetes), 1000);
          assert.equal(Number(saldo.monedas_fisicas), 0);
          assert.equal(Number(saldo.bancos), 25);
          for (const bank of [false, true]) assert.equal(reversed.filter(row => row.moneda_id === m.id && /\bbancos?\b/i.test(row.descripcion) === bank)
            .reduce((sum, row) => sum + Math.round(Number(row.monto) * 100), 0), 0);
        }
      });
    }
    }
  }
  }
  for (const nonUsd of [false, true]) {
  for (const side of ['origen', 'destino']) {
    for (const invalid of ['negativo', 'suma incorrecta', 'omitido']) {
      await check(`Desglose mixto ${nonUsd ? 'VENTA USD/EUR' : 'COMPRA EUR/USD'} ${side} ${invalid}: rechaza sin escrituras contables`, async () => {
        const p = await prisma.puntoAtencion.create({ data: { nombre: `INVALIDO ${nonUsd} ${side} ${invalid}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
        for (const m of [usd, eur]) await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
        const body = { ...exchange, punto_atencion_id: p.id,
          ...(nonUsd ? { moneda_origen_id: usd.id, moneda_destino_id: eur.id, tipo_operacion: 'VENTA' } : {}),
          metodo_pago_origen: side === 'origen' ? 'MIXTO' : 'EFECTIVO', metodo_entrega: side === 'destino' ? 'mixto' : 'efectivo' };
        if (invalid !== 'omitido') {
          const prefix = side === 'origen' ? 'usd_recibido' : 'usd_entregado';
          body[`${prefix}_efectivo`] = invalid === 'negativo' ? -10 : 10;
          body[`${prefix}_transfer`] = invalid === 'negativo' ? (side === 'origen' ? 110 : 120) : 10;
        }
        const snapshot = async () => JSON.stringify({
          saldos: await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { id: 'asc' } }),
          cambios: await prisma.cambioDivisa.count({ where: { punto_atencion_id: p.id } }),
          movimientos: await prisma.movimientoSaldo.count({ where: { punto_atencion_id: p.id } }),
          recibos: await prisma.recibo.count({ where: { punto_atencion_id: p.id } }),
        });
        const before = await snapshot();
        const response = await post('/exchanges', body, randomUUID(), origin.token);
        assert.equal(response.status, 400, JSON.stringify(response));
        assert.equal(await snapshot(), before);
      });
    }
  }
  }
  for (const scenario of ['ya contabilizado', 'historial ambiguo', 'cambio de via']) {
    await check(`Liquidacion mixta: ${scenario}`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `LIQUIDACION ${scenario}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      for (const m of [usd, eur]) await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
      const created = await post('/exchanges', { ...exchange, punto_atencion_id: p.id,
        metodo_pago_origen: 'MIXTO', metodo_entrega: 'mixto',
        usd_recibido_efectivo: 40, usd_recibido_transfer: 60, usd_entregado_efectivo: 60, usd_entregado_transfer: 50,
        ...(scenario === 'ya contabilizado' ? { saldo_pendiente: 110 } : { abono_inicial_monto: 55, saldo_pendiente: 55 }),
      }, randomUUID(), origin.token);
      ok(created); const id = created.body.exchange.id;
      if (scenario === 'ya contabilizado') assert.equal((await patchExchange(id, 'register-partial-payment', origin.token)).status, 200);
      if (scenario === 'historial ambiguo') {
        const row = await prisma.movimientoSaldo.findFirst({ where: { referencia_id: id } });
        await prisma.movimientoSaldo.update({ where: { id: row.id }, data: { descripcion: 'Movimiento legado sin clasificacion' } });
      }
      const snapshot = async () => JSON.stringify({
        saldos: await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { id: 'asc' } }),
        movimientos: await prisma.movimientoSaldo.findMany({ where: { referencia_id: id }, orderBy: { id: 'asc' } }),
      });
      const before = await snapshot();
      const beforeExchange = JSON.stringify(await prisma.cambioDivisa.findUnique({ where: { id } }));
      const result = scenario === 'cambio de via'
        ? await fetch(`${base}/exchanges/${id}/completar`, { method: 'PATCH', headers: { Authorization: `Bearer ${origin.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ metodo_entrega: 'efectivo' }) })
        : await patchExchange(id, 'completar', origin.token);
      assert.equal(result.status, scenario === 'ya contabilizado' ? 200 : 409);
      assert.equal(await snapshot(), before);
      const after = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (scenario === 'ya contabilizado') assert.equal(after.estado, 'COMPLETADO');
      else assert.equal(JSON.stringify(after), beforeExchange);
      assert.equal(await prisma.recibo.count({ where: { referencia_id: id } }), scenario === 'ya contabilizado' ? 2 : 1);
    });
  }
  for (const sameUser of [false, true]) {
    await check(`Seleccion simultanea: ${sameUser ? 'un operador y dos puntos' : 'dos operadores y un punto'}`, async () => {
      const p = await prisma.puntoAtencion.create({ data: { nombre: `SELECCION ${sameUser}`, direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
      const p2 = sameUser ? await prisma.puntoAtencion.create({ data: { nombre: 'SELECCION alternativa', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } }) : p;
      const people = [];
      for (let i = 0; i < (sameUser ? 1 : 2); i++) {
        const u = await prisma.usuario.create({ data: { username: `select_${sameUser}_${i}`, nombre: 'Operador seleccion ficticio',
          password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR' } });
        const login = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' }); ok(login);
        assert.equal(login.body.hasActiveJornada, false);
        assert.equal(await prisma.jornada.count({ where: { usuario_id: u.id } }), 0);
        people.push({ ...u, token: login.body.token });
      }
      const freePoints = async t => {
        const res = await fetch(base + '/points', { headers: { Authorization: `Bearer ${t}` } });
        assert.equal(res.status, 200); return (await res.json()).points;
      };
      for (const u of people) assert.ok((await freePoints(u.token)).some(row => row.id === p.id));
      const blocker = new Client({ connectionString: url }); await blocker.connect();
      let requests;
      try {
        await blocker.query('BEGIN');
        await blocker.query(sameUser ? 'SELECT id FROM "Usuario" WHERE id=$1 FOR UPDATE' : 'SELECT id FROM "PuntoAtencion" WHERE id=$1 FOR UPDATE', [sameUser ? people[0].id : p.id]);
        requests = [p, p2].map((target, i) => {
          const u = people[sameUser ? 0 : i];
          return post('/schedules', { usuario_id: u.id, punto_atencion_id: target.id, fecha_inicio: new Date().toISOString() }, undefined, u.token);
        });
        let waiting = 0;
        for (let attempt = 0; attempt < 150 && waiting < 2; attempt++) {
          const result = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'");
          waiting = result.rows[0].n;
          if (waiting < 2) await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.ok(waiting >= 2, 'Ambas selecciones deben coincidir antes de liberar el bloqueo');
      } finally { await blocker.query('ROLLBACK'); await blocker.end(); }
      const responses = await Promise.all(requests);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409], JSON.stringify(responses));
      const schedules = await prisma.jornada.findMany({ where: { usuario_id: { in: people.map(u => u.id) } } });
      assert.equal(schedules.length, 1);
      const started = schedules[0];
      const winner = people.find(u => u.id === started.usuario_id);
      assert.equal((await prisma.usuario.findUnique({ where: { id: winner.id } })).punto_atencion_id, started.punto_atencion_id);
      if (sameUser) return;
      const loser = people.find(u => u.id !== winner.id);
      assert.equal((await prisma.usuario.findUnique({ where: { id: loser.id } })).punto_atencion_id, null);
      assert.ok(!(await freePoints(loser.token)).some(row => row.id === p.id));
      for (const m of currencies) {
        await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: 1000, billetes: 1000, bancos: 25 } });
        await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: winner.id } });
      }
      const payload = { ...exchange, punto_atencion_id: p.id };
      assert.equal((await post('/exchanges', payload, randomUUID(), winner.token)).status, 403);
      const opened = await post('/apertura-caja/iniciar', { jornada_id: started.id }, undefined, winner.token); ok(opened);
      const aid = opened.body.apertura.id;
      assert.equal((await post('/apertura-caja/confirmar', { apertura_id: aid }, undefined, winner.token)).status, 400);
      assert.equal((await post('/exchanges', payload, randomUUID(), winner.token)).status, 403);
      ok(await post('/apertura-caja/conteo', { apertura_id: aid, conteos: currencies.map(m => ({
        moneda_id: m.id, billetes: [{ denominacion: 100, cantidad: 10 }], monedas: [], total: 1000,
      })) }, undefined, winner.token));
      assert.equal((await post('/exchanges', payload, randomUUID(), winner.token)).status, 403);
      ok(await post('/apertura-caja/confirmar', { apertura_id: aid }, undefined, winner.token));
      ok(await post('/exchanges', payload, randomUUID(), winner.token));
      const saldo = await prisma.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: usd.id } } });
      assert.equal(Number(saldo.cantidad), 890);
      assert.equal(Number(saldo.bancos), 25);
    });
  }
  await check('Apertura por etapas: prioridad, pendientes, bloqueo SQL, conteo posterior y cierre', async () => {
    const p = await prisma.puntoAtencion.create({ data: { nombre: 'ETAPAS LOCAL', direccion: 'Ficticia', ciudad: 'Quito', provincia: 'Pichincha' } });
    const u = await prisma.usuario.create({ data: { username: 'etapas_local', nombre: 'Operador etapas ficticio',
      password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR' } });
    const chf = await prisma.moneda.create({ data: { codigo: 'CHF', nombre: 'Franco prueba', simbolo: 'CHF' } });
    const gbp = await prisma.moneda.findUniqueOrThrow({ where: { codigo: 'GBP' } });
    const prior = new Date(Date.now() - 3 * 86400000);
    await prisma.jornada.create({ data: { usuario_id: u.id, punto_atencion_id: p.id, fecha_inicio: prior,
      fecha_salida: new Date(prior.getTime() + 3600000), estado: 'COMPLETADO' } });
    for (const m of [usd, eur, gbp, chf]) {
      await prisma.saldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad: m.id === gbp.id ? 1010 : 1000,
        billetes: m.id === chf.id ? 0 : m.id === gbp.id ? 1010 : 1000, monedas_fisicas: m.id === chf.id ? 1000 : 0, bancos: 25 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: u.id } });
    }
    for (const [m, description] of [[gbp, 'Transferencia recibida (CAJA)'], [chf, 'Ingreso bancos']]) {
      await prisma.movimientoSaldo.create({ data: { punto_atencion_id: p.id, moneda_id: m.id, usuario_id: u.id,
        tipo_movimiento: 'INGRESO', monto: 10, saldo_anterior: 1000, saldo_nuevo: 1010,
        fecha: new Date(prior.getTime() + 1000), descripcion: description } });
    }
    const login = await post('/auth/login', { username: u.username, password: 'PruebaLocal_123!' }); ok(login);
    const t = login.body.token;
    ok(await post('/schedules', { usuario_id: u.id, punto_atencion_id: p.id, fecha_inicio: new Date().toISOString() }, undefined, t));
    const j = await prisma.jornada.findFirstOrThrow({ where: { usuario_id: u.id, estado: 'ACTIVO' } });
    const init = await post('/apertura-caja/iniciar', { jornada_id: j.id }, undefined, t); ok(init);
    const a = init.body.apertura;
    assert.deepEqual(a.saldo_esperado.filter(c => c.obligatoria_inicio).map(c => c.codigo).sort(), ['EUR', 'GBP', 'USD']);
    const counts = [usd, eur, gbp].map(m => ({ moneda_id: m.id, billetes: [{ denominacion: m.id === eur.id ? 1 : 10, cantidad: m.id === eur.id ? 999 : m.id === gbp.id ? 101 : 100 }], monedas: m.id === eur.id ? [{ denominacion: 0.25, cantidad: 3 }, { denominacion: 0.01, cantidad: 25 }] : [] }));
    assert.equal((await post('/apertura-caja/conteo', { apertura_id: a.id, conteos: counts.slice(0, 2) }, undefined, t)).status, 400);
    ok(await post('/apertura-caja/conteo', { apertura_id: a.id, conteos: counts }, undefined, t));
    ok(await post('/apertura-caja/confirmar', { apertura_id: a.id }, undefined, t));
    const saved = await prisma.aperturaCaja.findUniqueOrThrow({ where: { id: a.id } });
    assert.ok(!saved.conteo_fisico.some(c => c.moneda_id === chf.id));
    assert.deepEqual(saved.conteo_fisico.find(c => c.moneda_id === eur.id).monedas, counts.find(c => c.moneda_id === eur.id).monedas);
    assert.ok(!saved.diferencias.some(c => c.moneda_id === chf.id));
    const cuadre = await prisma.cuadreCaja.findFirstOrThrow({ where: { punto_atencion_id: p.id } });
    assert.equal(await prisma.detalleCuadreCaja.count({ where: { cuadre_id: cuadre.id, moneda_id: chf.id } }), 0);
    const payload = { ...exchange, punto_atencion_id: p.id, moneda_origen_id: chf.id };
    const balancesBefore = await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { moneda_id: 'asc' } });
    assert.equal((await post('/exchanges', payload, randomUUID(), t)).status, 409);
    assert.deepEqual(await prisma.saldo.findMany({ where: { punto_atencion_id: p.id }, orderBy: { moneda_id: 'asc' } }), balancesBefore);
    // Even a writer bypassing HTTP cannot change this pending physical balance.
    await assert.rejects(pool.query('UPDATE "Saldo" SET cantidad=cantidad+1 WHERE punto_atencion_id=$1 AND moneda_id=$2', [p.id, chf.id]), /PENDING_CURRENCY_COUNT/);
    await pool.query('UPDATE "Saldo" SET bancos=bancos+1 WHERE punto_atencion_id=$1 AND moneda_id=$2', [p.id, chf.id]);
    const { assertCurrencyCounted } = await import('../../server/utils/stagedOpening.ts');
    await assert.rejects(prisma.$transaction(tx => assertCurrencyCounted(tx, p.id, chf.id)), /conteo/);
    const closeStaged = async () => {
      const balances = await prisma.saldo.findMany({ where: { punto_atencion_id: p.id } });
      return post('/guardar-cierre', { detalles: balances.map(s => ({ moneda_id: s.moneda_id,
        saldo_apertura: 1000, saldo_cierre: Number(s.cantidad), conteo_fisico: Number(s.cantidad),
        billetes: Number(s.billetes), monedas: Number(s.monedas_fisicas), bancos_teorico: Number(s.bancos), conteo_bancos: Number(s.bancos),
        desglose_denominaciones: [
          { denominacion: 1, cantidad: Number(s.billetes), tipo: 'BILLETE' },
          { denominacion: 0.01, cantidad: Math.round(Number(s.monedas_fisicas) * 100), tipo: 'MONEDA' },
        ],
      })) }, randomUUID(), t);
    };
    assert.equal((await closeStaged()).status, 409);
    await assert.rejects(pool.query('UPDATE "Jornada" SET estado=\'COMPLETADO\',fecha_salida=now() WHERE id=$1', [j.id]), /PENDING_CURRENCY_COUNT/);
    const countBody = { apertura_id: a.id, moneda_id: chf.id, saldo_esperado: 1000, billetes: [], monedas: [{ denominacion: 0.25, cantidad: 3996 }, { denominacion: 0.01, cantidad: 100 }] };
    assert.equal((await post('/apertura-caja/conteo-pendiente', { ...countBody, saldo_esperado: 999 }, undefined, t)).status, 409);
    assert.equal((await post('/apertura-caja/conteo-pendiente', { ...countBody, billetes: [{ denominacion: 100, cantidad: -10 }] }, undefined, t)).status, 400);
    const simultaneous = await Promise.all([1, 2].map(() => post('/apertura-caja/conteo-pendiente', countBody, undefined, t)));
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409]);
    const after = await prisma.aperturaCaja.findUniqueOrThrow({ where: { id: a.id } });
    assert.deepEqual(after.conteo_fisico.filter(c => c.moneda_id !== chf.id), saved.conteo_fisico);
    assert.equal(after.estado, 'ABIERTA');
    assert.deepEqual(after.conteo_fisico.find(c => c.moneda_id === chf.id).monedas, countBody.monedas);
    assert.ok(after.conteo_fisico.find(c => c.moneda_id === chf.id).contado_en);
    assert.equal(Number((await prisma.detalleCuadreCaja.findUniqueOrThrow({ where: { cuadre_id_moneda_id: { cuadre_id: cuadre.id, moneda_id: chf.id } } })).saldo_apertura), 1000);
    await prisma.$transaction(tx => assertCurrencyCounted(tx, p.id, chf.id));
    ok(await post('/exchanges', payload, randomUUID(), t));
    assert.equal(Number((await prisma.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: p.id, moneda_id: chf.id } } })).bancos), 26);
    ok(await closeStaged());
    const closedDetail = await prisma.detalleCuadreCaja.findUniqueOrThrow({ where: { cuadre_id_moneda_id: { cuadre_id: cuadre.id, moneda_id: chf.id } } });
    assert.deepEqual(closedDetail.desglose_denominaciones.find(d => d.tipo === 'MONEDA'), { denominacion: 0.01, cantidad: 100000, tipo: 'MONEDA' });
    assert.equal((await prisma.jornada.findUniqueOrThrow({ where: { id: j.id } })).estado, 'COMPLETADO');
  });
  await (await import('./metal-purchases-integration.mjs')).testMetalPurchases({ prisma, pool, base, post, ok, check, usd, eur, bcrypt, browserMode });
  if (browserMode) {
    const browserPoint = await prisma.puntoAtencion.create({ data: { nombre: '000 PRUEBA ETAPAS', direccion: 'Solo local', ciudad: 'Quito', provincia: 'Pichincha' } });
    await prisma.usuario.create({ data: { username: 'navegador_etapas', nombre: 'Operador etapas navegador',
      password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'OPERADOR' } });
    for (const m of await prisma.moneda.findMany({ where: { activo: true } })) {
      await prisma.saldo.create({ data: { punto_atencion_id: browserPoint.id, moneda_id: m.id, cantidad: 1000, billetes: 1000 } });
      await prisma.saldoInicial.create({ data: { punto_atencion_id: browserPoint.id, moneda_id: m.id, cantidad_inicial: 1000, asignado_por: user.id } });
    }
    await prisma.usuario.create({ data: { username: 'navegador_local', nombre: 'Administrador ficticio navegador',
      password: await bcrypt.hash('PruebaLocal_123!', 10), rol: 'ADMIN', punto_atencion_id: permissionPoint.id } });
    console.log(JSON.stringify({ browserUrl: 'http://127.0.0.1:4173', finishFile: path.join(runDir, 'finish-browser') }));
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      try { await fs.access(path.join(runDir, 'finish-browser')); break; } catch { /* wait for local QA */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
} catch (error) {
  process.exitCode = 1;
  console.error('Prueba detenida:', error.message);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma?.$disconnect();
  await pool?.end();
  if (started) await control(['-D', cluster, '-m', 'fast', '-w', 'stop']);
  console.warn = originalWarn;
  const report = { runDir, results, diagnostics, databaseStopped: started };
  await fs.writeFile(path.join(runDir, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
