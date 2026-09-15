export function parseCoinDenomination(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 999999.99 ? amount : null;
}

export function mergeCountDenominations(
  defaults: number[],
  saved: Array<{ denominacion: number; cantidad: number }> = []
): Array<{ denominacion: number; cantidad: number }> {
  return [...new Set([...defaults, ...saved.map(item => item.denominacion)])]
    .sort((a, b) => b - a)
    .map(denominacion => ({ denominacion, cantidad: saved.find(item => item.denominacion === denominacion)?.cantidad ?? 0 }));
}
