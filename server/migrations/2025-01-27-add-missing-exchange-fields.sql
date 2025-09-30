-- Add missing USD origin payment fields to CambioDivisa
ALTER TABLE "CambioDivisa"
  ADD COLUMN IF NOT EXISTS metodo_pago_origen TEXT NOT NULL DEFAULT 'EFECTIVO',
  ADD COLUMN IF NOT EXISTS usd_recibido_efectivo DECIMAL(15,2) NULL,
  ADD COLUMN IF NOT EXISTS usd_recibido_transfer DECIMAL(15,2) NULL;

-- Update existing records to have the default value
UPDATE "CambioDivisa"
SET metodo_pago_origen = COALESCE(metodo_pago_origen, 'EFECTIVO')
WHERE metodo_pago_origen IS NULL OR metodo_pago_origen = '';