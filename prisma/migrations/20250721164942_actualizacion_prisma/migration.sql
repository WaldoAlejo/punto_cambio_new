-- AlterTable
ALTER TABLE "Jornada" ADD COLUMN     "motivo_cambio" TEXT,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "usuario_autorizo" TEXT;

-- CreateTable
CREATE TABLE "HistorialAsignacionPunto" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_anterior_id" TEXT,
    "punto_atencion_nuevo_id" TEXT NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_cambio" TEXT,
    "autorizado_por" TEXT,
    "tipo_asignacion" TEXT NOT NULL DEFAULT 'MANUAL',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialAsignacionPunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialAsignacionPunto_usuario_id_fecha_asignacion_idx" ON "HistorialAsignacionPunto"("usuario_id", "fecha_asignacion");

-- CreateIndex
CREATE INDEX "HistorialAsignacionPunto_punto_atencion_nuevo_id_fecha_asig_idx" ON "HistorialAsignacionPunto"("punto_atencion_nuevo_id", "fecha_asignacion");

-- CreateIndex
CREATE INDEX "HistorialAsignacionPunto_tipo_asignacion_fecha_asignacion_idx" ON "HistorialAsignacionPunto"("tipo_asignacion", "fecha_asignacion");

-- AddForeignKey
ALTER TABLE "HistorialAsignacionPunto" ADD CONSTRAINT "HistorialAsignacionPunto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAsignacionPunto" ADD CONSTRAINT "HistorialAsignacionPunto_punto_atencion_anterior_id_fkey" FOREIGN KEY ("punto_atencion_anterior_id") REFERENCES "PuntoAtencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAsignacionPunto" ADD CONSTRAINT "HistorialAsignacionPunto_punto_atencion_nuevo_id_fkey" FOREIGN KEY ("punto_atencion_nuevo_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAsignacionPunto" ADD CONSTRAINT "HistorialAsignacionPunto_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
