-- =====================================================
-- MIGRACIÓN: Agregar campos de agencias Servientrega
-- =====================================================
-- Ejecutar este archivo en PostgreSQL antes del seed

-- Agregar columnas para agencias Servientrega
ALTER TABLE "PuntoAtencion" 
ADD COLUMN IF NOT EXISTS "servientrega_agencia_codigo" TEXT,
ADD COLUMN IF NOT EXISTS "servientrega_agencia_nombre" TEXT;

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre')
ORDER BY column_name;

-- Mostrar estructura completa de la tabla (opcional)
-- \d "PuntoAtencion"

-- Mensaje de confirmación
SELECT 'Migración completada exitosamente - Campos de agencia Servientrega agregados' as status;