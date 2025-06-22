
-- Agregar columnas faltantes a la tabla Jornada para los reportes
ALTER TABLE public."Jornada" 
ADD COLUMN IF NOT EXISTS ubicacion_inicio jsonb,
ADD COLUMN IF NOT EXISTS ubicacion_salida jsonb,
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'COMPLETADO', 'CANCELADO'));

-- Agregar tabla para salidas espontáneas si no existe
CREATE TABLE IF NOT EXISTS public."SalidaEspontanea" (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL,
  punto_atencion_id uuid NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('BANCO', 'DILIGENCIA_PERSONAL', 'TRAMITE_GOBIERNO', 'EMERGENCIA_MEDICA', 'OTRO')),
  descripcion text,
  fecha_salida timestamp with time zone NOT NULL DEFAULT now(),
  fecha_regreso timestamp with time zone,
  ubicacion_salida jsonb,
  ubicacion_regreso jsonb,
  duracion_minutos integer,
  aprobado_por uuid,
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'COMPLETADO', 'CANCELADO')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Agregar índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_jornada_usuario_fecha ON public."Jornada" (usuario_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_jornada_punto_fecha ON public."Jornada" (punto_atencion_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_salida_espontanea_usuario ON public."SalidaEspontanea" (usuario_id);
CREATE INDEX IF NOT EXISTS idx_salida_espontanea_punto ON public."SalidaEspontanea" (punto_atencion_id);
