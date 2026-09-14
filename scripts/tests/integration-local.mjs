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
  try { await db.query(schemaSql); } finally { await db.end(); }
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
  app.use(express.json());
  for (const [mount, module] of [
    ['/api/auth', '../../server/routes/auth.ts'],
    ['/api/apertura-caja', '../../server/routes/apertura-caja.ts'],
    ['/api/exchanges', '../../server/routes/exchanges.ts'],
    ['/api/guardar-cierre', '../../server/routes/guardar-cierre.ts'],
    ['/api/cuadre-caja', '../../server/routes/cuadreCaja.ts'],
    ['/api/cuadre-caja', '../../server/routes/cuadre-caja-conteo.ts'],
    ['/api/transfers', '../../server/routes/transfers.ts'],
    ['/api/transfer-approvals', '../../server/routes/transfer-approvals.ts'],
  ]) app.use(mount, (await import(module)).default);
  if (browserMode) {
    for (const [mount, module] of [
      ['/api/points', '../../server/routes/points.ts'],
      ['/api/schedules', '../../server/routes/schedules.ts'],
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
  const transferBody = { origen_id: origin.id, destino_id: destination.id, moneda_id: usd.id, monto: 100,
    tipo_transferencia: 'ENTRE_PUNTOS', via: 'EFECTIVO' };
  const balance = async (p) => {
    const s = await prisma.saldo.findFirst({ where: { punto_atencion_id: p.id, moneda_id: usd.id } });
    assert.equal(Number(s.bancos), 25); assert.equal(Number(s.cantidad), Number(s.billetes) + Number(s.monedas_fisicas));
    return Number(s.cantidad);
  };
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
      body: JSON.stringify({ abono_inicial_monto: 10, metodo_entrega: 'efectivo' }),
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
  for (const action of ['cerrar', 'completar']) {
    for (const scenario of ['concurrente', 'saldo insuficiente', 'fallo recibo']) {
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
            assert.equal(await prisma.movimientoSaldo.count({ where: { referencia_id: record.id } }), 2);
            assert.equal(await prisma.recibo.count({ where: { referencia_id: record.id } }), 1);
          } else {
            const result = await patchExchange(record.id, action, origin.token);
            assert.equal(result.status, scenario === 'saldo insuficiente' ? 400 : 500);
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
  if (browserMode) {
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
