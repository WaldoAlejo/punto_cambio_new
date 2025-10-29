-- Add servientrega alianza fields to PuntoAtencion
ALTER TABLE "PuntoAtencion" 
ADD COLUMN IF NOT EXISTS "servientrega_alianza" TEXT,
ADD COLUMN IF NOT EXISTS "servientrega_oficina_alianza" TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_punto_servientrega_alianza" ON "PuntoAtencion"("servientrega_alianza");
CREATE INDEX IF NOT EXISTS "idx_punto_servientrega_oficina_alianza" ON "PuntoAtencion"("servientrega_oficina_alianza");