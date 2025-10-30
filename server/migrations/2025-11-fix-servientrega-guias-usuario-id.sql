-- 2025-11-fix-servientrega-guias-usuario-id.sql
-- Agregar usuario_id a ServientregaGuia para filtrado correcto al listar
-- Esto permite rastrear qué usuario creó cada guía y filtrar por usuario + punto de atención

ALTER TABLE "ServientregaGuia"
ADD COLUMN usuario_id VARCHAR(255);

-- Crear índice para búsquedas eficientes por usuario + punto
CREATE INDEX idx_servientrega_guias_usuario_punto ON "ServientregaGuia"(usuario_id, punto_atencion_id);
CREATE INDEX idx_servientrega_guias_usuario ON "ServientregaGuia"(usuario_id);

-- Comentario de la migración
COMMENT ON COLUMN "ServientregaGuia".usuario_id IS 'ID del usuario que generó la guía. Se usa para filtrar guías en el listado combinado con punto_atencion_id.';