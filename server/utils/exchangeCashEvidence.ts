import type { CambioDivisa, Prisma } from "@prisma/client";
import { OperationalConflict } from "./operationalConflict.js";

const cents = (value: unknown) => Math.round(Number(value) * 100);
type CashRow = { currencyId: string; total: number; bills: number; coins: number; bank: number };

export async function cashSnapshot(tx: Prisma.TransactionClient, pointId: string, currencies: string[]): Promise<CashRow[]> {
  const rows = await tx.saldo.findMany({ where: { punto_atencion_id: pointId, moneda_id: { in: currencies } } });
  return currencies.map(currencyId => {
    const row = rows.find(s => s.moneda_id === currencyId);
    return { currencyId, total: cents(row?.cantidad ?? 0), bills: cents(row?.billetes ?? 0), coins: cents(row?.monedas_fisicas ?? 0), bank: cents(row?.bancos ?? 0) };
  });
}

// Store actual balance deltas, including any substitution of bills with coins.
// Amounts are signed integer cents; this evidence is saved in the same transaction.
export async function attachCashEvidence(tx: Prisma.TransactionClient, receiptNumber: string, pointId: string, before: CashRow[]) {
  const after = await cashSnapshot(tx, pointId, before.map(row => row.currencyId));
  const delta = before.map((row, i) => ({ currencyId: row.currencyId,
    total: after[i].total - row.total, bills: after[i].bills - row.bills, coins: after[i].coins - row.coins,
    bank: after[i].bank - row.bank }));
  if (delta.some(row => row.total !== row.bills + row.coins)) {
    throw new OperationalConflict("El desglose contabilizado no coincide con el efectivo del cambio.");
  }
  const receipt = await tx.recibo.findUniqueOrThrow({ where: { numero_recibo: receiptNumber } });
  const data = receipt.datos_operacion;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new OperationalConflict("Recibo sin datos contables validos.");
  await tx.recibo.update({ where: { id: receipt.id }, data: {
    datos_operacion: { ...data, cash_delta_v1: delta.map(({ bank: _bank, ...cash }) => cash), balance_delta_v2: delta } as Prisma.InputJsonObject,
  } });
}

export async function cashReversalEvidence(tx: Prisma.TransactionClient, cambio: CambioDivisa) {
  const partial = Number(cambio.abono_inicial_monto) > 0 || cambio.estado === "PENDIENTE";
  const conflict = () => new OperationalConflict("No hay evidencia suficiente del efectivo y su desglose para anular este cambio. Requiere revision contable.");
  const hasBank = cambio.metodo_pago_origen !== "EFECTIVO" || cambio.metodo_entrega !== "efectivo";
  const evidenceKey = hasBank ? "balance_delta_v2" : "cash_delta_v1";
  const receipts = await tx.recibo.findMany({ where: { referencia_id: cambio.id } });
  const totals = new Map<string, CashRow>();
  let found = false;
  for (const receipt of receipts) {
    const data = receipt.datos_operacion;
    if (!data || typeof data !== "object" || Array.isArray(data) || !(evidenceKey in data)) continue;
    found = true;
    const deltas = data[evidenceKey];
    if (!Array.isArray(deltas) || deltas.length !== 2 || receipt.punto_atencion_id !== cambio.punto_atencion_id) throw conflict();
    const seen = new Set<string>();
    for (const value of deltas) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw conflict();
      const { currencyId, total, bills, coins } = value;
      const bank = hasBank ? value.bank : 0;
      if (typeof currencyId !== "string" || seen.has(currencyId) ||
          ![cambio.moneda_origen_id, cambio.moneda_destino_id].includes(currencyId) ||
          typeof total !== "number" || typeof bills !== "number" || typeof coins !== "number" ||
          typeof bank !== "number" || ![total, bills, coins, bank].every(Number.isSafeInteger) || total !== bills + coins) throw conflict();
      seen.add(currencyId);
      const sign = currencyId === cambio.moneda_origen_id ? 1 : -1;
      if ([total, bills, coins, bank].some(amount => amount * sign < 0)) throw conflict();
      const prev = totals.get(currencyId) ?? { currencyId, total: 0, bills: 0, coins: 0, bank: 0 };
      totals.set(currencyId, { currencyId, total: prev.total + total, bills: prev.bills + bills, coins: prev.coins + coins, bank: prev.bank + bank });
    }
  }
  if (!found) { if (partial || hasBank) throw conflict(); return null; }
  const movements = await tx.movimientoSaldo.findMany({ where: { referencia_id: cambio.id } });
  const posted = new Map<string, number>();
  for (const m of movements) {
    const amount = cents(m.monto);
    const sign = m.moneda_id === cambio.moneda_origen_id ? 1 : -1;
    const bank = /\bbancos?\b/i.test(m.descripcion ?? "");
    const cash = /\b(caja|efectivo)\b/i.test(m.descripcion ?? "");
    if (!totals.has(m.moneda_id) || m.punto_atencion_id !== cambio.punto_atencion_id ||
        (bank && (!hasBank || cash)) || (hasBank && !bank && !cash) || amount * sign <= 0 ||
        cents(m.saldo_nuevo) - cents(m.saldo_anterior) !== amount) throw conflict();
    const key = `${m.moneda_id}:${bank ? 'bank' : 'cash'}`;
    posted.set(key, (posted.get(key) ?? 0) + amount);
  }
  if (!movements.length || [...totals.values()].some(row =>
      (posted.get(`${row.currencyId}:cash`) ?? 0) !== row.total ||
      (posted.get(`${row.currencyId}:bank`) ?? 0) !== row.bank)) throw conflict();
  return { origin: totals.get(cambio.moneda_origen_id)!, destination: totals.get(cambio.moneda_destino_id)! };
}
