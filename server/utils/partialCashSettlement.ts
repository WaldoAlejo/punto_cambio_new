import type { CambioDivisa, Prisma } from "@prisma/client";
import { OperationalConflict } from "./operationalConflict.js";
import { partialPosting } from "./partialPosting.js";

const cents = (value: { toString(): string } | number) => Math.round(Number(value.toString()) * 100);

// Called with the exchange and balance locks held. Require evidence of either
// the initial proportional posting or the full posting, for every cash/bank bucket.
export async function remainingPartialAmounts(tx: Prisma.TransactionClient, cambio: CambioDivisa) {
  const conflict = () => new OperationalConflict("El historial del abono requiere revision contable antes de completar el cambio.");
  const originTotal = cents(cambio.divisas_entregadas_total);
  const destinationTotal = cents(cambio.divisas_recibidas_total);
  const total = cents(cambio.monto_destino);
  const paid = cents(cambio.abono_inicial_monto ?? 0);
  if (originTotal <= 0 || destinationTotal <= 0 || paid <= 0 || paid >= total ||
      cambio.moneda_origen_id === cambio.moneda_destino_id) throw conflict();
  const split = (method: string, amount: number, cash: number, bank: number) => {
    if (method === "EFECTIVO" || method === "efectivo") return [amount, 0];
    if (method === "BANCO" || method === "transferencia") return [0, amount];
    if (method !== "MIXTO" && method !== "mixto") throw conflict();
    if (cash < 0 || bank < 0 || cash + bank !== amount) throw conflict();
    return [cash, bank];
  };
  const expected = [
    ...split(cambio.metodo_pago_origen, originTotal, cents(cambio.usd_recibido_efectivo ?? 0), cents(cambio.usd_recibido_transfer ?? 0)),
    ...split(cambio.metodo_entrega, destinationTotal, cents(cambio.usd_entregado_efectivo ?? 0), cents(cambio.usd_entregado_transfer ?? 0)),
  ];
  const posted = [0, 0, 0, 0];
  const movements = await tx.movimientoSaldo.findMany({ where: { referencia_id: cambio.id } });
  for (const movement of movements) {
    const amount = cents(movement.monto);
    if (movement.punto_atencion_id !== cambio.punto_atencion_id ||
        cents(movement.saldo_nuevo) - cents(movement.saldo_anterior) !== amount) throw conflict();
    let side: number;
    if (movement.moneda_id === cambio.moneda_origen_id && amount > 0) side = 0;
    else if (movement.moneda_id === cambio.moneda_destino_id && amount < 0) side = 2;
    else throw conflict();
    const description = movement.descripcion ?? "";
    const bank = /\bbancos?\b/i.test(description);
    const cash = /\b(caja|efectivo)\b/i.test(description);
    // Bank records must be distinguishable from cash; ambiguous labels require review.
    if (bank && cash) throw conflict();
    if (!bank && !cash && expected[1] + expected[3] > 0) throw conflict();
    posted[side + (bank ? 1 : 0)] += Math.abs(amount);
  }
  const fullyPosted = posted.every((amount, i) => amount === expected[i]);
  const partial = [...partialPosting(expected[0], expected[1], paid, total),
    ...partialPosting(expected[2], expected[3], paid, total)];
  // Retain compatibility with verified postings from the former independent
  // rounding rule. Settlement uses actual ledger amounts, never rewrites them.
  const partiallyPosted = posted.every((amount, i) => amount === partial[i]) ||
    posted.every((amount, i) => amount === Math.round(expected[i] * paid / total));
  if (!movements.length || (!fullyPosted && !partiallyPosted)) throw conflict();
  const remaining = expected.map((amount, i) => (amount - posted[i]) / 100);
  return { ingresoEf: remaining[0], ingresoBk: remaining[1], egresoEf: remaining[2], egresoBk: remaining[3] };
}
