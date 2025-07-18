import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

// Schema para aprobar/rechazar transferencia
const approvalSchema = z.object({
  observaciones: z.string().optional(),
});

// Obtener transferencias pendientes de aprobación
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "OPERADOR"]), // <-- Aquí permitimos OPERADOR también
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const pendingTransfers = await prisma.transferencia.findMany({
        where: {
          estado: "PENDIENTE",
        },
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
        orderBy: {
          fecha: "desc",
        },
      });

      const formattedTransfers = pendingTransfers.map((transfer) => ({
        ...transfer,
        monto: parseFloat(transfer.monto.toString()),
        fecha: transfer.fecha.toISOString(),
        fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null,
        fecha_rechazo: transfer.fecha_rechazo?.toISOString() || null,
      }));

      logger.info("Transferencias pendientes obtenidas", {
        count: formattedTransfers.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        transfers: formattedTransfers,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener transferencias pendientes", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener transferencias pendientes",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Aprobar transferencia
router.patch(
  "/:transferId/approve",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { transferId } = req.params;
      const { observaciones } = req.body;

      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.estado !== "PENDIENTE") {
        res.status(400).json({
          error: "La transferencia ya ha sido procesada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedTransfer = await prisma.transferencia.update({
        where: { id: transferId },
        data: {
          estado: "APROBADO",
          aprobado_por: req.user?.id,
          fecha_aprobacion: new Date(),
          observaciones_aprobacion: observaciones,
        },
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
          usuarioAprobador: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
      });

      logger.info("Transferencia aprobada", {
        transferId,
        approvedBy: req.user?.id,
        amount: transfer.monto.toString(),
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al aprobar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al aprobar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Rechazar transferencia
router.patch(
  "/:transferId/reject",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { transferId } = req.params;
      const { observaciones } = req.body;

      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.estado !== "PENDIENTE") {
        res.status(400).json({
          error: "La transferencia ya ha sido procesada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedTransfer = await prisma.transferencia.update({
        where: { id: transferId },
        data: {
          estado: "RECHAZADO",
          rechazado_por: req.user?.id,
          fecha_rechazo: new Date(),
          observaciones_aprobacion: observaciones,
        },
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
          usuarioRechazador: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
      });

      logger.info("Transferencia rechazada", {
        transferId,
        rejectedBy: req.user?.id,
        amount: transfer.monto.toString(),
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al rechazar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al rechazar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
