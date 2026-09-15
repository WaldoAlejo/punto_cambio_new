type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};

export class ScheduleError extends Error {
  constructor(message: string, public readonly nextView?: "daily-close" | "apertura-caja") { super(message); }
}

export function scheduleError(error: unknown): ScheduleError {
  if (error instanceof ScheduleError) return error;
  const root = record(error), response = record(root.response), data = record(response.data);
  const errors = record(data.detalles).errores;
  const detail = typeof data.details === "string" ? data.details : Array.isArray(errors) ? errors.filter(e => typeof e === "string").join(". ") : "";
  const message = detail || (typeof data.error === "string" ? data.error : "") ||
    (typeof root.friendlyMessage === "string" ? root.friendlyMessage : "") ||
    (error instanceof Error ? error.message : "No se pudo guardar la jornada. Intenta nuevamente.");
  const nextView = data.code === "CASH_CLOSE_REQUIRED" || /cierre de caja requerido|cierre de caja diario|cierre diario/i.test(message)
    ? "daily-close" : data.code === "PENDING_CURRENCY_COUNT" || /divisas pendientes.*apertura de caja/i.test(message)
      ? "apertura-caja" : undefined;
  return new ScheduleError(message, nextView);
}
