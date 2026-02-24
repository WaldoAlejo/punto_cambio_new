/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE VALIDACIONES DE CAMBIO DE DIVISA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza todas las validaciones de cambios de divisa.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { round2 } from "./exchangeCalculationService.js";
import { MAX_RATE_ALLOWED } from "../../types/index.js";

const prisma = new PrismaClient();

export interface ValidationError {
  field: string;
  message: string;
}

export interface ExchangeValidationInput {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio_billetes?: number;
  tasa_cambio_monedas?: number;
  tipo_operacion: string;
  punto_atencion_id: string;
  metodo_entrega?: string;
  transferencia_banco?: string;
  transferencia_numero?: string;
  divisas_entregadas_billetes?: number;
  divisas_entregadas_monedas?: number;
  divisas_recibidas_billetes?: number;
  divisas_recibidas_monedas?: number;
}

/**
 * Valida los datos básicos del cambio de divisa
 */
export async function validarDatosBasicos(
  data: ExchangeValidationInput
): Promise<{ valid: boolean; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];

  // Validar monedas diferentes
  if (data.moneda_origen_id === data.moneda_destino_id) {
    errors.push({
      field: "monedas",
      message: "Moneda origen y destino no pueden ser iguales",
    });
  }

  // Validar montos positivos
  if (!(data.monto_origen > 0)) {
    errors.push({
      field: "monto_origen",
      message: "El monto origen debe ser mayor a 0",
    });
  }

  if (!(data.monto_destino > 0)) {
    errors.push({
      field: "monto_destino",
      message: "El monto destino debe ser mayor a 0",
    });
  }

  // Validar punto de atención existe
  const punto = await prisma.puntoAtencion.findUnique({
    where: { id: data.punto_atencion_id },
  });

  if (!punto) {
    errors.push({
      field: "punto_atencion_id",
      message: "Punto de atención no encontrado",
    });
  }

  // Validar monedas existen
  const [monedaOrigen, monedaDestino] = await Promise.all([
    prisma.moneda.findUnique({ where: { id: data.moneda_origen_id } }),
    prisma.moneda.findUnique({ where: { id: data.moneda_destino_id } }),
  ]);

  if (!monedaOrigen) {
    errors.push({
      field: "moneda_origen_id",
      message: "Moneda origen no encontrada",
    });
  }

  if (!monedaDestino) {
    errors.push({
      field: "moneda_destino_id",
      message: "Moneda destino no encontrada",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida las tasas de cambio
 */
export function validarTasas(
  tasaBilletes: number,
  tasaMonedas: number,
  montoBilletes: number,
  montoMonedas: number
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const requiereTasaBilletes = montoBilletes > 0;
  const requiereTasaMonedas = montoMonedas > 0;

  if (requiereTasaBilletes) {
    const tb = Number(tasaBilletes);
    if (!Number.isFinite(tb) || tb <= 0 || Math.abs(tb) >= MAX_RATE_ALLOWED) {
      errors.push({
        field: "tasa_cambio_billetes",
        message: `Tasa de billetes inválida. Debe ser > 0 y < ${MAX_RATE_ALLOWED}`,
      });
    }
  }

  if (requiereTasaMonedas) {
    const tm = Number(tasaMonedas);
    if (!Number.isFinite(tm) || tm <= 0 || Math.abs(tm) >= MAX_RATE_ALLOWED) {
      errors.push({
        field: "tasa_cambio_monedas",
        message: `Tasa de monedas inválida. Debe ser > 0 y < ${MAX_RATE_ALLOWED}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida datos de transferencia bancaria
 */
export function validarTransferencia(
  metodoEntrega: string,
  banco?: string,
  numero?: string
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (metodoEntrega === "transferencia") {
    if (!banco || !String(banco).trim()) {
      errors.push({
        field: "transferencia_banco",
        message: "Banco requerido para transferencia",
      });
    }
    if (!numero || !String(numero).trim()) {
      errors.push({
        field: "transferencia_numero",
        message: "Número de referencia requerido para transferencia",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida saldo suficiente para el egreso (moneda destino)
 */
export async function validarSaldoSuficiente(
  puntoAtencionId: string,
  monedaId: string,
  montoRequerido: number,
  billetesRequeridos: number,
  monedasRequeridas: number
): Promise<{ valid: boolean; error?: string; details?: Record<string, number> }> {
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
  });

  const saldoEfectivo = Number(saldo?.cantidad || 0);
  const saldoBilletes = Number(saldo?.billetes || 0);
  const saldoMonedas = Number(saldo?.monedas_fisicas || 0);
  const saldoBancos = Number(saldo?.bancos || 0);
  const saldoFisicoTotal = saldoBilletes + saldoMonedas;

  // Validar saldo efectivo total
  if (saldoEfectivo < montoRequerido - 0.01) {
    return {
      valid: false,
      error: `Saldo insuficiente. Disponible: $${saldoEfectivo.toFixed(2)}, Requerido: $${montoRequerido.toFixed(2)}`,
      details: {
        saldoEfectivo,
        saldoBilletes,
        saldoMonedas,
        saldoBancos,
        montoRequerido,
        deficit: montoRequerido - saldoEfectivo,
      },
    };
  }

  // Validar saldo físico suficiente
  if (saldoFisicoTotal < montoRequerido - 0.01) {
    return {
      valid: false,
      error: `Saldo físico insuficiente. Disponible: $${saldoFisicoTotal.toFixed(2)} (${saldoBilletes.toFixed(2)} billetes + ${saldoMonedas.toFixed(2)} monedas)`,
      details: {
        saldoFisicoTotal,
        saldoBilletes,
        saldoMonedas,
        montoRequerido,
        deficit: montoRequerido - saldoFisicoTotal,
      },
    };
  }

  return { valid: true };
}

/**
 * Valida coherencia de desglose físico vs monto total
 */
export function validarDesgloseFisico(
  montoTotal: number,
  billetes: number,
  monedas: number,
  metodoEntrega: string
): { valid: boolean; error?: string } {
  if (metodoEntrega === "transferencia") {
    // Transferencia no requiere desglose físico
    return { valid: true };
  }

  const sumaFisica = round2(billetes + monedas);

  if (Math.abs(sumaFisica - montoTotal) > 0.01) {
    return {
      valid: false,
      error: `Desglose físico inconsistente: billetes+monedas ($${sumaFisica.toFixed(2)}) debe igualar monto ($${montoTotal.toFixed(2)})`,
    };
  }

  return { valid: true };
}

export default {
  validarDatosBasicos,
  validarTasas,
  validarTransferencia,
  validarSaldoSuficiente,
  validarDesgloseFisico,
};
