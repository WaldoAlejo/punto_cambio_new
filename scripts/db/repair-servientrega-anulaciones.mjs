// Reparación de descuadres por anulaciones Servientrega (autorizada 2026-11-06). No carga dotenv.
// Uso:
//   AUDIT_DATABASE_URL=... node scripts/db/repair-servientrega-anulaciones.mjs --check
//   AUDIT_DATABASE_URL=... node scripts/db/repair-servientrega-anulaciones.mjs --execute --backup /ruta/respaldo.json
//
// Corrige, solo con movimientos de ajuste (no borra ni edita movimientos existentes):
//  1. Guías anuladas en Servientrega que quedaron ACTIVA localmente → estado ANULADA.
//  2. Devoluciones duplicadas al saldo Servientrega → resta el exceso (movimiento "Ajuste devolución duplicada").
//  3. Saldo general del punto de guías anuladas con neto ≠ 0 (franquicias y duplicados) →
//     movimiento "Ajuste (CAJA|BANCOS)" que deja el neto de la guía en 0.
// Es idempotente: una segunda ejecución no encuentra nada que corregir.
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Guías verificadas como "Anulado" en el portal de Servientrega el 2026-11-06
export const ANULADAS_EN_SERVIENTREGA = ['1001034800', '1001021464', '1001008672', '1000944259'];
// Limpieza total de movimientos el 2026-05-14: las guías anteriores no tienen movimientos.
export const DESDE = '2026-05-15';

const cents = (v) => Math.round(Number(v ?? 0) * 100);
const money = (c) => (c / 100).toFixed(2);
const REVERSION = `(descripcion LIKE 'Reversión por cancelación%' OR descripcion LIKE 'Devolución de crédito por anulación%')`;

export async function planRepair(c) {
  const usd = (await c.query(`SELECT id FROM "Moneda" WHERE codigo='USD'`)).rows[0]?.id;
  if (!usd) throw Error('Moneda USD ausente');

  const marcar = (await c.query(
    `SELECT numero_guia, estado FROM "ServientregaGuia" WHERE numero_guia = ANY($1) AND estado <> 'ANULADA'`,
    [ANULADAS_EN_SERVIENTREGA])).rows.map((r) => r.numero_guia);

  const guias = (await c.query(`
    SELECT g.numero_guia, g.punto_atencion_id, g.estado, COALESCE(g.costo_envio,0) AS costo, p.nombre AS punto,
      COALESCE((SELECT SUM(ABS(monto)) FROM "ServicioExternoMovimiento" s WHERE s.servicio='SERVIENTREGA' AND s.numero_referencia=g.numero_guia AND s.descripcion LIKE 'Uso de crédito%'),0) AS credito,
      COALESCE((SELECT SUM(ABS(monto)) FROM "ServicioExternoMovimiento" s WHERE s.servicio='SERVIENTREGA' AND s.numero_referencia=g.numero_guia AND ${REVERSION}),0) AS devuelto,
      COALESCE((SELECT SUM(ABS(monto)) FROM "ServicioExternoMovimiento" s WHERE s.servicio='SERVIENTREGA' AND s.numero_referencia=g.numero_guia AND s.descripcion LIKE 'Ajuste devolución duplicada%'),0) AS ajustado,
      COALESCE((SELECT SUM(monto) FROM "MovimientoSaldo" m WHERE m.tipo_referencia='SERVIENTREGA' AND m.referencia_id=g.numero_guia AND m.moneda_id=$1 AND m.punto_atencion_id=g.punto_atencion_id AND LOWER(COALESCE(m.descripcion,'')) NOT LIKE '%(bancos)%'),0) AS neto_caja,
      COALESCE((SELECT SUM(monto) FROM "MovimientoSaldo" m WHERE m.tipo_referencia='SERVIENTREGA' AND m.referencia_id=g.numero_guia AND m.moneda_id=$1 AND m.punto_atencion_id=g.punto_atencion_id AND LOWER(COALESCE(m.descripcion,'')) LIKE '%(bancos)%'),0) AS neto_bancos
    FROM "ServientregaGuia" g LEFT JOIN "PuntoAtencion" p ON p.id = g.punto_atencion_id
    WHERE g.created_at >= $2::date AND g.punto_atencion_id IS NOT NULL
      AND (g.estado = 'ANULADA' OR g.numero_guia = ANY($3))
    ORDER BY g.created_at`, [usd, DESDE, ANULADAS_EN_SERVIENTREGA])).rows;

  const acciones = [];
  for (const g of guias) {
    const credito = cents(g.credito);
    const exceso = credito > 0 ? cents(g.devuelto) - cents(g.ajustado) - credito : 0;
    const ajusteCaja = -cents(g.neto_caja);
    const ajusteBancos = -cents(g.neto_bancos);
    if (exceso > 0 || ajusteCaja !== 0 || ajusteBancos !== 0) {
      acciones.push({ numero_guia: g.numero_guia, punto: g.punto, punto_atencion_id: g.punto_atencion_id,
        exceso_servientrega: exceso > 0 ? exceso : 0, ajuste_caja: ajusteCaja, ajuste_bancos: ajusteBancos });
    }
  }
  const total = (k) => acciones.reduce((s, a) => s + a[k], 0);
  return {
    usd, marcar, acciones,
    resumen: {
      guias_a_marcar_anuladas: marcar.length,
      guias_con_ajuste: acciones.length,
      restar_saldo_servientrega: money(total('exceso_servientrega')),
      ajuste_caja: money(total('ajuste_caja')),
      ajuste_bancos: money(total('ajuste_bancos')),
    },
  };
}

