-- Agregar campo estado a la tabla servientrega_guia
ALTER TABLE "ServientregaGuia" 
ADD COLUMN "estado" VARCHAR(50) NOT NULL DEFAULT 'ACTIVA';

-- Crear índice para mejorar búsquedas por estado
CREATE INDEX "idx_servientrega_guia_estado" ON "ServientregaGuia"("estado");

-- Actualizar guías existentes que tengan proceso = 'Anulada' al estado correspondiente
UPDATE "ServientregaGuia" 
SET "estado" = 'ANULADA' 
WHERE "proceso" LIKE '%Anulada%' OR "proceso" LIKE '%Cancelada%' OR "proceso" LIKE '%Cancelada%';

-- Asegurarse de que todas las demás guías estén como ACTIVAS
UPDATE "ServientregaGuia" 
SET "estado" = 'ACTIVA' 
WHERE "estado" IS NULL OR "estado" = '';