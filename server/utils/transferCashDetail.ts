import { Prisma } from "../lib/prisma.js";
import { InsufficientTransferBalance } from "./transferBalance.js";

export type TransferCashDetail = { billetes: number; monedas: number; total: number };
export function transferCashDetail(value: unknown, amount: number): TransferCashDetail {
  const v = value as Partial<TransferCashDetail> | null;
  const parts = [v?.billetes, v?.monedas, v?.total, amount];
  if (parts.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0 || new Prisma.Decimal(n).decimalPlaces() > 2)) {
    throw new InsufficientTransferBalance("El desglose debe contener importes no negativos con hasta dos decimales.");
  }
  if (!v || !new Prisma.Decimal(v.billetes as number).plus(v.monedas as number).eq(amount) || v.total !== amount) {
    throw new InsufficientTransferBalance("Billetes y monedas deben sumar el monto de la transferencia.");
  }
  return { billetes: v.billetes as number, monedas: v.monedas as number, total: amount };
}

// Only this versioned evidence certifies what the new sender actually debited.
// Old receipt detalle_divisas was informational and must never be trusted as a debit.
export async function readPostedTransferCash(tx: Prisma.TransactionClient, id: string, amount: number) {
  const receipts = await tx.recibo.findMany({ where: { referencia_id: id, tipo_operacion: "TRANSFERENCIA" }, select: { datos_operacion: true } });
  const evidence = receipts.map(r => r.datos_operacion as Record<string, unknown>).filter(d => d?.desglose_contabilizado_v1 != null);
  if (!evidence.length) return null;
  if (evidence.length !== 1) throw new Error("Evidencia de desglose duplicada; revisar transferencia.");
  return transferCashDetail(evidence[0].desglose_contabilizado_v1, amount);
}
