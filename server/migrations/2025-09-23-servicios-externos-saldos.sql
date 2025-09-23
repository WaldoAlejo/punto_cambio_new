-- Migration: External Services Balances, Assignments, and Daily Closures
-- Safe/Idempotent creation where possible

-- Ensure enum for assignment type exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAsignacionServicio') THEN
    CREATE TYPE "TipoAsignacionServicio" AS ENUM ('INICIAL', 'RECARGA');
  END IF;
END
$$;

-- ServicioExternoSaldo: saldo por servicio/punto en USD (por ahora monedario generalizado)
CREATE TABLE IF NOT EXISTS "ServicioExternoSaldo" (
  id UUID PRIMARY KEY,
  punto_atencion_id UUID NOT NULL REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
  servicio "ServicioExterno" NOT NULL,
  moneda_id UUID NOT NULL REFERENCES "Moneda"(id) ON DELETE CASCADE,
  cantidad DECIMAL(15,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS servicio_externo_saldo_unique
  ON "ServicioExternoSaldo"(punto_atencion_id, servicio, moneda_id);
CREATE INDEX IF NOT EXISTS servicio_externo_saldo_idx_punto
  ON "ServicioExternoSaldo"(punto_atencion_id);
CREATE INDEX IF NOT EXISTS servicio_externo_saldo_idx_servicio
  ON "ServicioExternoSaldo"(servicio);

-- ServicioExternoAsignacion: histórico de asignaciones (INICIAL/RECARGA)
CREATE TABLE IF NOT EXISTS "ServicioExternoAsignacion" (
  id UUID PRIMARY KEY,
  punto_atencion_id UUID NOT NULL REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
  servicio "ServicioExterno" NOT NULL,
  moneda_id UUID NOT NULL REFERENCES "Moneda"(id) ON DELETE CASCADE,
  monto DECIMAL(15,2) NOT NULL,
  tipo "TipoAsignacionServicio" NOT NULL,
  observaciones TEXT NULL,
  asignado_por UUID NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Un único INICIAL por punto/servicio/moneda
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = ANY(current_schemas(true))
      AND indexname = 'servicio_externo_asignacion_inicial_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX servicio_externo_asignacion_inicial_unique
      ON "ServicioExternoAsignacion"(punto_atencion_id, servicio, moneda_id)
      WHERE tipo = ''INICIAL''';
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS servicio_externo_asignacion_idx_punto
  ON "ServicioExternoAsignacion"(punto_atencion_id);
CREATE INDEX IF NOT EXISTS servicio_externo_asignacion_idx_servicio
  ON "ServicioExternoAsignacion"(servicio);
CREATE INDEX IF NOT EXISTS servicio_externo_asignacion_idx_tipo
  ON "ServicioExternoAsignacion"(tipo);

-- ServicioExternoCierreDiario: cierre por punto/fecha/usuario
CREATE TABLE IF NOT EXISTS "ServicioExternoCierreDiario" (
  id UUID PRIMARY KEY,
  punto_atencion_id UUID NOT NULL REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id UUID NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'CERRADO',
  observaciones TEXT NULL,
  fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_por UUID NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  diferencias_reportadas JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS servicio_externo_cierre_unique
  ON "ServicioExternoCierreDiario"(fecha, punto_atencion_id);
CREATE INDEX IF NOT EXISTS servicio_externo_cierre_idx_fecha
  ON "ServicioExternoCierreDiario"(fecha);
CREATE INDEX IF NOT EXISTS servicio_externo_cierre_idx_punto
  ON "ServicioExternoCierreDiario"(punto_atencion_id);
CREATE INDEX IF NOT EXISTS servicio_externo_cierre_idx_estado
  ON "ServicioExternoCierreDiario"(estado);

-- ServicioExternoDetalleCierre: detalle por servicio
CREATE TABLE IF NOT EXISTS "ServicioExternoDetalleCierre" (
  id UUID PRIMARY KEY,
  cierre_id UUID NOT NULL REFERENCES "ServicioExternoCierreDiario"(id) ON DELETE CASCADE,
  servicio "ServicioExterno" NOT NULL,
  moneda_id UUID NOT NULL REFERENCES "Moneda"(id) ON DELETE CASCADE,
  monto_movimientos DECIMAL(15,2) NOT NULL DEFAULT 0,
  monto_validado DECIMAL(15,2) NOT NULL DEFAULT 0,
  diferencia DECIMAL(15,2) NOT NULL DEFAULT 0,
  observaciones TEXT NULL
);
CREATE INDEX IF NOT EXISTS servicio_externo_detalle_idx_cierre
  ON "ServicioExternoDetalleCierre"(cierre_id);
CREATE INDEX IF NOT EXISTS servicio_externo_detalle_idx_servicio
  ON "ServicioExternoDetalleCierre"(servicio);