// Explicit environment file only. Adds DetalleCompraMetal.evaluacion (nullable JSONB); safe to re-run.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Client } from 'pg';

const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, execute: { type: 'boolean' }, check: { type: 'boolean' } } });
if (values.execute && values.check) throw new Error('Elija --execute o --check, no ambos.');
const file = '2026-09-30-metal-evaluation.sql';
const sql = await fs.readFile(fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)), 'utf8');
console.log('Migración aditiva:', file);
console.log('SHA-256 del SQL:', createHash('sha256').update(sql).digest('hex'));
if (!values.execute && !values.check) {
  console.log('Simulación: no se abrió ninguna conexión. Use --env-file .env.production --execute tras verificar el respaldo, o --check para consultar el esquema.');
} else {
  if (!values['env-file']) throw new Error('Debe indicar --env-file explícitamente.');
  const env = dotenv.parse(await fs.readFile(values['env-file']));
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL no existe en el archivo indicado.');
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query(values.execute ? 'BEGIN' : 'BEGIN READ ONLY');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    const table = await client.query("SELECT 1 FROM pg_tables WHERE schemaname=current_schema() AND tablename='DetalleCompraMetal'");
    if (!table.rowCount) throw new Error('Falta la tabla DetalleCompraMetal: aplique primero scripts/db/metal-purchases-migration.mjs.');
    if (values.execute) await client.query(sql);
    const column = await client.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='DetalleCompraMetal' AND column_name='evaluacion'");
    if (column.rows[0]?.data_type !== 'jsonb' || column.rows[0]?.is_nullable !== 'YES') throw new Error('La columna evaluacion no existe o no es JSONB nullable.');
    await client.query(values.execute ? 'COMMIT' : 'ROLLBACK');
    console.log(values.execute ? 'Migración aplicada y confirmada.' : 'Columna evaluacion presente. Consulta de solo lectura.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[conexión privada]') : 'Error de migración');
    process.exitCode = 1;
  } finally { await client.end(); }
}
