-- Add bancos column to Saldo
ALTER TABLE "Saldo"
  ADD COLUMN IF NOT EXISTS bancos DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Add USD delivery detail fields to CambioDivisa
ALTER TABLE "CambioDivisa"
  ADD COLUMN IF NOT EXISTS usd_entregado_efectivo DECIMAL(15,2) NULL,
  ADD COLUMN IF NOT EXISTS usd_entregado_transfer DECIMAL(15,2) NULL,
  ADD COLUMN IF NOT EXISTS metodo_entrega TEXT NOT NULL DEFAULT 'efectivo';

-- Backfill defaults safely (noop for existing rows given defaults)
UPDATE "CambioDivisa"
SET metodo_entrega = COALESCE(metodo_entrega, 'efectivo')
WHERE metodo_entrega IS NULL;