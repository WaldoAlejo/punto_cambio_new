// Round one component and assign the remainder in integer cents. Rounding both
// independently can create or lose a cent, especially when settling an abono.
export function splitCash(total: number, billsWeight: number, coinsWeight: number) {
  if (![total, billsWeight, coinsWeight].every(value => Number.isFinite(value) && value >= 0)) {
    throw new Error("Importes invalidos para el desglose de efectivo");
  }
  const totalCents = Math.round(total * 100);
  const weight = billsWeight + coinsWeight;
  const billsCents = weight > 0 ? Math.min(totalCents, Math.round(totalCents * billsWeight / weight)) : totalCents;
  return { bills: billsCents / 100, coins: (totalCents - billsCents) / 100 };
}
