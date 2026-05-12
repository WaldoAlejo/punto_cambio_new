/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE CÁLCULOS DE CAMBIO DE DIVISA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza todos los cálculos relacionados con tasas de cambio,
 * conversiones y redondeos.
 */

import { TipoOperacion } from "@prisma/client";


/**
 * Convierte un monto según el comportamiento de la moneda (MULTIPLICA/DIVIDE)
 * tal como está configurado en la base de datos.
 * Esto reemplaza la lógica hardcodeada rateModeByCode para mantener
 * consistencia con el frontend.
 */
export function convertirPorComportamiento(
  comportamiento: string,
  montoOrigen: number,
  tasa: number
): { montoDestinoCalc: number } {
  if (!Number.isFinite(tasa) || tasa <= 0) return { montoDestinoCalc: 0 };
  if (!Number.isFinite(montoOrigen) || montoOrigen < 0) return { montoDestinoCalc: 0 };

  if (comportamiento === "DIVIDE") {
    return { montoDestinoCalc: montoOrigen / tasa };
  }
  // Default MULTIPLICA (incluye comportamiento vacío o null)
  return { montoDestinoCalc: montoOrigen * tasa };
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
 * usando los comportamientos configurados en la base de datos.
 */
export function calcularMontoDestino(
  amountBilletes: number,
  amountMonedas: number,
  rateBilletes: number,
  rateMonedas: number,
  comportamientoBilletes: string,
  comportamientoMonedas: string
): number {
  let totalCalc = 0;

  if (amountBilletes > 0 && rateBilletes > 0) {
    const { montoDestinoCalc } = convertirPorComportamiento(
      comportamientoBilletes || "MULTIPLICA",
      amountBilletes,
      rateBilletes
    );
    if (montoDestinoCalc > 0) totalCalc += montoDestinoCalc;
  }

  if (amountMonedas > 0 && rateMonedas > 0) {
    const { montoDestinoCalc } = convertirPorComportamiento(
      comportamientoMonedas || "MULTIPLICA",
      amountMonedas,
      rateMonedas
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
  convertirPorComportamiento,
  round2,
  roundN,
  calcularMontoDestino,
  calcularPorcentajeActualizacion,
  distribuirBilletesMonedas,
  normalizarMontosUSD,
};
