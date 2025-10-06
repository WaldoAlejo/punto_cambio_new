-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar Constraints de Validación a movimiento_saldo
-- ═══════════════════════════════════════════════════════════════════════════
-- Fecha: 2025-01-28
-- Propósito: Prevenir que se registren EGRESOS con monto positivo
-- 
-- Esta migración agrega validaciones a nivel de base de datos para garantizar
-- la integridad de los datos en la tabla movimiento_saldo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Agregar constraint: EGRESOS deben tener monto negativo
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE movimiento_saldo
ADD CONSTRAINT check_egreso_monto_negativo
CHECK (
  tipo_movimiento != 'EGRESO' OR monto < 0
);

-- 2. Agregar constraint: INGRESOS deben tener monto positivo
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE movimiento_saldo
ADD CONSTRAINT check_ingreso_monto_positivo
CHECK (
  tipo_movimiento != 'INGRESO' OR monto > 0
);

-- 3. Agregar constraint: SALDO_INICIAL debe tener monto positivo
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE movimiento_saldo
ADD CONSTRAINT check_saldo_inicial_monto_positivo
CHECK (
  tipo_movimiento != 'SALDO_INICIAL' OR monto > 0
);

-- 4. Agregar índice para mejorar performance de consultas por tipo
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_movimiento_saldo_tipo_movimiento
ON movimiento_saldo(tipo_movimiento);

-- 5. Agregar índice compuesto para consultas de auditoría
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_movimiento_saldo_punto_moneda_fecha
ON movimiento_saldo(punto_atencion_id, moneda_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- COMENTARIOS EN LA TABLA
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON CONSTRAINT check_egreso_monto_negativo ON movimiento_saldo IS
'Garantiza que todos los movimientos tipo EGRESO tengan monto negativo';

COMMENT ON CONSTRAINT check_ingreso_monto_positivo ON movimiento_saldo IS
'Garantiza que todos los movimientos tipo INGRESO tengan monto positivo';

COMMENT ON CONSTRAINT check_saldo_inicial_monto_positivo ON movimiento_saldo IS
'Garantiza que todos los movimientos tipo SALDO_INICIAL tengan monto positivo';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar estas consultas después de aplicar la migración para verificar:

-- Verificar que no haya EGRESOS con monto positivo
-- SELECT COUNT(*) as egresos_positivos
-- FROM movimiento_saldo
-- WHERE tipo_movimiento = 'EGRESO' AND monto > 0;
-- Resultado esperado: 0

-- Verificar que no haya INGRESOS con monto negativo
-- SELECT COUNT(*) as ingresos_negativos
-- FROM movimiento_saldo
-- WHERE tipo_movimiento = 'INGRESO' AND monto < 0;
-- Resultado esperado: 0

-- Verificar constraints creados
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'movimiento_saldo'::regclass
-- AND conname LIKE 'check_%';