/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE CÁLCULO DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza el cálculo de saldos desde movimientos y validaciones.
 * Usado por: exchanges, transfers, servicios-externos
 */

import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

/**
 * Calcula el saldo de CAJA desde movimientos (igual que la UI).
 * Acepta un cliente de Prisma (global o transacción) para flexibilidad.
 */
export async function calcularSaldoCajaDesdeMovimientos(
  puntoAtencionId: string,
  monedaId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  // 1. Obtener saldo inicial más reciente
  const saldoInicial = await tx.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  let saldoCalculado = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
  const fechaCorte = saldoInicial?.fecha_asignacion ?? null;

  // 2. Obtener movimientos (excluyendo bancarios)
  const movimientos = await tx.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      ...(fechaCorte ? { created_at: { gte: fechaCorte } } : {}),
    },
    select: { monto: true, tipo_movimiento: true, descripcion: true },
    orderBy: { fecha: "asc" },
  });

  // 3. Filtrar movimientos bancarios y calcular saldo
  for (const mov of movimientos) {
    const desc = (mov.descripcion ?? "").toLowerCase();
    
    // Si el movimiento está marcado como "(CAJA)", SIEMPRE afecta caja
    if (desc.includes("(caja)")) {
      const monto = Number(mov.monto);
      if (!isNaN(monto) && isFinite(monto)) {
        saldoCalculado += monto;
      }
      continue;
    }
    
    // Excluir cuando 'banco'/'bancos' aparece como palabra completa
    const hasBancoWord = /\bbancos?\b/i.test(desc);
    if (hasBancoWord) continue;

    // Aplicar monto según tipo
    const tipo = (mov.tipo_movimiento || "").toUpperCase();
    const monto = Number(mov.monto);
    
    if (isNaN(monto) || !isFinite(monto)) continue;
    
    if (tipo === "SALDO_INICIAL") continue; // Ya está incluido
    
    // Normalizar signo para tipos conocidos
    if (tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE" || tipo === "TRANSFERENCIA_SALIDA") {
      saldoCalculado -= Math.abs(monto);
    } else if (tipo === "INGRESO" || tipo === "TRANSFERENCIA_ENTRANTE" || tipo === "TRANSFERENCIA_ENTRADA") {
      saldoCalculado += Math.abs(monto);
    } else {
      // Para otros tipos, usar el monto tal cual (puede ser negativo o positivo)
      saldoCalculado += monto;
    }
  }

  return saldoCalculado;
}

/**
 * Obtiene el saldo actual desde la tabla Saldo (más rápido)
 * Incluye efectivo + bancos
 */
export async function obtenerSaldoActual(
  puntoAtencionId: string,
  monedaId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const saldo = await tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
  });

  if (!saldo) return 0;

  // Retornar la suma de cantidad (efectivo total) Y bancos
  const saldoEfectivo = Number(saldo.cantidad || 0);
  const saldoBancos = Number(saldo.bancos || 0);
  
  return saldoEfectivo + saldoBancos;
}

/**
 * Obtiene el desglose de saldo (billetes, monedas, bancos)
 */
export async function obtenerSaldoDesglose(
  puntoAtencionId: string,
  monedaId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{
  total: number;
  billetes: number;
  monedas: number;
  bancos: number;
}> {
  const saldo = await tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    },
  });

  const billetes = Number(saldo?.billetes || 0);
  const monedas = Number(saldo?.monedas_fisicas || 0);
  const bancos = Number(saldo?.bancos || 0);
  const total = Number(saldo?.cantidad || 0) + bancos;

  return { total, billetes, monedas, bancos };
}

/**
 * Valida si hay saldo suficiente para una operación
 * Retorna objeto con resultado y detalles
 */
export async function validarSaldoSuficiente(
  puntoAtencionId: string,
  monedaId: string,
  montoRequerido: number,
  options: {
    usarMovimientos?: boolean;
    validarBancos?: boolean;
    montoBancos?: number;
    tx?: Prisma.TransactionClient | typeof prisma;
  } = {}
): Promise<{
  valido: boolean;
  saldoActual: number;
  deficit: number;
  detalles?: {
    billetes: number;
    monedas: number;
    bancos: number;
  };
}> {
  const { usarMovimientos = false, validarBancos = false, montoBancos = 0, tx = prisma } = options;
  
  let saldoActual: number;
  let detalles;

  if (usarMovimientos) {
    saldoActual = await calcularSaldoCajaDesdeMovimientos(puntoAtencionId, monedaId, tx);
  } else {
    const desglose = await obtenerSaldoDesglose(puntoAtencionId, monedaId, tx);
    saldoActual = desglose.total;
    detalles = desglose;
  }

  // Validar saldo de caja
  if (saldoActual < montoRequerido) {
    return {
      valido: false,
      saldoActual,
      deficit: montoRequerido - saldoActual,
      detalles,
    };
  }

  // Validar saldo de bancos si es necesario
  if (validarBancos && montoBancos > 0 && detalles) {
    if (detalles.bancos < montoBancos) {
      return {
        valido: false,
        saldoActual: detalles.bancos,
        deficit: montoBancos - detalles.bancos,
        detalles,
      };
    }
  }

  return {
    valido: true,
    saldoActual,
    deficit: 0,
    detalles,
  };
}

export default {
  calcularSaldoCajaDesdeMovimientos,
  obtenerSaldoActual,
  obtenerSaldoDesglose,
  validarSaldoSuficiente,
};
