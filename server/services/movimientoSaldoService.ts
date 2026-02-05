/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO CENTRALIZADO DE MOVIMIENTOS DE SALDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este servicio es la ÚNICA fuente de verdad para registrar movimientos en
 * la tabla `movimiento_saldo`. Garantiza que:
 *
 * 1. Los EGRESOS siempre se registren con monto NEGATIVO
 * 2. Los INGRESOS siempre se registren con monto POSITIVO
 * 3. Los AJUSTES mantengan su signo original
 * 4. Se valide la consistencia antes de insertar
 *
 * ⚠️ REGLA DE ORO:
 * ═══════════════════════════════════════════════════════════════════════════
 * NUNCA registres movimientos directamente en `movimiento_saldo`.
 * SIEMPRE usa este servicio.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

/**
 * Tipos de movimiento permitidos
 */
export enum TipoMovimiento {
  INGRESO = "INGRESO",
  EGRESO = "EGRESO",
  AJUSTE = "AJUSTE",
  SALDO_INICIAL = "SALDO_INICIAL",
}

/**
 * Tipos de referencia para trazabilidad
 */
export enum TipoReferencia {
  EXCHANGE = "EXCHANGE",
  CAMBIO_DIVISA = "CAMBIO_DIVISA",
  TRANSFER = "TRANSFER",
  SERVICIO_EXTERNO = "SERVICIO_EXTERNO",
  AJUSTE_MANUAL = "AJUSTE_MANUAL",
  SALDO_INICIAL = "SALDO_INICIAL",
  CIERRE_DIARIO = "CIERRE_DIARIO",
  SERVIENTREGA = "SERVIENTREGA",
}

/**
 * Parámetros para registrar un movimiento
 */
export interface RegistrarMovimientoParams {
  puntoAtencionId: number | string;
  monedaId: number | string;
  tipoMovimiento: TipoMovimiento;
  monto: number | Prisma.Decimal; // Monto SIN signo aplicado (siempre positivo)
  saldoAnterior: number | Prisma.Decimal;
  saldoNuevo: number | Prisma.Decimal;
  tipoReferencia: TipoReferencia;
  referenciaId?: number | string;
  descripcion?: string | null;
  usuarioId: number | string; // Requerido
}

/**
 * Clase de error personalizada para validaciones
 */
export class MovimientoSaldoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovimientoSaldoError";
  }
}

/**
 * Calcula el monto con el signo correcto según el tipo de movimiento
 */
function calcularMontoConSigno(
  tipoMovimiento: TipoMovimiento,
  monto: number | Prisma.Decimal
): Prisma.Decimal {
  const montoNum = typeof monto === "number" ? monto : monto.toNumber();
  const montoAbsoluto = Math.abs(montoNum);

  switch (tipoMovimiento) {
    case TipoMovimiento.INGRESO:
    case TipoMovimiento.SALDO_INICIAL:
      // INGRESO y SALDO_INICIAL siempre positivos
      return new Prisma.Decimal(montoAbsoluto);

    case TipoMovimiento.EGRESO:
      // EGRESO siempre negativo
      return new Prisma.Decimal(-montoAbsoluto);

    case TipoMovimiento.AJUSTE:
      // AJUSTE mantiene el signo original
      return new Prisma.Decimal(montoNum);

    default:
      throw new MovimientoSaldoError(
        `Tipo de movimiento no válido: ${tipoMovimiento}`
      );
  }
}

/**
 * Valida que el movimiento sea consistente
 */
