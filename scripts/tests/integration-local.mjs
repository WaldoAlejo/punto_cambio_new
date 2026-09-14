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
  try { await db.query(schemaSql); } finally { await db.end(); }
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, cleanEnv);
  process.chdir(runDir); // No .env file in this new temporary directory.
  const { default: express } = await import('express');
  const { default: bcrypt } = await import('bcryptjs');
  prisma = (await import('../../server/lib/prisma.ts')).default;
  pool = (await import('../../server/lib/database.ts')).pool;
  const app = express();
  app.use(express.json());
  for (const [mount, module] of [
    ['/api/auth', '../../server/routes/auth.ts'],
    ['/api/apertura-caja', '../../server/routes/apertura-caja.ts'],
    ['/api/exchanges', '../../server/routes/exchanges.ts'],
    ['/api/guardar-cierre', '../../server/routes/guardar-cierre.ts'],
  ]) app.use(mount, (await import(module)).default);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
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
  async function post(route, body, key) {
    const res = await fetch(base + route, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  await check('Cierre exacto conserva saldo y finaliza jornada', async () => {
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
