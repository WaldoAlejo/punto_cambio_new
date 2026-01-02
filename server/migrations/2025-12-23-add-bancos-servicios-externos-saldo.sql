-- Add bancos field to ServicioExternoSaldo for consistency with Saldo model
-- This allows tracking money received as bank deposits for external services

ALTER TABLE "ServicioExternoSaldo"
ADD COLUMN bancos DECIMAL(15, 2) DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS servicio_externo_saldo_idx_bancos
ON "ServicioExternoSaldo"(bancos);
