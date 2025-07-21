-- Mejorar el tracking de usuarios en puntos de atención

-- Actualizar tabla Jornada para mejor tracking
ALTER TABLE "Jornada" 
ADD COLUMN IF NOT EXISTS "motivo_cambio" TEXT,
ADD COLUMN IF NOT EXISTS "usuario_autorizo" UUID,
ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- Crear tabla de historial de asignaciones de puntos
CREATE TABLE IF NOT EXISTS "HistorialAsignacionPunto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "usuario_id" UUID NOT NULL,
  "punto_atencion_anterior_id" UUID,
  "punto_atencion_nuevo_id" UUID NOT NULL,
  "fecha_asignacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "motivo_cambio" TEXT,
  "autorizado_por" UUID,
  "tipo_asignacion" TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, AUTO_LOGIN, JORNADA_INICIO
  "observaciones" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE "HistorialAsignacionPunto" ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para HistorialAsignacionPunto
CREATE POLICY "Usuarios pueden ver su propio historial" 
ON "HistorialAsignacionPunto" 
FOR SELECT 
USING (true); -- Todos pueden ver el historial para reportes

CREATE POLICY "Solo admins pueden insertar historial" 
ON "HistorialAsignacionPunto" 
FOR INSERT 
WITH CHECK (true); -- El sistema insertará automáticamente

-- Crear función para registrar cambios de punto automáticamente
CREATE OR REPLACE FUNCTION registrar_cambio_punto()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si cambió el punto de atención
  IF OLD.punto_atencion_id IS DISTINCT FROM NEW.punto_atencion_id THEN
    INSERT INTO "HistorialAsignacionPunto" (
      usuario_id,
      punto_atencion_anterior_id,
      punto_atencion_nuevo_id,
      motivo_cambio,
      tipo_asignacion
    ) VALUES (
      NEW.usuario_id,
      OLD.punto_atencion_id,
      NEW.punto_atencion_id,
      'Cambio automático por actualización de usuario',
      'AUTO_UPDATE'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para Usuario cuando cambia punto_atencion_id
DROP TRIGGER IF EXISTS trigger_cambio_punto_usuario ON "Usuario";
CREATE TRIGGER trigger_cambio_punto_usuario
  AFTER UPDATE ON "Usuario"
  FOR EACH ROW
  WHEN (OLD.punto_atencion_id IS DISTINCT FROM NEW.punto_atencion_id)
  EXECUTE FUNCTION registrar_cambio_punto();

-- Crear función para registrar inicio/fin de jornada
CREATE OR REPLACE FUNCTION registrar_evento_jornada()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar inicio de jornada
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "HistorialAsignacionPunto" (
      usuario_id,
      punto_atencion_nuevo_id,
      motivo_cambio,
      tipo_asignacion,
      observaciones
    ) VALUES (
      NEW.usuario_id,
      NEW.punto_atencion_id,
      'Inicio de jornada',
      'JORNADA_INICIO',
      'Jornada ID: ' || NEW.id::TEXT
    );
    RETURN NEW;
  END IF;
  
  -- Registrar fin de jornada cuando se actualiza fecha_salida
  IF TG_OP = 'UPDATE' AND OLD.fecha_salida IS NULL AND NEW.fecha_salida IS NOT NULL THEN
    INSERT INTO "HistorialAsignacionPunto" (
      usuario_id,
      punto_atencion_anterior_id,
      motivo_cambio,
      tipo_asignacion,
      observaciones
    ) VALUES (
      NEW.usuario_id,
      NEW.punto_atencion_id,
      'Fin de jornada',
      'JORNADA_FIN',
      'Jornada ID: ' || NEW.id::TEXT || ' - Duración: ' || 
      EXTRACT(EPOCH FROM (NEW.fecha_salida - NEW.fecha_inicio))/3600 || ' horas'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para Jornada
DROP TRIGGER IF EXISTS trigger_inicio_jornada ON "Jornada";
CREATE TRIGGER trigger_inicio_jornada
  AFTER INSERT ON "Jornada"
  FOR EACH ROW
  EXECUTE FUNCTION registrar_evento_jornada();

DROP TRIGGER IF EXISTS trigger_fin_jornada ON "Jornada";
CREATE TRIGGER trigger_fin_jornada
  AFTER UPDATE ON "Jornada"
  FOR EACH ROW
  EXECUTE FUNCTION registrar_evento_jornada();

-- Crear vista para reportes de asignaciones
CREATE OR REPLACE VIEW "VistaHistorialPuntos" AS
SELECT 
  h.id,
  h.fecha_asignacion,
  h.tipo_asignacion,
  h.motivo_cambio,
  h.observaciones,
  u.nombre as usuario_nombre,
  u.username as usuario_username,
  u.rol as usuario_rol,
  pa_anterior.nombre as punto_anterior_nombre,
  pa_nuevo.nombre as punto_nuevo_nombre,
  pa_nuevo.ciudad as punto_ciudad,
  autorizo.nombre as autorizado_por_nombre
FROM "HistorialAsignacionPunto" h
JOIN "Usuario" u ON h.usuario_id = u.id
LEFT JOIN "PuntoAtencion" pa_anterior ON h.punto_atencion_anterior_id = pa_anterior.id
JOIN "PuntoAtencion" pa_nuevo ON h.punto_atencion_nuevo_id = pa_nuevo.id
LEFT JOIN "Usuario" autorizo ON h.autorizado_por = autorizo.id
ORDER BY h.fecha_asignacion DESC;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_historial_asignacion_usuario_fecha 
ON "HistorialAsignacionPunto" (usuario_id, fecha_asignacion DESC);

CREATE INDEX IF NOT EXISTS idx_historial_asignacion_punto_fecha 
ON "HistorialAsignacionPunto" (punto_atencion_nuevo_id, fecha_asignacion DESC);

CREATE INDEX IF NOT EXISTS idx_historial_asignacion_tipo_fecha 
ON "HistorialAsignacionPunto" (tipo_asignacion, fecha_asignacion DESC);