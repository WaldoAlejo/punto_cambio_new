// server/utils/timezone.ts
// Utilidades para alinear fechas a la zona horaria de Guayaquil (UTC-5)
// Ecuador (Guayaquil) no usa DST; usamos un offset fijo de -05:00.

export const GYE_OFFSET_HOURS = -5;
export const GYE_OFFSET_MS = Math.abs(GYE_OFFSET_HOURS) * 60 * 60 * 1000; // 5h en ms

// Detecta si el servidor está configurado con timezone de Ecuador (GMT-5)
// Esto es crucial para evitar doble conversión de timezone
export function isServerInEcuador(): boolean {
  return new Date().getTimezoneOffset() === 300; // 300 minutos = 5 horas = GMT-5
}

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
  if (isServerInEcuador()) {
    // El servidor está en Ecuador, 'date' tiene hora local Ecuador
    // Extraemos año/mes/día directamente de la fecha local
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    
    // 00:00 en Ecuador = 05:00 UTC del mismo día
    const gte = new Date(Date.UTC(y, m, d, 5, 0, 0, 0));
    const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
    return { gte, lt };
  }
  
  // Servidor en UTC u otro timezone - usar lógica original
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
  let y: number, m: number, d: number;
  
  if (isServerInEcuador()) {
    // Servidor en Ecuador - usar fecha local directamente
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
  } else {
    // Servidor en UTC u otro timezone - convertir
    const asGye = toGyeClock(now);
    y = asGye.getUTCFullYear();
    m = asGye.getUTCMonth() + 1;
    d = asGye.getUTCDate();
  }
  
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

/**
 * ✅ Compatibilidad retro:
 * Algunos módulos aún importan `gyeDayRangeUtcFromYMD`. Lo exponemos como alias
 * con sobrecargas. El mes es **1-12** (no 0-11).
 */

// Sobrecarga 1: recibe "YYYY-MM-DD"
export function gyeDayRangeUtcFromYMD(dateStr: string): { gte: Date; lt: Date };
// Sobrecarga 2: recibe y, m(1-12), d
export function gyeDayRangeUtcFromYMD(
  y: number,
  m: number,
  d: number
): { gte: Date; lt: Date };
// Implementación
export function gyeDayRangeUtcFromYMD(
  a: string | number,
  b?: number,
  c?: number
): { gte: Date; lt: Date } {
  if (typeof a === "string") {
    // "YYYY-MM-DD"
    return gyeDayRangeUtcFromDateOnly(a);
  }
  if (typeof a === "number" && typeof b === "number" && typeof c === "number") {
    const y = a;
    const m = b; // 1-12
    const d = c;
    const startGyeAsUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const gte = fromGyeClockToUtc(startGyeAsUtc);
    const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
    return { gte, lt };
  }
  throw new Error("Parámetros inválidos para gyeDayRangeUtcFromYMD");
}

/**
 * 🕐 FUNCIONES DE FORMATEO PARA ECUADOR
 */

/**
 * Convierte una fecha UTC a la hora local de Ecuador (UTC-5).
 * Si el servidor ya está en Ecuador, retorna la fecha sin modificar.
 * Si el servidor está en UTC, suma 5 horas.
 */
