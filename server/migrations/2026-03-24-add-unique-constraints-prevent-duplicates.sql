-- ============================================================================
-- MIGRACIÓN CRÍTICA: Prevenir duplicados en movimientos y transacciones
-- Fecha: 24 de marzo 2026
-- Problema: Race conditions causando duplicados en producción
-- ============================================================================

-- =============================================================================
-- 1. ÍNDICE ÚNICO PARA MOVIMIENTOS DE SALDO (PREVENIR DUPLICADOS)
-- =============================================================================
-- Este índice previene que se creen movimientos duplicados por race condition
-- Un mismo usuario no puede crear dos movimientos idénticos en el mismo segundo
-- para la misma referencia y moneda

-- Primero eliminamos duplicados existentes si los hay
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        punto_atencion_id, 
        moneda_id, 
        tipo_movimiento, 
        tipo_referencia, 
        referencia_id,
        DATE_TRUNC('second', fecha)
      ORDER BY fecha ASC, id ASC
    ) as rn
  FROM "MovimientoSaldo"
)
DELETE FROM "MovimientoSaldo" 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Crear índice único compuesto
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimiento_saldo_unico 
ON "MovimientoSaldo" (
  punto_atencion_id, 
  moneda_id, 
  tipo_movimiento, 
  tipo_referencia, 
  referencia_id,
  DATE_TRUNC('second', fecha)
)
WHERE referencia_id IS NOT NULL;

-- =============================================================================
-- 2. ÍNDICE ÚNICO PARA CAMBIOS DE DIVISA (PREVENIR DUPLICADOS EXTREMOS)
-- =============================================================================
-- Previene que se creen dos cambios de divisa idénticos en la misma petición
-- Esto es una protección adicional al idempotency-key

-- Primero eliminamos duplicados extremos (mismo usuario, mismo segundo, mismos montos)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        usuario_id,
        punto_atencion_id,
        moneda_origen_id,
        moneda_destino_id,
        monto_origen,
        monto_destino,
        DATE_TRUNC('second', fecha)
      ORDER BY fecha ASC, id ASC
    ) as rn
  FROM "CambioDivisa"
)
DELETE FROM "CambioDivisa" 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Crear índice para detectar duplicados potenciales
CREATE UNIQUE INDEX IF NOT EXISTS idx_cambio_divisa_unico 
ON "CambioDivisa" (
  usuario_id,
  punto_atencion_id,
  moneda_origen_id,
  moneda_destino_id,
  monto_origen,
  monto_destino,
  DATE_TRUNC('second', fecha)
);

-- =============================================================================
-- 3. ÍNDICE ÚNICO PARA RECIBOS (PREVENIR DUPLICADOS)
-- =============================================================================
-- Los números de recibo DEBEN ser únicos
ALTER TABLE "Recibo" 
DROP CONSTRAINT IF EXISTS "Recibo_numero_recibo_key";

ALTER TABLE "Recibo" 
ADD CONSTRAINT "Recibo_numero_recibo_key" 
UNIQUE (numero_recibo);

-- =============================================================================
-- 4. MEJORAR ÍNDICE DE IDEMPOTENCY KEY
-- =============================================================================
-- Asegurar que el índice existente esté optimizado
DROP INDEX IF EXISTS "IdempotencyKey_key_route_method_user_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_key_unique 
ON "IdempotencyKey" (key, route, method, user_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_key_expires 
ON "IdempotencyKey" (expires_at) 
WHERE expires_at < NOW();

-- =============================================================================
-- 5. ÍNDICES PARA TRANSFERENCIAS (PREVENIR DUPLICADOS)
-- =============================================================================
-- Prevenir transferencias duplicadas del mismo usuario en el mismo segundo
CREATE UNIQUE INDEX IF NOT EXISTS idx_transferencia_unica 
ON "Transferencia" (
  solicitado_por,
  origen_id,
  destino_id,
  moneda_id,
  monto,
  DATE_TRUNC('second', fecha)
)
WHERE estado = 'PENDIENTE';

-- =============================================================================
-- 6. COMENTARIOS DOCUMENTANDO LAS RESTRICCIONES
-- =============================================================================
COMMENT ON INDEX idx_movimiento_saldo_unico IS 
'Previene duplicados de movimientos por race condition. Protección a nivel de BD para el bug de duplicados de milisegundos.';

COMMENT ON INDEX idx_cambio_divisa_unico IS 
'Previene cambios de divisa duplicados por doble clic o race condition.';

COMMENT ON CONSTRAINT "Recibo_numero_recibo_key" ON "Recibo" IS 
'Los números de recibo deben ser únicos globalmente.';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
SELECT 'Índices creados correctamente' as status;

-- Mostrar índices creados
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
  'idx_movimiento_saldo_unico',
  'idx_cambio_divisa_unico', 
  'idx_idempotency_key_unique',
  'idx_transferencia_unica'
);
