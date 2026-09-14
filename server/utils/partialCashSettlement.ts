import type { CambioDivisa, Prisma } from "@prisma/client";
import { OperationalConflict } from "./operationalConflict.js";

const cents = (value: { toString(): string } | number) => Math.round(Number(value.toString()) * 100);

// The caller holds the exchange row and both balance locks. Legacy records may
// already contain the entire cash movement even when their status is PENDIENTE.
export async function remainingPartialCash(tx: Prisma.TransactionClient, cambio: CambioDivisa) {
  if (cambio.metodo_pago_origen !== "EFECTIVO" || cambio.metodo_entrega !== "efectivo") {
    throw new OperationalConflict("La liquidacion de abonos por banco o mixtos requiere revision contable antes de completar el cambio.");
  }
  const originTotal = cents(cambio.divisas_entregadas_total);
  const destinationTotal = cents(cambio.divisas_recibidas_total);
  const total = cents(cambio.monto_destino);
  const paid = cents(cambio.abono_inicial_monto ?? 0);
  const conflict = () => new OperationalConflict("El historial del abono requiere revision contable antes de completar el cambio.");
  if (originTotal <= 0 || destinationTotal <= 0 || paid <= 0 || paid >= total ||
      cambio.moneda_origen_id === cambio.moneda_destino_id) throw conflict();

  const movements = await tx.movimientoSaldo.findMany({ where: { referencia_id: cambio.id } });
  let origin = 0;
  let destination = 0;
  for (const movement of movements) {
    const amount = cents(movement.monto);
    if (movement.punto_atencion_id !== cambio.punto_atencion_id ||
        /\bbancos?\b/i.test(movement.descripcion ?? "") ||
        cents(movement.saldo_nuevo) - cents(movement.saldo_anterior) !== amount) throw conflict();
    if (movement.moneda_id === cambio.moneda_origen_id && amount > 0) origin += amount;
    else if (movement.moneda_id === cambio.moneda_destino_id && amount < 0) destination -= amount;
    else throw conflict();
  }
  const fullyPosted = origin === originTotal && destination === destinationTotal;
  const partiallyPosted = origin === Math.round(originTotal * paid / total) &&
    destination === Math.round(destinationTotal * paid / total);
  if (!movements.length || (!fullyPosted && !partiallyPosted)) throw conflict();
  return { ingresoEf: (originTotal - origin) / 100, egresoEf: (destinationTotal - destination) / 100 };
}
