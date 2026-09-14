// One-time reconstruction authorized on 2026-09-14. No dotenv auto-loading.
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from 'pg';

export const target = Object.freeze({
  point: '3f13bb4e-181b-4026-b1bf-4ae00f1d1391', currency: '397fbd81-7f1e-49ed-832a-43baedcf0b02',
  balance: '648988a5-c36f-4069-b376-212096ee4233', opening: '98cca2e1-059c-4d89-8a48-3bb2eb05ea09',
  rawUpdated: '2026-09-12 17:49:31.024',
  sale: '950a9ff7-ab32-4475-8546-ca27b3f84224', purchase: 'f1bf99c2-39e0-441a-9228-b19faa0ebe6d',
});
const cents = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw Error('Importe no valido');
  return Math.round(n * 100);
};
const sum = entries => entries.reduce((s, e) => {
  if (!Number.isSafeInteger(e.cantidad) || e.cantidad < 0 || cents(e.denominacion) <= 0) throw Error('Conteo no valido');
  return s + e.cantidad * cents(e.denominacion);
}, 0);

export function planRepair(balance, opening, movements, exchanges) {
  if (balance.id !== target.balance || balance.punto_atencion_id !== target.point || balance.moneda_id !== target.currency) throw Error('Saldo ajeno');
  if (opening.id !== target.opening || opening.estado !== 'ABIERTA') throw Error('Apertura distinta');
  const counts = opening.conteo_fisico.filter(e => e.moneda_id === target.currency);
  if (counts.length !== 1) throw Error('Conteo ausente o duplicado');
  const count = counts[0], bills = sum(count.billetes), coins = sum(count.monedas);
  if (bills !== 130500 || coins !== 1536 || cents(count.total) !== bills + coins) throw Error('Conteo modificado');
  if (movements.length !== 2 || exchanges.length !== 2) throw Error('Operaciones posteriores distintas');
  const expected = [[target.sale, -10000], [target.purchase, 52500]];
  let current = bills + coins;
  for (let i = 0; i < expected.length; i++) {
    const [id, amount] = expected[i], m = movements[i];
    const e = exchanges.find(e => e.id === id);
    if (!e || m.referencia_id !== id || cents(m.monto) !== amount || cents(m.saldo_anterior) !== current || cents(m.saldo_nuevo) !== current + amount || e.estado !== 'COMPLETADO') throw Error('Evidencia de movimientos modificada');
    const incoming = amount > 0;
    if (e[incoming ? 'moneda_origen_id' : 'moneda_destino_id'] !== target.currency || cents(e[incoming ? 'monto_origen' : 'monto_destino']) !== Math.abs(amount) || cents(e[incoming ? 'divisas_entregadas_billetes' : 'divisas_recibidas_billetes']) !== Math.abs(amount) || cents(e[incoming ? 'divisas_entregadas_monedas' : 'divisas_recibidas_monedas']) !== 0) throw Error('Desglose posterior distinto');
    current += amount;
  }
  if (cents(balance.cantidad) !== current || cents(balance.bancos) !== 0) throw Error('Total o bancos modificados');
  const after = { cantidad: '1745.36', billetes: '1730.00', monedas_fisicas: '15.36', bancos: '0.00' };
  const alreadyApplied = cents(balance.billetes) === 173000 && cents(balance.monedas_fisicas) === 1536;
  if (!alreadyApplied && (cents(balance.billetes) !== 168974 || cents(balance.monedas_fisicas) !== 714 || balance.version_text !== target.rawUpdated)) throw Error('Version de saldo modificada');
  return { alreadyApplied, before: balance, after, historicalTotal: '1745.26', historicalDifferencePendingToday: '0.10',
    basis: 'Ultimo conteo registrado mas dos operaciones posteriores; usuario difiere resolver 0.10 al conteo de hoy. No constituye conteo fisico actual.' };
}

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, execute: { type: 'boolean' }, backup: { type: 'string' } } });
  if (!values.check && !values.execute) { console.log('Sin conexion. Use --check o --execute --backup <archivo nuevo>; AUDIT_DATABASE_URL explicita.'); return; }
  if (values.check && values.execute) throw Error('Use un solo modo');
  if (!process.env.AUDIT_DATABASE_URL) throw Error('Falta AUDIT_DATABASE_URL');
  if (values.execute && !values.backup) throw Error('Falta archivo de respaldo');
  const c = new Client({ connectionString: process.env.AUDIT_DATABASE_URL, connectionTimeoutMillis: 10000 });
  let committed = false;
  try {
    await c.connect(); await c.query(values.execute ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await c.query("SET LOCAL lock_timeout='5s'"); await c.query("SET LOCAL statement_timeout='20s'");
    if (values.execute) {
      await c.query('SELECT id FROM "PuntoAtencion" WHERE id=$1 FOR UPDATE', [target.point]);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`transfer-balance:${target.point}:${target.currency}`]);
    }
    const active = await c.query(`SELECT id FROM "Jornada" WHERE punto_atencion_id=$1 AND estado IN ('ACTIVO','ALMUERZO') AND fecha_inicio >= ((now() AT TIME ZONE 'America/Guayaquil')::date::timestamp + interval '5 hours')`, [target.point]);
    if (active.rowCount) throw Error('Punto iniciado hoy: no aplicar durante operaciones');
    const b = await c.query('SELECT *,updated_at::text AS version_text FROM "Saldo" WHERE id=$1' + (values.execute ? ' FOR UPDATE' : ''), [target.balance]);
    if (b.rowCount !== 1) throw Error('Saldo ausente');
    const a = await c.query('SELECT id,estado,conteo_fisico,hora_fin_conteo FROM "AperturaCaja" WHERE punto_atencion_id=$1 ORDER BY fecha DESC,hora_inicio_conteo DESC LIMIT 1', [target.point]);
    if (a.rowCount !== 1) throw Error('Apertura ausente');
    const m = await c.query('SELECT id,referencia_id,monto,saldo_anterior,saldo_nuevo,fecha FROM "MovimientoSaldo" WHERE punto_atencion_id=$1 AND moneda_id=$2 AND fecha>$3 ORDER BY fecha,id', [target.point,target.currency,a.rows[0].hora_fin_conteo]);
    const e = await c.query('SELECT id,estado,moneda_origen_id,moneda_destino_id,monto_origen,monto_destino,divisas_entregadas_billetes,divisas_entregadas_monedas,divisas_recibidas_billetes,divisas_recibidas_monedas FROM "CambioDivisa" WHERE punto_atencion_id=$1 AND (moneda_origen_id=$2 OR moneda_destino_id=$2) AND fecha>$3 ORDER BY fecha,id', [target.point,target.currency,a.rows[0].hora_fin_conteo]);
    const plan = planRepair(b.rows[0],a.rows[0],m.rows,e.rows);
    console.log(JSON.stringify(plan,null,2));
    if (!values.execute || plan.alreadyApplied) { await c.query('ROLLBACK'); return; }
    const audit = JSON.stringify({ at: new Date().toISOString(), target, plan, opening:a.rows[0], movements:m.rows, exchanges:e.rows },null,2);
    await fs.writeFile(values.backup,audit,{flag:'wx',mode:0o600});
    const digest = createHash('sha256').update(audit).digest('hex');
    if (b.rows[0].version_text !== target.rawUpdated) throw Error('Marca SQL distinta');
    const update = await c.query(`UPDATE "Saldo" SET billetes=1730.00,monedas_fisicas=15.36,updated_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 AND cantidad=1745.36 AND bancos=0 AND billetes=1689.74 AND monedas_fisicas=7.14 AND updated_at=$2::timestamp RETURNING *,updated_at::text AS version_text`,[target.balance,target.rawUpdated]);
    if (update.rowCount !== 1) throw Error('Conflicto de version: no se actualizo');
    if (cents(update.rows[0].cantidad) !== cents(update.rows[0].billetes)+cents(update.rows[0].monedas_fisicas)) throw Error('Desglose no cuadra');
    await c.query('COMMIT'); committed = true;
    const result = { committed, backupSha256:digest, after:update.rows[0], historicalDifferencePendingToday:'0.10' };
    console.log(JSON.stringify(result,null,2));
    await fs.writeFile(values.backup+'.result.json',JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  } catch(e) {
    if (!committed) await c.query('ROLLBACK').catch(()=>{});
    console.error(committed ? 'COMMIT confirmado; fallo al guardar resultado local. Verificar saldo, no repetir a ciegas.' : 'Sin COMMIT.');
    throw e;
  } finally { await c.end().catch(()=>{}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e=>{console.error(e.message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[conexion privada]'));process.exitCode=1;});
