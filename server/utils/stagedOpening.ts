import type { Prisma } from "../lib/prisma.js";
import { OperationalConflict } from "./operationalConflict.js";

export type OpeningCurrency = { moneda_id: string; codigo: string; cantidad: number; apertura_por_etapas?: boolean; obligatoria_inicio?: boolean };
export function openingCurrencies(value: unknown): OpeningCurrency[] {
  return Array.isArray(value) ? value as OpeningCurrency[] : [];
}
export function requiredOpeningCurrencies(value: unknown): string[] {
  return [...new Set(["USD", "EUR", ...openingCurrencies(value)
    .filter(c => c.obligatoria_inicio).map(c => c.codigo.toUpperCase())])];
}
export function isPendingCurrencyError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("PENDING_CURRENCY_COUNT");
}

// Call under the balance lock. Old openings keep their existing policy.
export async function assertCurrencyCounted(tx: Prisma.TransactionClient, pointId: string, currencyId: string) {
  const opening = await tx.aperturaCaja.findFirst({ where: {
    punto_atencion_id: pointId, jornada: { estado: { in: ["ACTIVO", "ALMUERZO"] }, fecha_salida: null },
  }, orderBy: { hora_inicio_conteo: "desc" } });
  const expected = openingCurrencies(opening?.saldo_esperado);
  if (!expected.some(c => c.apertura_por_etapas)) return;
  const item = expected.find(c => c.moneda_id === currencyId);
  const counted = Array.isArray(opening?.conteo_fisico) ? opening.conteo_fisico as Array<{ moneda_id: string; total: number }> : [];
  const count = counted.find(c => c.moneda_id === currencyId);
  const tolerance = item?.codigo === "USD" ? Number(opening?.tolerancia_usd) : Number(opening?.tolerancia_otras);
  let incidentAllows = false;
  try {
    const incident = JSON.parse((opening?.observaciones_operador || "").split("[INCIDENCIA_APERTURA]")[1]?.split("[/INCIDENCIA_APERTURA]")[0] || "null");
    incidentAllows = ["INCIDENCIA_OPERADOR", "INCIDENCIA_APROBADA"].includes(opening?.metodo_verificacion || "") && Boolean(item?.obligatoria_inicio) &&
      Array.isArray(incident?.monedas_afectadas) && incident.monedas_afectadas.includes(item?.codigo);
  } catch { /* Invalid evidence never authorizes operations. */ }
  if (!item || !count || (Math.abs(Number(count.total) - Number(item.cantidad)) > tolerance && !incidentAllows)) {
    throw new OperationalConflict(`Debe completar el conteo de ${item?.codigo || "la divisa"} en Apertura de Caja antes de operar o cerrar.`);
  }
}