export async function applyRepair(c, plan) {
  const sistema = (await c.query(`SELECT id FROM "Usuario" WHERE correo='system@puntocambio.com' LIMIT 1`)).rows[0]?.id;
  if (!sistema) throw Error('Usuario SYSTEM ausente');

  if (plan.marcar.length) {
    await c.query(`UPDATE "ServientregaGuia" SET estado='ANULADA', proceso='Anulada', updated_at=now() WHERE numero_guia = ANY($1) AND estado <> 'ANULADA'`, [plan.marcar]);
  }

  for (const a of plan.acciones) {
    if (a.exceso_servientrega > 0) {
      const s = (await c.query(`SELECT id, cantidad, billetes, monedas_fisicas FROM "ServicioExternoSaldo" WHERE punto_atencion_id=$1 AND servicio='SERVIENTREGA' AND moneda_id=$2 FOR UPDATE`, [a.punto_atencion_id, plan.usd])).rows[0];
      if (!s) throw Error(`Sin saldo Servientrega en ${a.punto}`);
      const x = a.exceso_servientrega;
      const deBilletes = Math.min(cents(s.billetes), x);
      const deMonedas = x - deBilletes;
      if (deMonedas > cents(s.monedas_fisicas)) throw Error(`Efectivo Servientrega insuficiente en ${a.punto} para restar ${money(x)}`);
      await c.query(`UPDATE "ServicioExternoSaldo" SET cantidad=cantidad-$2::numeric, billetes=billetes-$3::numeric, monedas_fisicas=monedas_fisicas-$4::numeric, updated_at=now() WHERE id=$1`,
        [s.id, money(x), money(deBilletes), money(deMonedas)]);
      await c.query(`INSERT INTO "ServicioExternoMovimiento" (id, punto_atencion_id, servicio, tipo_movimiento, moneda_id, monto, usuario_id, fecha, descripcion, numero_referencia, billetes, monedas_fisicas, bancos, metodo_ingreso)
        VALUES (gen_random_uuid(), $1, 'SERVIENTREGA', 'EGRESO', $2, $3::numeric, $4, now(), $5, $6, $3::numeric, 0, 0, 'EFECTIVO')`,
        [a.punto_atencion_id, plan.usd, money(x), sistema, `Ajuste devolución duplicada guía Servientrega #${a.numero_guia}`, a.numero_guia]);
    }

    for (const [bucket, ajuste] of [['CAJA', a.ajuste_caja], ['BANCOS', a.ajuste_bancos]]) {
      if (ajuste === 0) continue;
      const s = (await c.query(`SELECT id, cantidad, billetes, bancos FROM "Saldo" WHERE punto_atencion_id=$1 AND moneda_id=$2 FOR UPDATE`, [a.punto_atencion_id, plan.usd])).rows[0];
      if (!s) throw Error(`Sin saldo USD en ${a.punto}`);
      const anterior = bucket === 'CAJA' ? cents(s.cantidad) : cents(s.bancos);
      if (bucket === 'CAJA') {
        if (ajuste < 0 && cents(s.billetes) < -ajuste) throw Error(`Billetes insuficientes en ${a.punto}`);
        await c.query(`UPDATE "Saldo" SET cantidad=cantidad+$2::numeric, billetes=billetes+$2::numeric, updated_at=now() WHERE id=$1`, [s.id, money(ajuste)]);
      } else {
        await c.query(`UPDATE "Saldo" SET bancos=bancos+$2::numeric, updated_at=now() WHERE id=$1`, [s.id, money(ajuste)]);
      }
      await c.query(`INSERT INTO "MovimientoSaldo" (id, punto_atencion_id, moneda_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, usuario_id, referencia_id, tipo_referencia, descripcion, fecha, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7, $8, 'SERVIENTREGA', $9, now(), now())`,
        [a.punto_atencion_id, plan.usd, ajuste > 0 ? 'INGRESO' : 'EGRESO', money(ajuste), money(anterior), money(anterior + ajuste), sistema, a.numero_guia,
          `Ajuste (${bucket}) corrección anulación guía Servientrega #${a.numero_guia}`]);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, execute: { type: 'boolean' }, backup: { type: 'string' } } });
  if (!values.check && !values.execute) { console.log('Use --check o --execute --backup <archivo nuevo>; requiere AUDIT_DATABASE_URL.'); return; }
  if (values.check && values.execute) throw Error('Use un solo modo');
  if (!process.env.AUDIT_DATABASE_URL) throw Error('Falta AUDIT_DATABASE_URL');
  if (values.execute && !values.backup) throw Error('Falta --backup');
  const c = new pg.Client({ connectionString: process.env.AUDIT_DATABASE_URL, connectionTimeoutMillis: 10000 });
  let committed = false;
  try {
    await c.connect();
    await c.query(values.execute ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await c.query("SET LOCAL lock_timeout='5s'"); await c.query("SET LOCAL statement_timeout='60s'");
    const plan = await planRepair(c);
    console.log(JSON.stringify({ resumen: plan.resumen, marcar_anuladas: plan.marcar,
      acciones: plan.acciones.map((a) => ({ guia: a.numero_guia, punto: a.punto, restar_servientrega: money(a.exceso_servientrega), ajuste_caja: money(a.ajuste_caja), ajuste_bancos: money(a.ajuste_bancos) })) }, null, 2));
    if (!values.execute || (!plan.marcar.length && !plan.acciones.length)) { await c.query('ROLLBACK'); if (values.execute) console.log('Nada que corregir.'); return; }
    const ids = [...new Set(plan.acciones.map((a) => a.punto_atencion_id))];
    const antes = {
      saldos: (await c.query(`SELECT * FROM "Saldo" WHERE punto_atencion_id = ANY($1) AND moneda_id=$2`, [ids, plan.usd])).rows,
      saldos_servientrega: (await c.query(`SELECT * FROM "ServicioExternoSaldo" WHERE punto_atencion_id = ANY($1) AND servicio='SERVIENTREGA'`, [ids])).rows,
      guias_marcadas: (await c.query(`SELECT id, numero_guia, estado, proceso FROM "ServientregaGuia" WHERE numero_guia = ANY($1)`, [plan.marcar])).rows,
    };
    const audit = JSON.stringify({ at: new Date().toISOString(), plan, antes }, null, 2);
    await fs.writeFile(values.backup, audit, { flag: 'wx', mode: 0o600 });
    await applyRepair(c, plan);
    const despues = await planRepair(c);
    if (despues.marcar.length || despues.acciones.length) throw Error('Quedaron descuadres tras aplicar; se revierte todo');
    await c.query('COMMIT'); committed = true;
    console.log(JSON.stringify({ committed, backupSha256: createHash('sha256').update(audit).digest('hex') }, null, 2));
  } catch (e) {
    if (!committed) await c.query('ROLLBACK').catch(() => {});
    console.error(committed ? 'COMMIT confirmado.' : 'Sin COMMIT: no se modificó nada.');
    throw e;
  } finally { await c.end().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[conexion privada]')); process.exitCode = 1; });
