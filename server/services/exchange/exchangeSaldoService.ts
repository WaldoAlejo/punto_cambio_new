/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE MANEJO DE SALDOS PARA CAMBIOS DE DIVISA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Gestiona la actualización de saldos y registro de movimientos.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../movimientoSaldoService.js";
import { round2 } from "./exchangeCalculationService.js";

const prisma = new PrismaClient();

export interface SaldoUpdateData {
  puntoAtencionId: string;
  monedaId: string;
  cantidad: number;
  billetes?: number;
  monedasFisicas?: number;
  bancos?: number;
}

/**
 * Obtiene el saldo actual de un punto/moneda
 */
export async function getSaldo(
  tx: Prisma.TransactionClient,
  puntoId: string,
  monedaId: string
) {
  return tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
      },
    },
  });
}

/**
 * Crea o actualiza el saldo de un punto
 */
export async function upsertSaldo(
  tx: Prisma.TransactionClient,
  data: SaldoUpdateData
) {
  const existing = await getSaldo(tx, data.puntoAtencionId, data.monedaId);

  const cantidadFinal = round2(data.cantidad);
  const billetesFinal = round2(data.billetes ?? 0);
  const monedasFinal = round2(data.monedasFisicas ?? 0);
  const bancosFinal = round2(data.bancos ?? 0);

  if (existing) {
    return tx.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: data.puntoAtencionId,
          moneda_id: data.monedaId,
        },
      },
      data: {
        cantidad: cantidadFinal,
        billetes: billetesFinal,
        monedas_fisicas: monedasFinal,
        bancos: bancosFinal,
        updated_at: new Date(),
      },
    });
  }

  return tx.saldo.create({
    data: {
      punto_atencion_id: data.puntoAtencionId,
      moneda_id: data.monedaId,
      cantidad: cantidadFinal,
      billetes: billetesFinal,
      monedas_fisicas: monedasFinal,
      bancos: bancosFinal,
      updated_at: new Date(),
    },
  });
}

/**
 * Registra un movimiento de ingreso (moneda origen)
 */
export async function registrarIngresoOrigen(
  tx: Prisma.TransactionClient,
  data: {
    puntoAtencionId: string;
    monedaId: string;
    montoEfectivo: number;
    montoBancos: number;
    saldoAnteriorEf: number;
    saldoAnteriorBk: number;
    cambioId: string;
    numeroRecibo: string;
    usuarioId: string;
  }
): Promise<void> {
  if (data.montoEfectivo > 0) {
    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaId,
        tipoMovimiento: TipoMovimiento.INGRESO,
        monto: data.montoEfectivo,
        saldoAnterior: data.saldoAnteriorEf,
        saldoNuevo: round2(data.saldoAnteriorEf + data.montoEfectivo),
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: `Ingreso por cambio (efectivo, origen) ${data.numeroRecibo}`,
        saldoBucket: "CAJA",
        usuarioId: data.usuarioId,
      },
      tx
    );
  }

  if (data.montoBancos > 0) {
    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaId,
        tipoMovimiento: TipoMovimiento.INGRESO,
        monto: data.montoBancos,
        saldoAnterior: data.saldoAnteriorBk,
        saldoNuevo: round2(data.saldoAnteriorBk + data.montoBancos),
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: `Ingreso por cambio (bancos, origen) - NO afecta cuadre físico`,
        saldoBucket: "BANCOS",
        usuarioId: data.usuarioId,
      },
      tx
    );
  }
}

/**
 * Registra un movimiento de egreso (moneda destino)
 */
