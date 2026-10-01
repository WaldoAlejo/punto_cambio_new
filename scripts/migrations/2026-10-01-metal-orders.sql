-- Additive: work orders for gold/silver evaluation (Orden de trabajo «Evaluación de oro»).
-- Generated with prisma migrate diff from the schema deployed on 2026-09-30. Existing purchases keep orden_id NULL.
-- AlterTable
ALTER TABLE "CompraMetal" ADD COLUMN     "orden_id" TEXT;

-- CreateTable
CREATE TABLE "OrdenEvaluacionMetal" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "clave_operacion" TEXT NOT NULL,
    "solicitud_hash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_AUTORIZACION',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punto_nombre" TEXT NOT NULL,
    "asesor_nombre" TEXT NOT NULL,
    "cliente" JSONB NOT NULL,
    "observaciones_cliente" TEXT NOT NULL DEFAULT '',
    "procesos" JSONB,
    "autorizacion_foto" TEXT,
    "autorizada_en" TIMESTAMP(3),
    "moneda_id" TEXT,
    "oferta_total" DECIMAL(15,2),
    "seguridad" JSONB,
    "resultado_observaciones" TEXT NOT NULL DEFAULT '',
    "evaluada_en" TIMESTAMP(3),
    "cierre" JSONB,
    "cerrada_en" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenEvaluacionMetal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoyaOrdenEvaluacion" (
    "id" TEXT NOT NULL,
    "orden_id" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "piezas" INTEGER NOT NULL DEFAULT 1,
    "peso_recibido" DECIMAL(13,3) NOT NULL,
    "color" TEXT NOT NULL,
    "estado_conservacion" TEXT NOT NULL,
    "piedras" TEXT NOT NULL DEFAULT '',
    "foto_antes" TEXT NOT NULL,
    "foto_despues" TEXT,
    "metal" TEXT,
    "metodo" TEXT,
    "evaluacion" JSONB,
    "pureza_declarada" TEXT NOT NULL DEFAULT '',
    "pureza" DECIMAL(7,3),
    "deducciones" DECIMAL(13,3),
    "peso_final" DECIMAL(13,3),
    "precio_gramo" DECIMAL(16,6),
    "subtotal" DECIMAL(15,2),
    "observaciones" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "JoyaOrdenEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenEvaluacionMetal_numero_key" ON "OrdenEvaluacionMetal"("numero");

-- CreateIndex
CREATE INDEX "OrdenEvaluacionMetal_punto_atencion_id_fecha_idx" ON "OrdenEvaluacionMetal"("punto_atencion_id", "fecha");

-- CreateIndex
CREATE INDEX "OrdenEvaluacionMetal_estado_idx" ON "OrdenEvaluacionMetal"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenEvaluacionMetal_anio_secuencia_key" ON "OrdenEvaluacionMetal"("anio", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenEvaluacionMetal_usuario_id_clave_operacion_key" ON "OrdenEvaluacionMetal"("usuario_id", "clave_operacion");

-- CreateIndex
CREATE UNIQUE INDEX "JoyaOrdenEvaluacion_orden_id_posicion_key" ON "JoyaOrdenEvaluacion"("orden_id", "posicion");

-- CreateIndex
CREATE UNIQUE INDEX "CompraMetal_orden_id_key" ON "CompraMetal"("orden_id");

-- AddForeignKey
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "OrdenEvaluacionMetal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenEvaluacionMetal" ADD CONSTRAINT "OrdenEvaluacionMetal_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenEvaluacionMetal" ADD CONSTRAINT "OrdenEvaluacionMetal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenEvaluacionMetal" ADD CONSTRAINT "OrdenEvaluacionMetal_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoyaOrdenEvaluacion" ADD CONSTRAINT "JoyaOrdenEvaluacion_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "OrdenEvaluacionMetal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

