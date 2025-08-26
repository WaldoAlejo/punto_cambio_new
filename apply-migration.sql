-- Aplicar migración para agregar campos de agencia Servientrega
-- Ejecutar este script en la base de datos antes de correr el seed

ALTER TABLE "PuntoAtencion" 
ADD COLUMN IF NOT EXISTS "servientrega_agencia_codigo" TEXT,
ADD COLUMN IF NOT EXISTS "servientrega_agencia_nombre" TEXT;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'PuntoAtencion' 
AND column_name IN ('servientrega_agencia_codigo', 'servientrega_agencia_nombre');