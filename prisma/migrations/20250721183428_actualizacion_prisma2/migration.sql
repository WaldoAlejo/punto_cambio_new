-- CreateTable
CREATE TABLE "SaldoInicial" (
    "id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "cantidad_inicial" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignado_por" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoInicial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoSaldo" (
    "id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "tipo_movimiento" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "saldo_anterior" DECIMAL(15,2) NOT NULL,
    "saldo_nuevo" DECIMAL(15,2) NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "referencia_id" TEXT,
    "tipo_referencia" TEXT,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoSaldo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaldoInicial_punto_atencion_id_idx" ON "SaldoInicial"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "SaldoInicial_moneda_id_idx" ON "SaldoInicial"("moneda_id");

-- CreateIndex
CREATE INDEX "SaldoInicial_activo_idx" ON "SaldoInicial"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoInicial_punto_atencion_id_moneda_id_activo_key" ON "SaldoInicial"("punto_atencion_id", "moneda_id", "activo");

-- CreateIndex
CREATE INDEX "MovimientoSaldo_punto_atencion_id_idx" ON "MovimientoSaldo"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "MovimientoSaldo_moneda_id_idx" ON "MovimientoSaldo"("moneda_id");

-- CreateIndex
CREATE INDEX "MovimientoSaldo_fecha_idx" ON "MovimientoSaldo"("fecha");

-- CreateIndex
CREATE INDEX "MovimientoSaldo_referencia_id_tipo_referencia_idx" ON "MovimientoSaldo"("referencia_id", "tipo_referencia");

-- AddForeignKey
ALTER TABLE "SaldoInicial" ADD CONSTRAINT "SaldoInicial_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoInicial" ADD CONSTRAINT "SaldoInicial_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoInicial" ADD CONSTRAINT "SaldoInicial_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoSaldo" ADD CONSTRAINT "MovimientoSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoSaldo" ADD CONSTRAINT "MovimientoSaldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoSaldo" ADD CONSTRAINT "MovimientoSaldo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
