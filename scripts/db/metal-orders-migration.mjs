// Explicit environment file only. Adds work-order tables for metal evaluation; refuses to reapply.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Client } from 'pg';

const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, execute: { type: 'boolean' }, check: { type: 'boolean' } } });
if (values.execute && values.check) throw new Error('Elija --execute o --check, no ambos.');
const files = ['2026-10-01-metal-orders.sql', '2026-10-01-metal-orders-checks.sql'];
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
  const tables = ['OrdenEvaluacionMetal', 'JoyaOrdenEvaluacion'];
  try {
    await client.connect();
    await client.query(values.execute ? 'BEGIN' : 'BEGIN READ ONLY');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    const purchases = await client.query("SELECT 1 FROM pg_tables WHERE schemaname=current_schema() AND tablename='CompraMetal'");
    if (!purchases.rowCount) throw new Error('Falta la tabla CompraMetal: aplique primero scripts/db/metal-purchases-migration.mjs.');
    if (values.execute) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:metal-orders:2026-10-01',0))");
      const existing = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[])', [tables]);
      if (existing.rowCount) throw new Error('Ya existen tablas de órdenes. No se reaplica la migración; ejecute --check y revise su estado.');
      await client.query(sql);
    }
    const schema = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[])', [tables]);
    const column = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='CompraMetal' AND column_name='orden_id'");
    const checks = await client.query('SELECT conname FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname=ANY($1::text[])', [['OrdenEvaluacionMetal_values_check', 'JoyaOrdenEvaluacion_values_check']]);
    if (schema.rowCount !== 2 || column.rowCount !== 1 || checks.rowCount !== 2) throw new Error('Esquema incompleto: se requieren dos tablas de órdenes, CompraMetal.orden_id y dos restricciones.');
    const orders = await client.query('SELECT count(*)::int AS ordenes FROM "OrdenEvaluacionMetal"');
    await client.query(values.execute ? 'COMMIT' : 'ROLLBACK');
    console.log(values.execute ? 'Migración aplicada y confirmada.' : 'Esquema de órdenes presente. Consulta de solo lectura.');
    console.log('Tablas: 2; columna CompraMetal.orden_id; restricciones: 2; órdenes registradas:', orders.rows[0].ordenes);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[conexión privada]') : 'Error de migración');
    process.exitCode = 1;
  } finally { await client.end(); }
}
