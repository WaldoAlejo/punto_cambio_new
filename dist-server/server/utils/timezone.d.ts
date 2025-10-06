export declare const GYE_OFFSET_HOURS = -5;
export declare const GYE_OFFSET_MS: number;
export declare function toGyeClock(date: Date): Date;
export declare function fromGyeClockToUtc(date: Date): Date;
export declare function gyeDayRangeUtcFromDate(date: Date): {
    gte: Date;
    lt: Date;
};
export declare function todayGyeDateOnly(now?: Date): string;
export declare function gyeParseDateOnly(dateStr: string): {
    y: number;
    m: number;
    d: number;
};
export declare function gyeDayRangeUtcFromDateOnly(dateStr: string): {
    gte: Date;
    lt: Date;
};
export declare function gyeDateOnlyToUtcMidnight(dateStr: string): Date;
/**
 * ✅ Compatibilidad retro:
 * Algunos módulos aún importan `gyeDayRangeUtcFromYMD`. Lo exponemos como alias
 * con sobrecargas. El mes es **1-12** (no 0-11).
 */
export declare function gyeDayRangeUtcFromYMD(dateStr: string): {
    gte: Date;
    lt: Date;
};
export declare function gyeDayRangeUtcFromYMD(y: number, m: number, d: number): {
    gte: Date;
    lt: Date;
};
/**
 * 🕐 FUNCIONES DE FORMATEO PARA ECUADOR
 */
/**
 * Convierte una fecha UTC a la hora local de Ecuador (UTC-5)
 * y la retorna como objeto Date ajustado
 */
export declare function toEcuadorTime(utcDate: Date): Date;
/**
 * Formatea una fecha UTC al formato corto de Ecuador: DD/MM/YYYY HH:mm
 * Ejemplo: 03/10/2025 18:30
 */
export declare function formatEcuadorDateTime(utcDate: Date): string;
/**
 * Formatea una fecha UTC al formato solo fecha de Ecuador: DD/MM/YYYY
 * Ejemplo: 03/10/2025
 */
export declare function formatEcuadorDate(utcDate: Date): string;
/**
 * Formatea una fecha UTC al formato solo hora de Ecuador: HH:mm:ss
 * Ejemplo: 18:30:45
 */
export declare function formatEcuadorTime(utcDate: Date): string;
/**
 * Obtiene la fecha y hora actual de Ecuador
 */
export declare function nowEcuador(): Date;
/**
 * Convierte una fecha/hora local de Ecuador a UTC para guardar en BD
 * Ejemplo: Si recibes "2025-10-03 18:30" de Ecuador, lo convierte a UTC
 */
export declare function fromEcuadorToUTC(ecuadorDate: Date): Date;
/**
 * Crea una fecha UTC desde componentes de fecha/hora de Ecuador
 * @param year Año
 * @param month Mes (1-12)
 * @param day Día
 * @param hour Hora (0-23), opcional, default 0
 * @param minute Minuto (0-59), opcional, default 0
 * @param second Segundo (0-59), opcional, default 0
 */
export declare function createEcuadorDate(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): Date;
