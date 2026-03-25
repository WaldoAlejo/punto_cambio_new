-- ============================================
-- Script para limpiar duplicados y crear índice único parcial
-- Ejecutar: npx prisma db execute --file scripts/fix-duplicate-movimientos.sql
-- ============================================

-- PASO 1: Eliminar duplicados de SALDO_INICIAL (mantener solo el más reciente)
-- Esto limpia datos históricos corruptos sin afectar la lógica de negocio

WITH duplicates AS (
  SELECT 
    referencia_id,
    tipo_referencia,
    moneda_id,
    tipo_movimiento,
    MAX(fecha) as max_fecha
  FROM "MovimientoSaldo"
  WHERE tipo_referencia = 'SALDO_INICIAL'
    AND referencia_id IS NOT NULL
  GROUP BY referencia_id, tipo_referencia, moneda_id, tipo_movimiento
  HAVING COUNT(*) > 1
),
to_delete AS (
  SELECT m.id
  FROM "MovimientoSaldo" m
  INNER JOIN duplicates d ON 
    m.referencia_id = d.referencia_id
    AND m.tipo_referencia = d.tipo_referencia
    AND m.moneda_id = d.moneda_id
    AND m.tipo_movimiento = d.tipo_movimiento
  WHERE m.fecha < d.max_fecha
)
DELETE FROM "MovimientoSaldo"
WHERE id IN (SELECT id FROM to_delete);

-- PASO 2: Verificar si quedan duplicados de otros tipos
-- Si hay duplicados de EXCHANGE o TRANSFERENCIA, deben revisarse manualmente

-- PASO 3: Crear índice único parcial para prevenir race conditions
-- Solo aplica a movimientos críticos (EXCHANGE, TRANSFERENCIA)
-- Los SALDO_INICIAL pueden tener múltiples movimientos por recargas

CREATE UNIQUE INDEX IF NOT EXISTS "idx_movimiento_unico_critico"
ON "MovimientoSaldo" (referencia_id, tipo_referencia, moneda_id, tipo_movimiento)
WHERE tipo_referencia IN ('EXCHANGE', 'TRANSFERENCIA', 'SERVICIO_EXTERNO');

-- Nota: El índice parcial solo aplica a las filas que cumplen la condición WHERE
-- Esto permite que SALDO_INICIAL tenga múltiples movimientos si es necesario
-- pero previene duplicados en operaciones financieras críticas