function validarMovimiento(params: RegistrarMovimientoParams): void {
  const { tipoMovimiento, monto, saldoAnterior, saldoNuevo } = params;

  // Convertir a números para validación
  const montoNum = typeof monto === "number" ? monto : monto.toNumber();
  const saldoAntNum =
    typeof saldoAnterior === "number"
      ? saldoAnterior
      : saldoAnterior.toNumber();
  const saldoNuevoNum =
    typeof saldoNuevo === "number" ? saldoNuevo : saldoNuevo.toNumber();

  // Validar que el monto no sea cero (excepto para ajustes)
  if (montoNum === 0 && tipoMovimiento !== TipoMovimiento.AJUSTE) {
    throw new MovimientoSaldoError(
      `El monto no puede ser cero para movimientos tipo ${tipoMovimiento}`
    );
  }

  // Calcular el delta esperado
  const montoConSigno = calcularMontoConSigno(tipoMovimiento, monto);
  const deltaEsperado = montoConSigno.toNumber();
  const deltaReal = saldoNuevoNum - saldoAntNum;

  // Validar consistencia (con tolerancia de 0.01 por redondeos)
  const diferencia = Math.abs(deltaReal - deltaEsperado);
  if (diferencia > 0.01) {
    throw new MovimientoSaldoError(
      `Inconsistencia detectada:\n` +
        `  Tipo: ${tipoMovimiento}\n` +
        `  Monto: ${montoNum}\n` +
        `  Saldo anterior: ${saldoAntNum}\n` +
        `  Saldo nuevo: ${saldoNuevoNum}\n` +
        `  Delta esperado: ${deltaEsperado}\n` +
        `  Delta real: ${deltaReal}\n` +
        `  Diferencia: ${diferencia}`
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCIÓN PRINCIPAL: Registrar Movimiento de Saldo
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta es la ÚNICA función que debe usarse para registrar movimientos.
 *
 * @param params - Parámetros del movimiento
 * @param tx - Cliente de transacción opcional (para atomicidad)
 * @returns El movimiento creado
 *
 * @example
 * // Registrar un EGRESO (servicio externo)
 * await registrarMovimientoSaldo({
 *   puntoAtencionId: 1,
 *   monedaId: 2,
 *   tipoMovimiento: TipoMovimiento.EGRESO,
 *   monto: 50.00, // ⚠️ Pasar el monto POSITIVO, el servicio aplica el signo
 *   saldoAnterior: 100.00,
 *   saldoNuevo: 50.00,
 *   tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
 *   referenciaId: 123,
 *   descripcion: 'Pago de servicio',
 *   usuarioId: 1
 * });
 * // Resultado: Se registra con monto = -50.00
 *
 * @example
 * // Registrar un INGRESO (cambio de divisa)
 * await registrarMovimientoSaldo({
 *   puntoAtencionId: 1,
 *   monedaId: 2,
 *   tipoMovimiento: TipoMovimiento.INGRESO,
 *   monto: 30.00,
 *   saldoAnterior: 50.00,
 *   saldoNuevo: 80.00,
 *   tipoReferencia: TipoReferencia.EXCHANGE,
 *   referenciaId: 456,
 *   descripcion: 'Cambio de divisa',
 *   usuarioId: 1
 * });
 * // Resultado: Se registra con monto = +30.00
 *
 * @example
 * // Usar dentro de una transacción (RECOMENDADO para atomicidad)
 * await prisma.$transaction(async (tx) => {
 *   // ... otras operaciones ...
 *   await registrarMovimientoSaldo({
 *     puntoAtencionId: 1,
 *     monedaId: 2,
 *     tipoMovimiento: TipoMovimiento.INGRESO,
 *     monto: 30.00,
 *     saldoAnterior: 50.00,
 *     saldoNuevo: 80.00,
 *     tipoReferencia: TipoReferencia.EXCHANGE,
 *     referenciaId: 456,
 *     descripcion: 'Cambio de divisa',
 *     usuarioId: 1
 *   }, tx); // ⚠️ Pasar el cliente de transacción
 * });
 */
export async function registrarMovimientoSaldo(
  params: RegistrarMovimientoParams,
  tx?: Prisma.TransactionClient
) {
  // 1. Validar el movimiento
  validarMovimiento(params);

  // 2. Calcular el monto con el signo correcto
  const montoConSigno = calcularMontoConSigno(
    params.tipoMovimiento,
    params.monto
  );

  // 3. Usar el cliente de transacción si se proporciona, sino usar prisma directamente
  const client = tx || prisma;

  // 4. Registrar en la base de datos
  const movimiento = await client.movimientoSaldo.create({
    data: {
      punto_atencion_id: String(params.puntoAtencionId),
      moneda_id: String(params.monedaId),
      tipo_movimiento: params.tipoMovimiento,
      monto: montoConSigno,
      saldo_anterior: new Prisma.Decimal(params.saldoAnterior),
      saldo_nuevo: new Prisma.Decimal(params.saldoNuevo),
      tipo_referencia: params.tipoReferencia,
      referencia_id: params.referenciaId ? String(params.referenciaId) : null,
      descripcion: params.descripcion || null,
      usuario_id: String(params.usuarioId),
    },
  });

  // 5. Mantener la tabla `Saldo` sincronizada con el saldo_nuevo del movimiento
  // Nota: no tocamos billetes/monedas_fisicas/bancos aquí; esos se manejan por flujos específicos.
  await client.saldo.upsert({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: String(params.puntoAtencionId),
        moneda_id: String(params.monedaId),
      },
    },
    update: {
      cantidad: new Prisma.Decimal(params.saldoNuevo),
      // updated_at se actualiza automáticamente por @updatedAt
    },
    create: {
      punto_atencion_id: String(params.puntoAtencionId),
      moneda_id: String(params.monedaId),
      cantidad: new Prisma.Decimal(params.saldoNuevo),
      billetes: 0,
      monedas_fisicas: 0,
      bancos: 0,
    },
  });

  return movimiento;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCIÓN AUXILIAR: Calcular Delta
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Calcula el delta (cambio en saldo) según el tipo de movimiento.
 * Útil para calcular el nuevo saldo antes de registrar el movimiento.
 *
 * @param tipoMovimiento - Tipo de movimiento
 * @param monto - Monto del movimiento (siempre positivo)
 * @returns Delta con el signo correcto
 *
 * @example
 * const saldoAnterior = 100;
 * const monto = 30;
 * const delta = calcularDelta(TipoMovimiento.EGRESO, monto); // -30
 * const saldoNuevo = saldoAnterior + delta; // 70
 */
export function calcularDelta(
  tipoMovimiento: TipoMovimiento,
  monto: number | Prisma.Decimal
): number {
  return calcularMontoConSigno(tipoMovimiento, monto).toNumber();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCIÓN DE UTILIDAD: Validar Saldo Suficiente
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida que haya saldo suficiente para realizar un EGRESO.
 *
 * @param saldoActual - Saldo actual
 * @param montoEgreso - Monto del egreso (positivo)
 * @returns true si hay saldo suficiente
 * @throws MovimientoSaldoError si no hay saldo suficiente
 */
export function validarSaldoSuficiente(
  saldoActual: number | Prisma.Decimal,
  montoEgreso: number | Prisma.Decimal
): boolean {
  const saldoNum =
    typeof saldoActual === "number" ? saldoActual : saldoActual.toNumber();
  const montoNum =
    typeof montoEgreso === "number" ? montoEgreso : montoEgreso.toNumber();
  const montoAbsoluto = Math.abs(montoNum);

  if (saldoNum < montoAbsoluto) {
    throw new MovimientoSaldoError(
      `Saldo insuficiente: Saldo actual = ${saldoNum}, Monto requerido = ${montoAbsoluto}`
    );
  }

  return true;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTACIONES
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default {
  registrarMovimientoSaldo,
  calcularDelta,
  validarSaldoSuficiente,
  TipoMovimiento,
  TipoReferencia,
  MovimientoSaldoError,
};
