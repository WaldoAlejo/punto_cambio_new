import {
  PrismaClient,
  TipoMovimiento,
  TipoTransferencia,
  Transferencia,
} from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

export interface TransferData {
  origen_id?: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: TipoTransferencia;
  solicitado_por: string;
  descripcion?: string | null;
  numero_recibo: string;
  estado: "PENDIENTE";
  fecha: Date;
}

export const transferCreationService = {
  generateReceiptNumber(): string {
    return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  },

  async createTransfer(transferData: TransferData) {
    logger.info("Creando transferencia con datos:", { ...transferData }); // ✅ Spread para evitar TS2345

    const newTransfer = await prisma.transferencia.create({
      data: transferData,
      include: {
        origen: {
          select: {
            id: true,
            nombre: true,
          },
        },
        destino: {
          select: {
            id: true,
            nombre: true,
          },
        },
        moneda: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            simbolo: true,
          },
        },
        usuarioSolicitante: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
      },
    });

    logger.info("Transferencia creada en BD:", { ...newTransfer });
    return newTransfer;
  },

  async createMovement(data: {
    punto_atencion_id: string;
    usuario_id: string;
    moneda_id: string;
    monto: number;
    tipo_transferencia: TipoTransferencia;
    numero_recibo: string;
  }) {
    try {
      await prisma.movimiento.create({
        data: {
          punto_atencion_id: data.punto_atencion_id,
          usuario_id: data.usuario_id,
          moneda_id: data.moneda_id,
          monto: data.monto,
          tipo: TipoMovimiento.TRANSFERENCIA_ENTRANTE,
          descripcion: `Transferencia ${data.tipo_transferencia} - ${data.numero_recibo}`,
          numero_recibo: data.numero_recibo,
        },
      });
      logger.info("Movimiento registrado exitosamente");
    } catch (movError) {
      logger.warn("Error registrando movimiento (no crítico)", {
        error: movError,
      });
    }
  },

  async createReceipt(data: {
    numero_recibo: string;
    usuario_id: string;
    punto_atencion_id: string;
    transferencia: Transferencia;
    detalle_divisas?: object;
    responsable_movilizacion?: object;
    tipo_transferencia: TipoTransferencia;
    monto: number;
  }) {
    try {
      await prisma.recibo.create({
        data: {
          numero_recibo: data.numero_recibo,
          tipo_operacion: "TRANSFERENCIA",
          referencia_id: data.transferencia.id,
          usuario_id: data.usuario_id,
          punto_atencion_id: data.punto_atencion_id,
          datos_operacion: {
            transferencia: data.transferencia,
            detalle_divisas: data.detalle_divisas || null,
            responsable_movilizacion: data.responsable_movilizacion || null,
            tipo_transferencia: data.tipo_transferencia,
            monto: data.monto,
            fecha: new Date().toISOString(),
          },
        },
      });
      logger.info("Recibo registrado exitosamente");
    } catch (reciboError) {
      logger.warn("Error registrando recibo (no crítico)", {
        error: reciboError,
      });
    }
  },
};
