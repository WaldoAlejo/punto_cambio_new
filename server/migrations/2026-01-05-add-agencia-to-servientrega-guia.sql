-- Agregar campos de agencia Servientrega a la tabla ServientregaGuia
-- Esto permite filtrar las guías por agencia del punto de atención

ALTER TABLE "ServientregaGuia" 
ADD COLUMN IF NOT EXISTS "agencia_codigo" TEXT,
ADD COLUMN IF NOT EXISTS "agencia_nombre" TEXT;

-- Crear índice para optimizar búsquedas por agencia
CREATE INDEX IF NOT EXISTS "idx_servientrega_guia_agencia_codigo" ON "ServientregaGuia"("agencia_codigo");

-- Poblar los datos existentes copiando la agencia del punto de atención
UPDATE "ServientregaGuia" AS g
SET 
  "agencia_codigo" = p."servientrega_agencia_codigo",
  "agencia_nombre" = p."servientrega_agencia_nombre"
FROM "PuntoAtencion" AS p
WHERE g."punto_atencion_id" = p."id"
  AND g."agencia_codigo" IS NULL;

-- Comentario explicativo
COMMENT ON COLUMN "ServientregaGuia"."agencia_codigo" IS 'Código de la agencia Servientrega asignada al punto de atención cuando se creó la guía';
COMMENT ON COLUMN "ServientregaGuia"."agencia_nombre" IS 'Nombre de la agencia Servientrega asignada al punto de atención cuando se creó la guía';
