// Isolated local PostgreSQL only. Never loads .env or uses an existing DATABASE_URL.
// node --import tsx scripts/tests/marcaciones-integration.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import express from 'express';
import jwt from 'jsonwebtoken';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bin = path.join(root, 'node_modules/.cache/pg-sandbox-runtime/node_modules/@embedded-postgres/windows-x64/native/bin');
await fs.access(path.join(bin, 'initdb.exe'));
const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-marcaciones-'));
const cluster = path.join(runDir, 'postgres');
const password = randomBytes(24).toString('hex');
const url = `postgresql://pc_test:${password}@127.0.0.1:55440/postgres`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|WINDIR|PATH|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|COMSPEC)$/i.test(key)));
Object.assign(env, { NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: randomBytes(32).toString('hex'), TZ: 'America/Guayaquil' });
const exec = promisify(execFile);
const command = (file, args) => exec(file, args, { cwd: runDir, env, windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
const control = args => new Promise((resolve, reject) => {
  const child = spawn(path.join(bin, 'pg_ctl.exe'), args, { cwd: runDir, env, windowsHide: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl: ${code}`)));
});
let started = false, server, prisma, pool;
const warnings = console.warn;
console.warn = () => {};
try {
  const pwfile = path.join(runDir, 'pw');
  await fs.writeFile(pwfile, password);
  await command(path.join(bin, 'initdb.exe'), ['-D', cluster, '-U', 'pc_test', '--pwfile', pwfile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
  await fs.unlink(pwfile);
  await control(['-D', cluster, '-l', path.join(runDir, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55440', '-w', 'start']);
  started = true;
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    assert.equal(path.resolve((await db.query('SHOW data_directory')).rows[0].data_directory).toLowerCase(), cluster.toLowerCase());
    const { stdout } = await command(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script']);
    await db.query(stdout);
  } finally { await db.end(); }
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  process.chdir(runDir);
  prisma = (await import('../../server/lib/prisma.ts')).default;
  pool = (await import('../../server/lib/database.ts')).pool;
  const app = express();
  app.use('/api/admin/marcaciones', (await import('../../server/routes/admin-marcaciones.ts')).default);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/marcaciones`;
  const point = await prisma.puntoAtencion.create({ data: { nombre: 'Oficina ficticia', direccion: 'Dirección de prueba', ciudad: 'Quito', provincia: 'Pichincha' } });
  const users = {};
  for (const rol of ['ADMIN', 'SUPER_USUARIO', 'ADMINISTRATIVO', 'OPERADOR']) users[rol] = await prisma.usuario.create({ data: { username: rol, nombre: rol, password: 'unused-test-only', rol } });
  const employee = await prisma.usuario.create({ data: { username: 'inactivo', nombre: 'Histórico inactivo', password: 'unused-test-only', rol: 'OPERADOR', activo: false } });
  const jornada = await prisma.jornada.create({ data: {
    usuario_id: employee.id, punto_atencion_id: point.id, estado: 'COMPLETADO',
    fecha_inicio: new Date('2026-08-31T04:59:59Z'), fecha_almuerzo: new Date('2026-08-31T05:00:00Z'),
    fecha_regreso: new Date('2026-09-29T17:00:00Z'), fecha_salida: new Date('2026-09-30T04:59:59Z'),
    ubicacion_inicio: { lat: -0.2, lng: -78.5 }, ubicacion_salida: { lat: -0.21, lng: -78.51, accuracy: 25, dispositivo: 'MOVIL' },
  } });
  await prisma.jornada.create({ data: { usuario_id: employee.id, punto_atencion_id: point.id, fecha_inicio: new Date('2026-09-30T05:00:00Z') } });
  await prisma.salidaEspontanea.create({ data: { usuario_id: employee.id, punto_atencion_id: point.id, motivo: 'OTRO',
    fecha_salida: new Date('2026-09-29T18:00:00Z'), fecha_regreso: new Date('2026-09-29T19:00:00Z'),
    ubicacion_salida: { lat: 0, lng: 0 }, ubicacion_regreso: { lat: 0, lng: -78.5 } } });
  const request = async (rol, params = {}, authenticated = true) => {
    const query = new URLSearchParams({ from: '2026-08-31', to: '2026-09-29', ...params });
    const response = await fetch(`${base}?${query}`, { headers: authenticated ? { Authorization: `Bearer ${jwt.sign({ id: users[rol].id }, env.JWT_SECRET)}` } : {} });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  assert.equal((await request('ADMIN', {}, false)).status, 401);
  for (const role of ['OPERADOR', 'ADMINISTRATIVO']) assert.equal((await request(role)).status, 403);
  for (const role of ['ADMIN', 'SUPER_USUARIO']) {
    const response = await request(role);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.cache, 'no-store');
    assert.deepEqual(response.body.data.summary, { total: 5, conUbicacion: 2, sinUbicacion: 3, usuarios: 1 });
    assert.ok(response.body.data.users.some(u => u.id === employee.id && !u.activo));
    assert.ok(response.body.data.events.filter(e => ['ALMUERZO', 'REGRESO'].includes(e.tipo)).every(e => e.ubicacion === null));
    assert.equal(response.body.data.events.find(e => e.tipo === 'SALIDA')?.fecha, '2026-09-30T04:59:59.000Z', JSON.stringify(response.body.data.events.map(e => ({ tipo: e.tipo, fecha: e.fecha }))));
    assert.equal(response.body.data.events.find(e => e.tipo === 'SALIDA').dispositivo, 'MOVIL');
  }
  console.log('PASS: autenticación, roles, inactivos, límites de fecha Ecuador, datos GPS por evento');
  const page = (await request('ADMIN', { pageSize: '2', page: '2' })).body.data;
  assert.equal(page.events.length, 2); assert.equal(page.total, 5); assert.equal(page.markers.length, 2);
  assert.equal((await request('ADMIN', { ubicacion: 'con' })).body.data.total, 2);
  assert.equal((await request('ADMIN', { ubicacion: 'sin' })).body.data.total, 3);
  assert.equal((await request('ADMIN', { tipo: 'ENTRADA' })).body.data.total, 0);
  assert.equal((await request('ADMIN', { usuario_id: users.ADMIN.id })).body.data.total, 0);
  assert.equal((await request('ADMIN', { punto_atencion_id: point.id })).body.data.total, 5);
  for (const params of [{ from: '2026-02-30' }, { from: '2026-09-30' }, { from: '2025-01-01' }, { page: '0' }, { pageSize: '101' }, { usuario_id: "' OR 1=1" }]) assert.equal((await request('ADMIN', params)).status, 400);
  const { normalizeMarcacion, buildMarcacionesReport, marcacionesQuery } = await import('../../server/services/marcacionesReport.ts');
  const row = { registro_id: jornada.id, usuario_id: employee.id, punto_atencion_id: point.id, origen: 'Jornada', tipo: 'ENTRADA', fecha: new Date(), estado: 'ACTIVO', nombre: 'Prueba', username: 'test', punto: 'test', direccion_punto: 'test', observaciones: null };
  for (const ubicacion of [null, { lat: 0, lng: 0 }, { lat: 95, lng: 20 }, { lat: '-0.2', lng: -78.5 }, { lat: -0.2, lng: -78.5, sin_gps: true }]) assert.equal(normalizeMarcacion({ ...row, ubicacion }).ubicacion, null);
  const many = buildMarcacionesReport(Array.from({ length: 1001 }, (_, i) => ({ ...row, registro_id: String(i), ubicacion: { lat: -0.2, lng: -78.5 } })), marcacionesQuery.parse({ from: '2026-09-01', to: '2026-09-29' }));
  assert.equal(many.markers.length, 1000); assert.equal(many.markersTotal, 1001); assert.equal(many.total, 1001);
  console.log('PASS: paginación, filtros, validación, GPS inválido y límite explícito de marcadores');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma?.$disconnect(); await pool?.end();
  if (started) await control(['-D', cluster, '-m', 'fast', '-w', 'stop']);
  console.warn = warnings;
  console.log('Base aislada detenida:', runDir);
}