export async function registrarEgresoDestino(
  tx: Prisma.TransactionClient,
  data: {
    puntoAtencionId: string;
    monedaId: string;
    montoEfectivo: number;
    montoBancos: number;
    saldoAnteriorEf: number;
    saldoAnteriorBk: number;
    cambioId: string;
    numeroRecibo: string;
    transferenciaBanco?: string;
    transferenciaNumero?: string;
    usuarioId: string;
  }
): Promise<void> {
  if (data.montoEfectivo > 0) {
    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaId,
        tipoMovimiento: TipoMovimiento.EGRESO,
        monto: data.montoEfectivo,
        saldoAnterior: data.saldoAnteriorEf,
        saldoNuevo: round2(data.saldoAnteriorEf - data.montoEfectivo),
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: `Egreso por cambio (efectivo, destino) ${data.numeroRecibo}`,
        saldoBucket: "CAJA",
        usuarioId: data.usuarioId,
      },
      tx
    );
  }

  if (data.montoBancos > 0) {
    const descripcionBanco = data.transferenciaBanco
      ? `Egreso por cambio (banco: ${data.transferenciaBanco}, ref: ${data.transferenciaNumero || ""})`
      : `Egreso por cambio (bancos, destino)`;

    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaId,
        tipoMovimiento: TipoMovimiento.EGRESO,
        monto: data.montoBancos,
        saldoAnterior: data.saldoAnteriorBk,
        saldoNuevo: round2(data.saldoAnteriorBk - data.montoBancos),
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: descripcionBanco,
        saldoBucket: "BANCOS",
        usuarioId: data.usuarioId,
      },
      tx
    );
  }
}

/**
 * Verifica y crea movimientos faltantes como contingencia
 */
export async function verificarYCrearMovimientosFaltantes(
  tx: Prisma.TransactionClient,
  data: {
    cambioId: string;
    numeroRecibo: string;
    puntoAtencionId: string;
    monedaOrigenId: string;
    monedaDestinoId: string;
    montoOrigen: number;
    montoDestino: number;
    saldoOrigenAnterior: number;
    saldoDestinoAnterior: number;
    saldoOrigenNuevo: number;
    saldoDestinoNuevo: number;
    usuarioId: string;
  }
): Promise<void> {
  const movimientosCreados = await tx.movimientoSaldo.count({
    where: {
      tipo_referencia: "EXCHANGE",
      referencia_id: data.cambioId,
    },
  });

  if (movimientosCreados >= 2) return; // Todo OK

  console.warn(
    `[AUTO-FIX] Cambio ${data.cambioId} (${data.numeroRecibo}) solo tiene ${movimientosCreados} movimientos. Creando faltantes...`
  );

  const movimientosExistentes = await tx.movimientoSaldo.findMany({
    where: {
      tipo_referencia: "EXCHANGE",
      referencia_id: data.cambioId,
    },
    select: { moneda_id: true, tipo_movimiento: true },
  });

  const tieneIngreso = movimientosExistentes.some(
    (m) => m.moneda_id === data.monedaOrigenId && m.tipo_movimiento === "INGRESO"
  );
  const tieneEgreso = movimientosExistentes.some(
    (m) => m.moneda_id === data.monedaDestinoId && m.tipo_movimiento === "EGRESO"
  );

  if (!tieneIngreso) {
    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaOrigenId,
        tipoMovimiento: TipoMovimiento.INGRESO,
        monto: data.montoOrigen,
        saldoAnterior: data.saldoOrigenAnterior,
        saldoNuevo: data.saldoOrigenNuevo,
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: `Ingreso por cambio ${data.numeroRecibo} (auto-creado)`,
        usuarioId: data.usuarioId,
      },
      tx
    );
  }

  if (!tieneEgreso) {
    await registrarMovimientoSaldo(
      {
        puntoAtencionId: data.puntoAtencionId,
        monedaId: data.monedaDestinoId,
        tipoMovimiento: TipoMovimiento.EGRESO,
        monto: data.montoDestino,
        saldoAnterior: data.saldoDestinoAnterior,
        saldoNuevo: data.saldoDestinoNuevo,
        tipoReferencia: TipoReferencia.CAMBIODIVISA,
        referenciaId: data.cambioId,
        descripcion: `Egreso por cambio ${data.numeroRecibo} (auto-creado)`,
        usuarioId: data.usuarioId,
      },
      tx
    );
  }
}

export default {
  getSaldo,
  upsertSaldo,
  registrarIngresoOrigen,
  registrarEgresoDestino,
  verificarYCrearMovimientosFaltantes,
};
