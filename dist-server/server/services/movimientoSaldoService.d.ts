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
import { Prisma } from "@prisma/client";
/**
 * Tipos de movimiento permitidos
 */
export declare enum TipoMovimiento {
    INGRESO = "INGRESO",
    EGRESO = "EGRESO",
    AJUSTE = "AJUSTE",
    SALDO_INICIAL = "SALDO_INICIAL"
}
/**
 * Tipos de referencia para trazabilidad
 */
export declare enum TipoReferencia {
    EXCHANGE = "EXCHANGE",
    TRANSFER = "TRANSFER",
    SERVICIO_EXTERNO = "SERVICIO_EXTERNO",
    AJUSTE_MANUAL = "AJUSTE_MANUAL",
    SALDO_INICIAL = "SALDO_INICIAL",
    CIERRE_DIARIO = "CIERRE_DIARIO",
    SERVIENTREGA = "SERVIENTREGA"
}
/**
 * Parámetros para registrar un movimiento
 */
export interface RegistrarMovimientoParams {
    puntoAtencionId: number | string;
    monedaId: number | string;
    tipoMovimiento: TipoMovimiento;
    monto: number | Prisma.Decimal;
    saldoAnterior: number | Prisma.Decimal;
    saldoNuevo: number | Prisma.Decimal;
    tipoReferencia: TipoReferencia;
    referenciaId?: number | string;
    descripcion?: string | null;
    usuarioId: number | string;
}
/**
 * Clase de error personalizada para validaciones
 */
export declare class MovimientoSaldoError extends Error {
    constructor(message: string);
}
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCIÓN PRINCIPAL: Registrar Movimiento de Saldo
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta es la ÚNICA función que debe usarse para registrar movimientos.
 *
 * @param params - Parámetros del movimiento
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
 */
export declare function registrarMovimientoSaldo(params: RegistrarMovimientoParams): Promise<{
    id: string;
    punto_atencion_id: string;
    created_at: Date;
    fecha: Date;
    usuario_id: string;
    moneda_id: string;
    tipo_movimiento: string;
    descripcion: string | null;
    monto: Prisma.Decimal;
    saldo_anterior: Prisma.Decimal;
    saldo_nuevo: Prisma.Decimal;
    referencia_id: string | null;
    tipo_referencia: string | null;
}>;
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
export declare function calcularDelta(tipoMovimiento: TipoMovimiento, monto: number | Prisma.Decimal): number;
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
export declare function validarSaldoSuficiente(saldoActual: number | Prisma.Decimal, montoEgreso: number | Prisma.Decimal): boolean;
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTACIONES
 * ═══════════════════════════════════════════════════════════════════════════
 */
declare const _default: {
    registrarMovimientoSaldo: typeof registrarMovimientoSaldo;
    calcularDelta: typeof calcularDelta;
    validarSaldoSuficiente: typeof validarSaldoSuficiente;
    TipoMovimiento: typeof TipoMovimiento;
    TipoReferencia: typeof TipoReferencia;
    MovimientoSaldoError: typeof MovimientoSaldoError;
};
export default _default;
