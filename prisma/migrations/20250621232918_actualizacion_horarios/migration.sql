-- CreateEnum
CREATE TYPE "EstadoJornada" AS ENUM ('ACTIVO', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MotivoSalida" AS ENUM ('BANCO', 'DILIGENCIA_PERSONAL', 'TRAMITE_GOBIERNO', 'EMERGENCIA_MEDICA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSalida" AS ENUM ('ACTIVO', 'COMPLETADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Jornada" ADD COLUMN     "estado" "EstadoJornada" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "ubicacion_inicio" JSONB,
ADD COLUMN     "ubicacion_salida" JSONB;

-- AlterTable
ALTER TABLE "Transferencia" ADD COLUMN     "fecha_rechazo" TIMESTAMP(3),
ADD COLUMN     "observaciones_aprobacion" TEXT,
ADD COLUMN     "rechazado_por" TEXT;

-- CreateTable
CREATE TABLE "SalidaEspontanea" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "motivo" "MotivoSalida" NOT NULL,
    "descripcion" TEXT,
    "fecha_salida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_regreso" TIMESTAMP(3),
    "ubicacion_salida" JSONB,
    "ubicacion_regreso" JSONB,
    "duracion_minutos" INTEGER,
    "aprobado_por" TEXT,
    "estado" "EstadoSalida" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalidaEspontanea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalidaEspontanea_usuario_id_idx" ON "SalidaEspontanea"("usuario_id");

-- CreateIndex
CREATE INDEX "SalidaEspontanea_punto_atencion_id_idx" ON "SalidaEspontanea"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "SalidaEspontanea_fecha_salida_idx" ON "SalidaEspontanea"("fecha_salida");

-- CreateIndex
CREATE INDEX "SalidaEspontanea_estado_idx" ON "SalidaEspontanea"("estado");

-- CreateIndex
CREATE INDEX "Jornada_punto_atencion_id_idx" ON "Jornada"("punto_atencion_id");

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_rechazado_por_fkey" FOREIGN KEY ("rechazado_por") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaEspontanea" ADD CONSTRAINT "SalidaEspontanea_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaEspontanea" ADD CONSTRAINT "SalidaEspontanea_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaEspontanea" ADD CONSTRAINT "SalidaEspontanea_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
