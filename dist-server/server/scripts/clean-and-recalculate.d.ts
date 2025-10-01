/**
 * Script para eliminar todos los ajustes y recalcular saldos desde cero
 *
 * PROPÓSITO:
 * - Eliminar todos los movimientos de tipo "AJUSTE" de la base de datos
 * - Recalcular todos los saldos basándose únicamente en movimientos reales
 * - No crear ningún tipo de ajuste, solo sumar y restar movimientos reales
 *
 * PROCESO:
 * 1. Eliminar todos los MovimientoSaldo de tipo "AJUSTE"
 * 2. Para cada punto de atención y moneda:
 *    - Calcular saldo basado en movimientos reales (INGRESO/EGRESO)
 *    - Actualizar tabla Saldo con el valor calculado
 * 3. Reportar diferencias encontradas sin crear ajustes
 */
export {};
