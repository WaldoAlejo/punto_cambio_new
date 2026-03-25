-- ============================================================
-- MIGRACION: Hacer Recibo.numero_recibo OBLIGATORIO
-- Paso 1: Verificar y corregir datos existentes
-- Paso 2: Aplicar constraint NOT NULL
-- ============================================================

-- ============================================
-- PASO 1: Verificar registros con NULL
-- ============================================
SELECT 
    id,
    numero_recibo,
    created_at
FROM "Recibo" 
WHERE numero_recibo IS NULL;

-- ============================================
-- PASO 2: Generar numeros de recibo para registros NULL
-- Solo ejecutar si hay registros NULL
-- ============================================
/*
-- Descomentar y ejecutar si hay registros NULL:
UPDATE "Recibo"
SET numero_recibo = 'REC-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::text, 1, 8)
WHERE numero_recibo IS NULL;
*/

-- ============================================
-- PASO 3: Verificar que no queden NULL
-- Debe retornar 0
-- ============================================
SELECT COUNT(*) as registros_null_restantes
FROM "Recibo" 
WHERE numero_recibo IS NULL;

-- ============================================
-- PASO 4: Aplicar constraint NOT NULL
-- Solo ejecutar despues de confirmar 0 NULLs
-- ============================================
/*
-- Descomentar cuando no haya registros NULL:
ALTER TABLE "Recibo" 
ALTER COLUMN numero_recibo SET NOT NULL;
*/

-- ============================================
-- NOTAS PARA PRISMA:
-- ============================================
-- Despues de aplicar, actualizar schema.prisma:
-- 
-- Antes:
-- numero_recibo String? @unique
--
-- Despues:
-- numero_recibo String @unique
