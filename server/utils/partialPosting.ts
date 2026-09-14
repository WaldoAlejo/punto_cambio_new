// Inputs and outputs are integer cents. Preserve the rounded total; assign the
// residual cent to bank instead of rounding both components independently.
export function partialPosting(cash: number, bank: number, paid: number, total: number): [number, number] {
  if (![cash, bank, paid, total].every(Number.isSafeInteger) ||
      Math.min(cash, bank, paid) < 0 || total <= 0 || paid > total || !Number.isSafeInteger(cash + bank)) {
    throw new Error("Importes invalidos para repartir el abono");
  }
  const roundedRatio = (amount: number) => Number((BigInt(amount) * BigInt(paid) * 2n + BigInt(total)) / (2n * BigInt(total)));
  const postedTotal = roundedRatio(cash + bank);
  const postedCash = Math.min(cash, postedTotal, roundedRatio(cash));
  return [postedCash, postedTotal - postedCash];
}
