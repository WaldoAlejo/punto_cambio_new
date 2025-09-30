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
