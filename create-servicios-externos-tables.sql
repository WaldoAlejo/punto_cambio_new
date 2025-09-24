-- Script SQL para crear las tablas de servicios externos
-- Basado en el schema de Prisma existente

-- Verificar si las tablas ya existen antes de crearlas
DO $$
BEGIN
    -- Crear tabla ServicioExternoSaldo si no existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoSaldo') THEN
        CREATE TABLE "ServicioExternoSaldo" (
            "id" TEXT NOT NULL,
            "punto_atencion_id" TEXT NOT NULL,
            "servicio" TEXT NOT NULL,
            "moneda_id" TEXT NOT NULL,
            "cantidad" DECIMAL(15,2) NOT NULL DEFAULT 0,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "ServicioExternoSaldo_pkey" PRIMARY KEY ("id")
        );

        -- Crear índices para ServicioExternoSaldo
        CREATE UNIQUE INDEX "ServicioExternoSaldo_punto_atencion_id_servicio_moneda_id_key" ON "ServicioExternoSaldo"("punto_atencion_id", "servicio", "moneda_id");
        CREATE INDEX "ServicioExternoSaldo_punto_atencion_id_idx" ON "ServicioExternoSaldo"("punto_atencion_id");
        CREATE INDEX "ServicioExternoSaldo_servicio_idx" ON "ServicioExternoSaldo"("servicio");

        -- Agregar foreign keys para ServicioExternoSaldo
        ALTER TABLE "ServicioExternoSaldo" ADD CONSTRAINT "ServicioExternoSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "ServicioExternoSaldo" ADD CONSTRAINT "ServicioExternoSaldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        RAISE NOTICE 'Tabla ServicioExternoSaldo creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla ServicioExternoSaldo ya existe';
    END IF;

    -- Crear tabla ServicioExternoAsignacion si no existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoAsignacion') THEN
        CREATE TABLE "ServicioExternoAsignacion" (
            "id" TEXT NOT NULL,
            "punto_atencion_id" TEXT NOT NULL,
            "servicio" TEXT NOT NULL,
            "moneda_id" TEXT NOT NULL,
            "monto" DECIMAL(15,2) NOT NULL,
            "tipo" TEXT NOT NULL,
            "observaciones" TEXT,
            "asignado_por" TEXT NOT NULL,
            "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "ServicioExternoAsignacion_pkey" PRIMARY KEY ("id")
        );

        -- Crear índices para ServicioExternoAsignacion
        CREATE INDEX "ServicioExternoAsignacion_punto_atencion_id_idx" ON "ServicioExternoAsignacion"("punto_atencion_id");
        CREATE INDEX "ServicioExternoAsignacion_servicio_idx" ON "ServicioExternoAsignacion"("servicio");
        CREATE INDEX "ServicioExternoAsignacion_tipo_idx" ON "ServicioExternoAsignacion"("tipo");

        -- Agregar foreign keys para ServicioExternoAsignacion
        ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "ServicioExternoAsignacion" ADD CONSTRAINT "ServicioExternoAsignacion_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

        RAISE NOTICE 'Tabla ServicioExternoAsignacion creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla ServicioExternoAsignacion ya existe';
    END IF;

    -- Verificar que los enums necesarios existan
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServicioExterno') THEN
        CREATE TYPE "ServicioExterno" AS ENUM (
            'YAGANASTE',
            'BANCO_GUAYAQUIL',
            'WESTERN',
            'PRODUBANCO',
            'BANCO_PACIFICO',
            'INSUMOS_OFICINA',
            'INSUMOS_LIMPIEZA',
            'OTROS'
        );
        RAISE NOTICE 'Enum ServicioExterno creado exitosamente';
    ELSE
        RAISE NOTICE 'Enum ServicioExterno ya existe';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAsignacionServicio') THEN
        CREATE TYPE "TipoAsignacionServicio" AS ENUM (
            'INICIAL',
            'RECARGA'
        );
        RAISE NOTICE 'Enum TipoAsignacionServicio creado exitosamente';
    ELSE
        RAISE NOTICE 'Enum TipoAsignacionServicio ya existe';
    END IF;

    -- Actualizar las columnas para usar los enums si las tablas fueron creadas
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoSaldo') THEN
        -- Verificar si la columna servicio ya es del tipo enum
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ServicioExternoSaldo' 
            AND column_name = 'servicio' 
            AND udt_name = 'ServicioExterno'
        ) THEN
            ALTER TABLE "ServicioExternoSaldo" ALTER COLUMN "servicio" TYPE "ServicioExterno" USING "servicio"::"ServicioExterno";
            RAISE NOTICE 'Columna servicio en ServicioExternoSaldo actualizada a enum';
        END IF;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ServicioExternoAsignacion') THEN
        -- Verificar si las columnas ya son del tipo enum
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ServicioExternoAsignacion' 
            AND column_name = 'servicio' 
            AND udt_name = 'ServicioExterno'
        ) THEN
            ALTER TABLE "ServicioExternoAsignacion" ALTER COLUMN "servicio" TYPE "ServicioExterno" USING "servicio"::"ServicioExterno";
            RAISE NOTICE 'Columna servicio en ServicioExternoAsignacion actualizada a enum';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ServicioExternoAsignacion' 
            AND column_name = 'tipo' 
            AND udt_name = 'TipoAsignacionServicio'
        ) THEN
            ALTER TABLE "ServicioExternoAsignacion" ALTER COLUMN "tipo" TYPE "TipoAsignacionServicio" USING "tipo"::"TipoAsignacionServicio";
            RAISE NOTICE 'Columna tipo en ServicioExternoAsignacion actualizada a enum';
        END IF;
    END IF;

    RAISE NOTICE 'Script de creación de tablas de servicios externos completado exitosamente';
END
$$;

-- Comentarios de documentación
COMMENT ON TABLE "ServicioExternoSaldo" IS 'Almacena los saldos actuales de cada servicio externo por punto de atención y moneda';
COMMENT ON TABLE "ServicioExternoAsignacion" IS 'Historial de todas las asignaciones de saldo realizadas para servicios externos';

COMMENT ON COLUMN "ServicioExternoSaldo"."punto_atencion_id" IS 'ID del punto de atención';
COMMENT ON COLUMN "ServicioExternoSaldo"."servicio" IS 'Tipo de servicio externo (YAGANASTE, BANCO_GUAYAQUIL, etc.)';
COMMENT ON COLUMN "ServicioExternoSaldo"."moneda_id" IS 'ID de la moneda';
COMMENT ON COLUMN "ServicioExternoSaldo"."cantidad" IS 'Saldo actual disponible';

COMMENT ON COLUMN "ServicioExternoAsignacion"."punto_atencion_id" IS 'ID del punto de atención';
COMMENT ON COLUMN "ServicioExternoAsignacion"."servicio" IS 'Tipo de servicio externo';
COMMENT ON COLUMN "ServicioExternoAsignacion"."moneda_id" IS 'ID de la moneda';
COMMENT ON COLUMN "ServicioExternoAsignacion"."monto" IS 'Monto asignado';
COMMENT ON COLUMN "ServicioExternoAsignacion"."tipo" IS 'Tipo de asignación (INICIAL o RECARGA)';
COMMENT ON COLUMN "ServicioExternoAsignacion"."asignado_por" IS 'ID del usuario que realizó la asignación';
COMMENT ON COLUMN "ServicioExternoAsignacion"."fecha" IS 'Fecha y hora de la asignación';