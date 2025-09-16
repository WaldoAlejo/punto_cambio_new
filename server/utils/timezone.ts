// server/utils/timezone.ts
// Utilidades para alinear fechas a la zona horaria de Guayaquil (UTC-5)
// Ecuador (Guayaquil) no usa DST; usamos un offset fijo de -05:00.

export const GYE_OFFSET_HOURS = -5;
export const GYE_OFFSET_MS = Math.abs(GYE_OFFSET_HOURS) * 60 * 60 * 1000; // 5h en ms

// Convierte un instante UTC a "reloj Guayaquil" (-05:00) sin cambiar el instante real.
// Útil para extraer año/mes/día según el calendario de Guayaquil.
export function toGyeClock(date: Date): Date {
  return new Date(date.getTime() - GYE_OFFSET_MS);
}

// Convierte una hora que asumes está en "reloj Guayaquil" a su instante UTC correspondiente.
export function fromGyeClockToUtc(date: Date): Date {
  return new Date(date.getTime() + GYE_OFFSET_MS);
}

// Rango [gte, lt) en UTC que cubre el día calendario de Guayaquil de la fecha dada.
// Ej: si date es 2025-09-16T18:00:00Z, retorna inicio UTC de 2025-09-16 00:00 GYE y fin +24h.
export function gyeDayRangeUtcFromDate(date: Date): { gte: Date; lt: Date } {
  const asGye = toGyeClock(date); // "ver" el instante con el reloj -05:00
  const y = asGye.getUTCFullYear();
  const m = asGye.getUTCMonth();
  const d = asGye.getUTCDate();

  // 00:00 GYE de ese día, expresado como si fuera UTC
  const startGyeAsUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  // Volver al instante real en UTC sumando el offset
  const gte = fromGyeClockToUtc(startGyeAsUtc);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

// Devuelve el string YYYY-MM-DD del "hoy" de Guayaquil basado en un instante (por defecto: ahora)
export function todayGyeDateOnly(now: Date = new Date()): string {
  const asGye = toGyeClock(now);
  const y = asGye.getUTCFullYear();
  const m = asGye.getUTCMonth() + 1;
  const d = asGye.getUTCDate();
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = d < 10 ? `0${d}` : `${d}`;
  return `${y}-${mm}-${dd}`;
}

// Parse seguro de YYYY-MM-DD
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

// Devuelve el rango [gte, lt) en UTC para el día YYYY-MM-DD del calendario de Guayaquil.
export function gyeDayRangeUtcFromDateOnly(dateStr: string): {
  gte: Date;
  lt: Date;
} {
  const { y, m, d } = gyeParseDateOnly(dateStr);
  const startGyeAsUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const gte = fromGyeClockToUtc(startGyeAsUtc);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

// Devuelve un objeto Date (instante UTC) que corresponde a las 00:00 del día YYYY-MM-DD en Guayaquil.
export function gyeDateOnlyToUtcMidnight(dateStr: string): Date {
  const { y, m, d } = gyeParseDateOnly(dateStr);
  const startGyeAsUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return fromGyeClockToUtc(startGyeAsUtc);
}
