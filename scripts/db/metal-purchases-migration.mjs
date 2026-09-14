// Explicit environment file only. No dotenv auto-loading, no schema synchronization.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Client } from 'pg';

const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, execute: { type: 'boolean' }, check: { type: 'boolean' } } });
if (values.execute && values.check) throw new Error('Elija --execute o --check, no ambos.');
const files = ['2026-09-14-metal-purchases.sql', '2026-09-14-metal-purchases-checks.sql'];
const sql = (await Promise.all(files.map(file => fs.readFile(fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)), 'utf8')))).join('\n');
console.log('Migración aditiva:', files.join(', '));
console.log('SHA-256 del SQL:', createHash('sha256').update(sql).digest('hex'));
if (!values.execute && !values.check) {
  console.log('Simulación: no se abrió ninguna conexión. Use --env-file .env.production --execute tras verificar el respaldo, o --check para consultar el esquema.');
} else {
  if (!values['env-file']) throw new Error('Debe indicar --env-file explícitamente.');
  const env = dotenv.parse(await fs.readFile(values['env-file']));
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL no existe en el archivo indicado.');
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const tables = ['ConfiguracionCompraMetal', 'CompraMetal', 'DetalleCompraMetal', 'EventoCompraMetal'];
  try {
    await client.connect();
    await client.query(values.execute ? 'BEGIN' : 'BEGIN READ ONLY');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    if (values.execute) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:metal-purchases:2026-09-14',0))");
      const existing = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[])', [tables]);
      if (existing.rowCount) throw new Error('Ya existen tablas del módulo. No se reaplica la migración; ejecute --check y revise su estado.');
      await client.query(sql);
    }
    const schema = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[]) ORDER BY tablename', [tables]);
    const checks = await client.query("SELECT conname FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname=ANY($1::text[]) ORDER BY conname", [['CompraMetal_payment_check', 'DetalleCompraMetal_values_check']]);
    if (schema.rowCount !== 4 || checks.rowCount !== 2) throw new Error('Esquema incompleto: se requieren cuatro tablas y dos restricciones de validación.');
    const enabled = await client.query('SELECT count(*)::int AS habilitados FROM "ConfiguracionCompraMetal" WHERE habilitado=true');
    await client.query(values.execute ? 'COMMIT' : 'ROLLBACK');
    console.log(values.execute ? 'Migración aplicada y confirmada.' : 'Esquema de metales presente. Consulta de solo lectura.');
    console.log('Tablas: 4; restricciones de validación: 2; puntos habilitados:', enabled.rows[0].habilitados);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[conexión privada]') : 'Error de migración');
    process.exitCode = 1;
  } finally { await client.end(); }
}
