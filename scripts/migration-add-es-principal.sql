-- Migración: Agregar campo es_principal a PuntoAtencion
-- Fecha: 2025-01-07

-- 1. Agregar la columna es_principal
ALTER TABLE "PuntoAtencion" 
ADD COLUMN IF NOT EXISTS "es_principal" BOOLEAN DEFAULT false;

-- 2. Actualizar el punto principal existente (si existe)
UPDATE "PuntoAtencion" 
SET "es_principal" = true 
WHERE "nombre" LIKE '%Principal%' OR "nombre" LIKE '%principal%'
LIMIT 1;

-- 3. Verificar la estructura
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
ORDER BY ordinal_position;