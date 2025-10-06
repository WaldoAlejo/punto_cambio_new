-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK: Constraints de Movimiento Saldo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Este script REVIERTE los cambios aplicados por:
-- 2025-01-28-add-movimiento-saldo-constraints.sql
--
-- ⚠️ USAR SOLO EN CASO DE EMERGENCIA
--
-- Fecha: 2025-01-28
-- Autor: Sistema
-- Propósito: Rollback de constraints de validación
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ELIMINAR CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Eliminar constraint: EGRESO debe ser negativo
ALTER TABLE movimiento_saldo
DROP CONSTRAINT IF EXISTS check_egreso_monto_negativo;

COMMENT ON CONSTRAINT check_egreso_monto_negativo ON movimiento_saldo IS NULL;

-- Eliminar constraint: INGRESO debe ser positivo
ALTER TABLE movimiento_saldo
DROP CONSTRAINT IF EXISTS check_ingreso_monto_positivo;

COMMENT ON CONSTRAINT check_ingreso_monto_positivo ON movimiento_saldo IS NULL;

-- Eliminar constraint: SALDO_INICIAL debe ser positivo
ALTER TABLE movimiento_saldo
DROP CONSTRAINT IF EXISTS check_saldo_inicial_monto_positivo;

COMMENT ON CONSTRAINT check_saldo_inicial_monto_positivo ON movimiento_saldo IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ELIMINAR ÍNDICES
-- ═══════════════════════════════════════════════════════════════════════════

-- Eliminar índice por tipo de movimiento
DROP INDEX IF EXISTS idx_movimiento_saldo_tipo_movimiento;

-- Eliminar índice compuesto para auditoría
DROP INDEX IF EXISTS idx_movimiento_saldo_punto_moneda_fecha;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar que los constraints fueron eliminados
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'movimiento_saldo'::regclass
    AND conname IN (
        'check_egreso_monto_negativo',
        'check_ingreso_monto_positivo',
        'check_saldo_inicial_monto_positivo'
    );
    
    IF constraint_count > 0 THEN
        RAISE EXCEPTION 'ERROR: Algunos constraints no fueron eliminados correctamente';
    ELSE
        RAISE NOTICE '✅ Todos los constraints fueron eliminados correctamente';
    END IF;
END $$;

-- Verificar que los índices fueron eliminados
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'movimiento_saldo'
    AND indexname IN (
        'idx_movimiento_saldo_tipo_movimiento',
        'idx_movimiento_saldo_punto_moneda_fecha'
    );
    
    IF index_count > 0 THEN
        RAISE EXCEPTION 'ERROR: Algunos índices no fueron eliminados correctamente';
    ELSE
        RAISE NOTICE '✅ Todos los índices fueron eliminados correctamente';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. COMMIT
-- ═══════════════════════════════════════════════════════════════════════════

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- RESUMEN
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
    '✅ ROLLBACK COMPLETADO' as status,
    'Los constraints y índices han sido eliminados' as message,
    NOW() as timestamp;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTAS IMPORTANTES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Después de ejecutar este rollback:
--
-- 1. La base de datos NO validará que los EGRESOS sean negativos
-- 2. La base de datos NO validará que los INGRESOS sean positivos
-- 3. Es posible insertar datos inconsistentes directamente en la BD
-- 4. El servicio centralizado (movimientoSaldoService.ts) seguirá funcionando
--    pero sin la protección adicional de la base de datos
--
-- ⚠️ RECOMENDACIÓN:
-- Solo usar este rollback si hay un problema crítico con los constraints.
-- Después de resolver el problema, volver a aplicar la migración original.
--
-- ═══════════════════════════════════════════════════════════════════════════