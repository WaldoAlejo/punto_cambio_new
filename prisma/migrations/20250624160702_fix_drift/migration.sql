-- AlterTable
ALTER TABLE "CuadreCaja" ADD COLUMN     "saldo_inicial_calculado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total_egresos" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_ingresos" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "usuario_cierre_parcial" TEXT;

-- AlterTable
ALTER TABLE "DetalleCuadreCaja" ADD COLUMN     "movimientos_periodo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "observaciones_detalle" TEXT;

-- CreateIndex
CREATE INDEX "CuadreCaja_estado_idx" ON "CuadreCaja"("estado");

-- CreateIndex
CREATE INDEX "DetalleCuadreCaja_moneda_id_idx" ON "DetalleCuadreCaja"("moneda_id");

-- AddForeignKey
ALTER TABLE "CuadreCaja" ADD CONSTRAINT "CuadreCaja_usuario_cierre_parcial_fkey" FOREIGN KEY ("usuario_cierre_parcial") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
