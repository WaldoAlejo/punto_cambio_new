-- CreateTable
CREATE TABLE "ConfiguracionCompraMetal" (
    "punto_atencion_id" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionCompraMetal_pkey" PRIMARY KEY ("punto_atencion_id")
);

-- CreateTable
CREATE TABLE "CompraMetal" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "jornada_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "clave_operacion" TEXT NOT NULL,
    "solicitud_hash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PAGADA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendedor" JSONB NOT NULL,
    "punto_nombre" TEXT NOT NULL,
    "operador_nombre" TEXT NOT NULL,
    "moneda_codigo" TEXT NOT NULL,
    "medio_pago" TEXT NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "billetes" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "monedas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "banco" TEXT,
    "referencia" TEXT,
    "comprobante" TEXT,

    CONSTRAINT "CompraMetal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompraMetal" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT NOT NULL,
    "codigo_pieza" TEXT NOT NULL,
    "metal" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "piezas" INTEGER NOT NULL,
    "peso_bruto" DECIMAL(13,3) NOT NULL,
    "deducciones" DECIMAL(13,3) NOT NULL,
    "peso_neto" DECIMAL(13,3) NOT NULL,
    "pureza_declarada" TEXT NOT NULL,
    "pureza" DECIMAL(7,3) NOT NULL,
    "gramos_finos" DECIMAL(16,6) NOT NULL,
    "metodo" TEXT NOT NULL,
    "observaciones" TEXT NOT NULL,
    "precio_gramo" DECIMAL(16,6) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "foto" TEXT,

    CONSTRAINT "DetalleCompraMetal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCompraMetal" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accion" TEXT NOT NULL,
    "evidencia" JSONB NOT NULL,

    CONSTRAINT "EventoCompraMetal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompraMetal_numero_key" ON "CompraMetal"("numero");

-- CreateIndex
CREATE INDEX "CompraMetal_punto_atencion_id_fecha_idx" ON "CompraMetal"("punto_atencion_id", "fecha");

-- CreateIndex
CREATE INDEX "CompraMetal_fecha_idx" ON "CompraMetal"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CompraMetal_usuario_id_clave_operacion_key" ON "CompraMetal"("usuario_id", "clave_operacion");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleCompraMetal_codigo_pieza_key" ON "DetalleCompraMetal"("codigo_pieza");

-- CreateIndex
CREATE INDEX "DetalleCompraMetal_compra_id_idx" ON "DetalleCompraMetal"("compra_id");

-- CreateIndex
CREATE INDEX "EventoCompraMetal_compra_id_idx" ON "EventoCompraMetal"("compra_id");

-- AddForeignKey
ALTER TABLE "ConfiguracionCompraMetal" ADD CONSTRAINT "ConfiguracionCompraMetal_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracionCompraMetal" ADD CONSTRAINT "ConfiguracionCompraMetal_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompraMetal" ADD CONSTRAINT "DetalleCompraMetal_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "CompraMetal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCompraMetal" ADD CONSTRAINT "EventoCompraMetal_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "CompraMetal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCompraMetal" ADD CONSTRAINT "EventoCompraMetal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
