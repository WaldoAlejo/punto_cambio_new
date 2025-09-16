// server/utils/timezone.ts
// Utilidades para alinear fechas a la zona horaria de Guayaquil (GMT-5)
// Nota: Ecuador (Guayaquil) no usa DST actualmente; mantenemos offset fijo -05:00.

export const GYE_OFFSET_HOURS = -5;

// Rango de día (inicio inclusivo, fin exclusivo) para una fecha dada, en UTC,
// considerando el día calendario de Guayaquil.
export function gyeDayRangeUtcFromDate(date: Date): { gte: Date; lt: Date } {
  // Convertir el instante a "reloj Guayaquil" restando 5 horas
  const baseUtcMs = date.getTime();
  const gyeMs = baseUtcMs - GYE_OFFSET_HOURS * -1 * 60 * 60 * 1000; // -(-5) = +5h hacia UTC, por claridad usamos fórmula explícita
  const gyeDate = new Date(gyeMs);
  const y = gyeDate.getUTCFullYear();
  const m = gyeDate.getUTCMonth();
  const d = gyeDate.getUTCDate();
  // Medianoche en Guayaquil (00:00 GYE) equivale a 05:00 UTC del mismo día
  const gte = new Date(Date.UTC(y, m, d, 5, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m, d + 1, 5, 0, 0, 0));
  return { gte, lt };
}

// A partir de un Y-M-D (formato de fecha local GYE), devolver el rango UTC del día GYE
export function gyeDayRangeUtcFromYMD(
  y: number,
  m1: number,
  d: number
): {
  gte: Date;
  lt: Date;
} {
  // m1 = 1..12
  const m0 = m1 - 1;
  const gte = new Date(Date.UTC(y, m0, d, 5, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m0, d + 1, 5, 0, 0, 0));
  return { gte, lt };
}

// Parseo seguro de YYYY-MM-DD
export function gyeParseDateOnly(dateStr: string): {
  y: number;
  m: number;
  d: number;
} {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${dateStr}`);
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  return { y, m: mm, d: dd };
}
