-- ============================================================
-- SCRIPT: Eliminar Indices Duplicados
-- Ejecutar en pgAdmin o psql
-- ============================================================

-- ============================================
-- 1. Eliminar indice duplicado en Moneda
-- ============================================
DROP INDEX IF EXISTS "Moneda_codigo_idx";

-- ============================================
-- 2. Eliminar indice duplicado en MovimientoSaldo  
-- ============================================
DROP INDEX IF EXISTS "MovimientoSaldo_moneda_id_idx";

-- ============================================
-- 3. Eliminar indice duplicado en CierreDiario
-- ============================================
DROP INDEX IF EXISTS "CierreDiario_fecha_punto_atencion_id_idx";

-- ============================================
-- Verificar resultado (opcional - descomentar)
-- ============================================
-- SELECT tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('Moneda', 'MovimientoSaldo', 'CierreDiario')
-- ORDER BY tablename, indexname;
