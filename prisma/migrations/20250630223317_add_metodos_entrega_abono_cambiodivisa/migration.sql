-- AlterTable
ALTER TABLE "CambioDivisa" ADD COLUMN     "abono_inicial_fecha" TIMESTAMP(3),
ADD COLUMN     "abono_inicial_monto" DECIMAL(15,2),
ADD COLUMN     "abono_inicial_recibido_por" TEXT,
ADD COLUMN     "metodo_entrega" TEXT,
ADD COLUMN     "referencia_cambio_principal" TEXT,
ADD COLUMN     "saldo_pendiente" DECIMAL(15,2),
ADD COLUMN     "transferencia_banco" TEXT,
ADD COLUMN     "transferencia_imagen_url" TEXT,
ADD COLUMN     "transferencia_numero" TEXT;
