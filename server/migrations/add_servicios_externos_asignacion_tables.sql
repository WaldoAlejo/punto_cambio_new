-- Migración: Agregar tablas para asignación de saldos de servicios externos
-- Fecha: 2024-12-19
-- Descripción: Crea las tablas necesarias para gestionar asignación de saldos de servicios externos por punto de atención

-- Tabla para almacenar saldos de servicios externos por punto de atención
CREATE TABLE IF NOT EXISTS "ServicioExternoSaldoPunto" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    punto_atencion_id UUID NOT NULL,
    punto_atencion_nombre VARCHAR(255) NOT NULL,
    servicio VARCHAR(50) NOT NULL,
    saldo_actual DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para optimizar consultas
    CONSTRAINT fk_servicio_externo_saldo_punto_atencion 
        FOREIGN KEY (punto_atencion_id) REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE,
    
    -- Evitar duplicados por punto y servicio
    CONSTRAINT uk_servicio_externo_saldo_punto_servicio 
        UNIQUE (punto_atencion_id, servicio)
);

-- Tabla para historial de asignaciones de saldos
CREATE TABLE IF NOT EXISTS "ServicioExternoAsignacion" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    punto_atencion_id UUID NOT NULL,
    punto_atencion_nombre VARCHAR(255) NOT NULL,
    servicio VARCHAR(50) NOT NULL,
    monto_asignado DECIMAL(15,2) NOT NULL,
    creado_por VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Referencia al punto de atención
    CONSTRAINT fk_servicio_externo_asignacion_punto_atencion 
        FOREIGN KEY (punto_atencion_id) REFERENCES "PuntoAtencion"(id) ON DELETE CASCADE
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_servicio_externo_saldo_punto_atencion 
    ON "ServicioExternoSaldoPunto"(punto_atencion_id);

CREATE INDEX IF NOT EXISTS idx_servicio_externo_saldo_servicio 
    ON "ServicioExternoSaldoPunto"(servicio);

CREATE INDEX IF NOT EXISTS idx_servicio_externo_asignacion_punto_atencion 
    ON "ServicioExternoAsignacion"(punto_atencion_id);

CREATE INDEX IF NOT EXISTS idx_servicio_externo_asignacion_servicio 
    ON "ServicioExternoAsignacion"(servicio);

CREATE INDEX IF NOT EXISTS idx_servicio_externo_asignacion_fecha 
    ON "ServicioExternoAsignacion"(creado_en DESC);

-- Comentarios para documentación
COMMENT ON TABLE "ServicioExternoSaldoPunto" IS 'Almacena los saldos asignados de cada servicio externo por punto de atención';
COMMENT ON TABLE "ServicioExternoAsignacion" IS 'Historial de asignaciones de saldos de servicios externos a puntos de atención';

COMMENT ON COLUMN "ServicioExternoSaldoPunto".saldo_actual IS 'Saldo actual disponible del servicio en el punto de atención';
COMMENT ON COLUMN "ServicioExternoAsignacion".monto_asignado IS 'Monto asignado en esta operación (se suma al saldo actual)';