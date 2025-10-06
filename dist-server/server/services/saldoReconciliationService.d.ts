export interface ReconciliationResult {
    success: boolean;
    saldoAnterior: number;
    saldoCalculado: number;
    diferencia: number;
    corregido: boolean;
    movimientosCount: number;
    error?: string;
}
export interface ReconciliationSummary {
    puntoAtencionId: string;
    puntoNombre: string;
    monedaId: string;
    monedaCodigo: string;
    saldoRegistrado: number;
    saldoCalculado: number;
    diferencia: number;
    requiereCorreccion: boolean;
}
/**
 * Servicio de Auto-Reconciliación de Saldos
 *
 * Este servicio garantiza que los saldos siempre estén cuadrados con los movimientos registrados,
 * evitando inconsistencias como la encontrada en el punto AMAZONAS.
 */
export declare const saldoReconciliationService: {
    /**
     * Calcula el saldo correcto basado en todos los movimientos registrados
     *
     * ⚠️ IMPORTANTE: Esta lógica debe coincidir EXACTAMENTE con calcular-saldos.ts
     *
     * Reglas:
     * 1. Los EGRESOS se guardan con monto NEGATIVO en la BD
     * 2. Los INGRESOS se guardan con monto POSITIVO en la BD
     * 3. Los AJUSTES mantienen su signo original
     * 4. Se excluyen movimientos con descripción que contenga "bancos"
     */
    calcularSaldoReal(puntoAtencionId: string, monedaId: string): Promise<number>;
    /**
     * Reconcilia automáticamente un saldo específico
     */
    reconciliarSaldo(puntoAtencionId: string, monedaId: string, usuarioId?: string): Promise<ReconciliationResult>;
    /**
     * Reconcilia todos los saldos de un punto de atención
     */
    reconciliarTodosPuntoAtencion(puntoAtencionId: string, usuarioId?: string): Promise<ReconciliationResult[]>;
    /**
     * Genera un reporte de inconsistencias en todos los puntos
     */
    generarReporteInconsistencias(): Promise<ReconciliationSummary[]>;
    /**
     * Función de utilidad para verificar si un saldo está cuadrado
     */
    verificarSaldoCuadrado(puntoAtencionId: string, monedaId: string): Promise<boolean>;
};
export default saldoReconciliationService;