export function toEcuadorTime(utcDate: Date): Date {
  // Si el servidor ya está en Ecuador, la fecha ya es hora local
  if (isServerInEcuador()) {
    return new Date(utcDate.getTime());
  }
  // Si el servidor está en UTC, convertimos a hora Ecuador
  return new Date(utcDate.getTime() + GYE_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Obtiene la fecha y hora actual en Ecuador.
 * Si el servidor está en Ecuador, retorna new Date() directamente.
 * Si el servidor está en UTC, convierte a hora Ecuador.
 */
export function nowEcuador(): Date {
  if (isServerInEcuador()) {
    return new Date(); // El servidor ya está en Ecuador
  }
  return toEcuadorTime(new Date()); // Convertir desde UTC
}

/**
 * Formatea una fecha UTC al formato corto de Ecuador: DD/MM/YYYY HH:mm
 * Ejemplo: 03/10/2025 18:30
 */
export function formatEcuadorDateTime(utcDate: Date): string {
  const ecuadorDate = toEcuadorTime(utcDate);

  // Usar métodos locales si servidor está en Ecuador, UTC si no
  const getDay = isServerInEcuador() ? (d: Date) => d.getDate() : (d: Date) => d.getUTCDate();
  const getMonth = isServerInEcuador() ? (d: Date) => d.getMonth() : (d: Date) => d.getUTCMonth();
  const getFullYear = isServerInEcuador() ? (d: Date) => d.getFullYear() : (d: Date) => d.getUTCFullYear();
  const getHours = isServerInEcuador() ? (d: Date) => d.getHours() : (d: Date) => d.getUTCHours();
  const getMinutes = isServerInEcuador() ? (d: Date) => d.getMinutes() : (d: Date) => d.getUTCMinutes();

  const day = String(getDay(ecuadorDate)).padStart(2, "0");
  const month = String(getMonth(ecuadorDate) + 1).padStart(2, "0");
  const year = getFullYear(ecuadorDate);
  const hours = String(getHours(ecuadorDate)).padStart(2, "0");
  const minutes = String(getMinutes(ecuadorDate)).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formatea una fecha UTC al formato solo fecha de Ecuador: DD/MM/YYYY
 * Ejemplo: 03/10/2025
 */
export function formatEcuadorDate(utcDate: Date): string {
  const ecuadorDate = toEcuadorTime(utcDate);

  const getDay = isServerInEcuador() ? (d: Date) => d.getDate() : (d: Date) => d.getUTCDate();
  const getMonth = isServerInEcuador() ? (d: Date) => d.getMonth() : (d: Date) => d.getUTCMonth();
  const getFullYear = isServerInEcuador() ? (d: Date) => d.getFullYear() : (d: Date) => d.getUTCFullYear();

  const day = String(getDay(ecuadorDate)).padStart(2, "0");
  const month = String(getMonth(ecuadorDate) + 1).padStart(2, "0");
  const year = getFullYear(ecuadorDate);

  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha UTC al formato solo hora de Ecuador: HH:mm:ss
 * Ejemplo: 18:30:45
 */
export function formatEcuadorTime(utcDate: Date): string {
  const ecuadorDate = toEcuadorTime(utcDate);

  const getHours = isServerInEcuador() ? (d: Date) => d.getHours() : (d: Date) => d.getUTCHours();
  const getMinutes = isServerInEcuador() ? (d: Date) => d.getMinutes() : (d: Date) => d.getUTCMinutes();
  const getSeconds = isServerInEcuador() ? (d: Date) => d.getSeconds() : (d: Date) => d.getUTCSeconds();

  const hours = String(getHours(ecuadorDate)).padStart(2, "0");
  const minutes = String(getMinutes(ecuadorDate)).padStart(2, "0");
  const seconds = String(getSeconds(ecuadorDate)).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Convierte una fecha/hora local de Ecuador a UTC para guardar en BD.
 * Si el servidor ya está en Ecuador, retorna la fecha sin modificar (ya es UTC relativo).
 * Si el servidor está en UTC, resta 5 horas.
 */
export function fromEcuadorToUTC(ecuadorDate: Date): Date {
  // Si el servidor ya está en Ecuador, la fecha local ya representa hora Ecuador
  // y al guardarse en BD, Prisma/PostgreSQL la convertirá automáticamente a UTC
  if (isServerInEcuador()) {
    return new Date(ecuadorDate.getTime());
  }
  // Si el servidor está en UTC, necesitamos convertir manualmente
  return new Date(ecuadorDate.getTime() - GYE_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Crea una fecha UTC desde componentes de fecha/hora de Ecuador
 * @param year Año
 * @param month Mes (1-12)
 * @param day Día
 * @param hour Hora (0-23), opcional, default 0
 * @param minute Minuto (0-59), opcional, default 0
 * @param second Segundo (0-59), opcional, default 0
 */
export function createEcuadorDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // Crear fecha como si fuera UTC
  const ecuadorAsUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, 0)
  );
  // Convertir a UTC real
  return fromGyeClockToUtc(ecuadorAsUtc);
}
