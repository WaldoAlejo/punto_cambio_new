// Migración para crear tablas de servicios externos
// Este script se puede ejecutar desde el backend

const { PrismaClient } = require("@prisma/client");

async function createServiciosExternosTables() {
  const prisma = new PrismaClient();

  try {
    console.log("🚀 Iniciando migración de tablas de servicios externos...");

    // Ejecutar el script SQL directamente
    const sqlScript = `
      -- Script SQL para crear las tablas de servicios externos
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

          RAISE NOTICE 'Script de creación de tablas de servicios externos completado exitosamente';
      END
      $$;
    `;

    // Ejecutar el script usando $executeRaw
    await prisma.$executeRawUnsafe(sqlScript);

    console.log("✅ Migración completada exitosamente");
    console.log("📋 Tablas creadas:");
    console.log("   - ServicioExternoSaldo");
    console.log("   - ServicioExternoAsignacion");
    console.log("📋 Enums creados:");
    console.log("   - ServicioExterno");
    console.log("   - TipoAsignacionServicio");
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createServiciosExternosTables()
    .then(() => {
      console.log("🎉 Migración completada exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Error en la migración:", error);
      process.exit(1);
    });
}

module.exports = { createServiciosExternosTables };
