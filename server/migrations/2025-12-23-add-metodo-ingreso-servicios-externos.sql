-- Migration: Add metodo_ingreso column to ServicioExternoMovimiento
-- Allows operators to specify if money comes in as EFECTIVO (cash) or BANCO (bank deposit)

ALTER TABLE "ServicioExternoMovimiento"
ADD COLUMN metodo_ingreso "TipoViaTransferencia" NOT NULL DEFAULT 'EFECTIVO';

CREATE INDEX IF NOT EXISTS servicio_externo_movimiento_idx_metodo_ingreso
ON "ServicioExternoMovimiento"(metodo_ingreso);
