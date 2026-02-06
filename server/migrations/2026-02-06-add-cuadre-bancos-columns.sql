-- Adds bank-count columns to DetalleCuadreCaja.
-- Safe to run multiple times.

ALTER TABLE "DetalleCuadreCaja"
  ADD COLUMN IF NOT EXISTS bancos_teorico NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "DetalleCuadreCaja"
  ADD COLUMN IF NOT EXISTS conteo_bancos NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "DetalleCuadreCaja"
  ADD COLUMN IF NOT EXISTS diferencia_bancos NUMERIC(15,2) NOT NULL DEFAULT 0;
