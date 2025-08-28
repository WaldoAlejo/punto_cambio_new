-- Crear tabla CierreDiario para manejar los cierres diarios de cada punto de atención
CREATE TABLE IF NOT EXISTS "CierreDiario" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  punto_atencion_id UUID NOT NULL REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  observaciones TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  cerrado_por UUID REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  diferencias_reportadas JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para evitar múltiples cierres para la misma fecha y punto
  UNIQUE(fecha, punto_atencion_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_cierre_diario_fecha ON "CierreDiario"(fecha);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_punto ON "CierreDiario"(punto_atencion_id);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_estado ON "CierreDiario"(estado);
CREATE INDEX IF NOT EXISTS idx_cierre_diario_fecha_punto ON "CierreDiario"(fecha, punto_atencion_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_cierre_diario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cierre_diario_updated_at
  BEFORE UPDATE ON "CierreDiario"
  FOR EACH ROW
  EXECUTE FUNCTION update_cierre_diario_updated_at();

-- Comentarios para documentar la tabla
COMMENT ON TABLE "CierreDiario" IS 'Tabla para registrar los cierres diarios de cada punto de atención';
COMMENT ON COLUMN "CierreDiario".fecha IS 'Fecha del cierre diario';
COMMENT ON COLUMN "CierreDiario".punto_atencion_id IS 'ID del punto de atención';
COMMENT ON COLUMN "CierreDiario".usuario_id IS 'Usuario que inició el proceso de cierre';
COMMENT ON COLUMN "CierreDiario".observaciones IS 'Observaciones del cierre';
COMMENT ON COLUMN "CierreDiario".estado IS 'Estado del cierre: ABIERTO o CERRADO';
COMMENT ON COLUMN "CierreDiario".fecha_cierre IS 'Fecha y hora cuando se completó el cierre';
COMMENT ON COLUMN "CierreDiario".cerrado_por IS 'Usuario que completó el cierre';
COMMENT ON COLUMN "CierreDiario".diferencias_reportadas IS 'JSON con las diferencias reportadas por moneda';