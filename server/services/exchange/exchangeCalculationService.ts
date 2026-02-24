/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE CÁLCULOS DE CAMBIO DE DIVISA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza todos los cálculos relacionados con tasas de cambio,
 * conversiones y redondeos.
 */

import { TipoOperacion } from "@prisma/client";
import { RateMode } from "../../types/index.js";

// Tasas de conversión por código de moneda
export const rateModeByCode: Record<string, RateMode> = {
  EUR: "USD_PER_UNIT",
  GBP: "USD_PER_UNIT",
  CHF: "USD_PER_UNIT",
  JPY: "USD_PER_UNIT",
  COP: "UNITS_PER_USD",
  PYG: "UNITS_PER_USD",
  CLP: "UNITS_PER_USD",
  PEN: "UNITS_PER_USD",
  ARS: "UNITS_PER_USD",
  MXN: "UNITS_PER_USD",
  BRL: "UNITS_PER_USD",
  UYU: "UNITS_PER_USD",
  DOP: "UNITS_PER_USD",
};

/**
 * Determina el modo de tasa para un par de monedas
 */
export function getRateModeForPair(
  codOrigen: string,
  codDestino: string
): RateMode {
  if (codOrigen === "USD" && codDestino !== "USD") {
    return rateModeByCode[codDestino] ?? "UNITS_PER_USD";
  }
  if (codDestino === "USD" && codOrigen !== "USD") {
    return rateModeByCode[codOrigen] ?? "UNITS_PER_USD";
  }
  return rateModeByCode[codDestino] ?? "USD_PER_UNIT";
}

/**
 * Convierte un monto según la tasa y modo especificados
 */
export function convertir(
  tipo: TipoOperacion,
  modo: RateMode,
  montoOrigen: number,
  tasa: number,
  codOrigen: string,
  codDestino: string
): { montoDestinoCalc: number } {
  if (!Number.isFinite(tasa) || tasa <= 0) return { montoDestinoCalc: 0 };

  if (codOrigen === "USD" && codDestino !== "USD") {
    // VENTA: USD -> DIVISA
    if (modo === "UNITS_PER_USD") return { montoDestinoCalc: montoOrigen * tasa };
    return { montoDestinoCalc: montoOrigen / tasa };
  }
  
  if (codDestino === "USD" && codOrigen !== "USD") {
    // COMPRA: DIVISA -> USD
    if (modo === "UNITS_PER_USD") return { montoDestinoCalc: montoOrigen / tasa };
    return { montoDestinoCalc: montoOrigen * tasa };
  }
  
  // Cross (no USD): no forzamos cálculo
  return { montoDestinoCalc: 0 };
}

/**
 * Redondea a 2 decimales
 */
export function round2(x: number): number {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondea a N decimales
 */
export function roundN(x: number, n = 3): number {
  const factor = Math.pow(10, n);
  return Math.round((Number(x) + Number.EPSILON) * factor) / factor;
}

/**
 * Calcula el monto destino basado en billetes y monedas con sus tasas
 */
export function calcularMontoDestino(
  amountBilletes: number,
  amountMonedas: number,
  rateBilletes: number,
  rateMonedas: number,
  tipoOperacion: TipoOperacion,
  codOrigen: string,
  codDestino: string
): number {
  const modo = getRateModeForPair(codOrigen, codDestino);
  let totalCalc = 0;

  if (amountBilletes > 0 && rateBilletes > 0) {
    const { montoDestinoCalc } = convertir(
      tipoOperacion,
      modo,
      amountBilletes,
      rateBilletes,
      codOrigen,
      codDestino
    );
    if (montoDestinoCalc > 0) totalCalc += montoDestinoCalc;
  }

  if (amountMonedas > 0 && rateMonedas > 0) {
    const { montoDestinoCalc } = convertir(
      tipoOperacion,
      modo,
      amountMonedas,
      rateMonedas,
      codOrigen,
      codDestino
    );
    if (montoDestinoCalc > 0) totalCalc += montoDestinoCalc;
  }

  return round2(totalCalc);
}

/**
 * Calcula el porcentaje de actualización según abono inicial
 */
export function calcularPorcentajeActualizacion(
  estado: string,
  abonoInicialMonto: number | null | undefined,
  montoDestino: number
): number {
  if (estado === "PENDIENTE" && (abonoInicialMonto ?? 0) > 0) {
    return (abonoInicialMonto ?? 0) / montoDestino;
  }
  return 1.0; // 100%
}

/**
 * Distribuye un monto entre billetes y monedas manteniendo proporciones
 */
export function distribuirBilletesMonedas(
  montoTotal: number,
  billetesDeseados: number,
  monedasDeseadas: number,
  billetesDisponibles: number,
  monedasDisponibles: number
): { billetes: number; monedas: number } {
  const totalDeseado = billetesDeseados + monedasDeseadas;
  
  if (totalDeseado === 0) {
    // Sin proporción deseada, usar disponible
    const billetes = Math.min(montoTotal, billetesDisponibles);
    const monedas = Math.min(montoTotal - billetes, monedasDisponibles);
    return { billetes: round2(billetes), monedas: round2(monedas) };
  }

  // Intentar respetar la proporción deseada
  const proporcionBilletes = billetesDeseados / totalDeseado;
  const proporcionMonedas = monedasDeseadas / totalDeseado;

  let billetes = round2(montoTotal * proporcionBilletes);
  let monedas = round2(montoTotal * proporcionMonedas);

  // Ajustar si no hay suficientes billetes
  if (billetes > billetesDisponibles) {
    const excesoBilletes = billetes - billetesDisponibles;
    billetes = billetesDisponibles;
    monedas = round2(monedas + excesoBilletes);
  }

  // Ajustar si no hay suficientes monedas
  if (monedas > monedasDisponibles) {
    const excesoMonedas = monedas - monedasDisponibles;
    monedas = monedasDisponibles;
    billetes = round2(billetes + excesoMonedas);
  }

  // Ajustar redondeo final
  const diferencia = montoTotal - (billetes + monedas);
  if (Math.abs(diferencia) > 0.01) {
    if (billetes <= billetesDisponibles) {
      billetes = round2(billetes + diferencia);
    } else if (monedas <= monedasDisponibles) {
      monedas = round2(monedas + diferencia);
    }
  }

  return { billetes, monedas };
}

/**
 * Normaliza montos USD según método de entrega
 */
export function normalizarMontosUSD(
  metodoEntrega: string,
  totalRecibido: number,
  usdEfectivo?: number,
  usdTransfer?: number
): { efectivo: number; transfer: number } {
  if (metodoEntrega === "efectivo") {
    return { efectivo: totalRecibido, transfer: 0 };
  }
  
  if (metodoEntrega === "transferencia") {
    return { efectivo: 0, transfer: totalRecibido };
  }

  // Mixto
  const ef = usdEfectivo ?? round2(totalRecibido / 2);
  const tr = usdTransfer ?? round2(totalRecibido - ef);
  
  if (round2(ef + tr) !== round2(totalRecibido)) {
    return { efectivo: round2(totalRecibido / 2), transfer: round2(totalRecibido / 2) };
  }
  
  return { efectivo: ef, transfer: tr };
}

export default {
  rateModeByCode,
  getRateModeForPair,
  convertir,
  round2,
  roundN,
  calcularMontoDestino,
  calcularPorcentajeActualizacion,
  distribuirBilletesMonedas,
  normalizarMontosUSD,
};
