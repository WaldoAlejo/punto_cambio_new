import express from "express";
import logger from "../utils/logger.js";
import { transferValidationService } from "../services/transferValidationService.js";
import { transferCreationService } from "../services/transferCreationService.js";
import prisma from "../lib/prisma.js";

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

export const transferController = {
  async createTransfer(
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> {
    try {
      const {
        origen_id,
        destino_id,
        moneda_id,
        monto,
        tipo_transferencia,
        descripcion,
        detalle_divisas,
        responsable_movilizacion,
      } = req.body;

      logger.info("=== CREAR TRANSFERENCIA EN SERVIDOR ===", {
        usuarioId: req.user?.id,
        datosRecibidos: req.body,
      });

      // Validaciones
      const userValidation = await transferValidationService.validateUser(
        req.user?.id
      );
      if (!userValidation.success) {
        res.status(401).json({
          error: userValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const destinationValidation =
        await transferValidationService.validateDestination(destino_id);
      if (!destinationValidation.success) {
        res.status(400).json({
          error: destinationValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const currencyValidation =
        await transferValidationService.validateCurrency(moneda_id);
      if (!currencyValidation.success) {
        res.status(400).json({
          error: currencyValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const originValidation = await transferValidationService.validateOrigin(
        origen_id
      );
      if (!originValidation.success) {
        res.status(400).json({
          error: originValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Crear transferencia
      const numeroRecibo = transferCreationService.generateReceiptNumber();

      const transferData = {
        origen_id: origen_id || null,
        destino_id,
        moneda_id,
        monto,
        tipo_transferencia,
        solicitado_por: req.user.id,
        descripcion: descripcion || null,
        numero_recibo: numeroRecibo,
        estado: "PENDIENTE" as const,
        fecha: new Date(),
      };

      const newTransfer = await transferCreationService.createTransfer(
        transferData
      );

      await transferCreationService.createMovement({
        punto_atencion_id: destino_id,
        usuario_id: req.user.id,
        moneda_id,
        monto,
        tipo_transferencia,
        numero_recibo: numeroRecibo,
      });

      await transferCreationService.createReceipt({
        numero_recibo: numeroRecibo,
        usuario_id: req.user.id,
        punto_atencion_id: destino_id,
        transferencia: newTransfer,
        detalle_divisas,
        responsable_movilizacion,
        tipo_transferencia,
        monto,
      });

      const formattedTransfer = {
        ...newTransfer,
        solicitado_por: req.user.id, // <-- Devuelve siempre el id
        monto: parseFloat(newTransfer.monto.toString()),
        fecha: newTransfer.fecha.toISOString(),
        fecha_aprobacion: newTransfer.fecha_aprobacion?.toISOString() || null,
        detalle_divisas: detalle_divisas || null,
        responsable_movilizacion: responsable_movilizacion || null,
      };

      logger.info("Transferencia creada exitosamente", {
        transferId: newTransfer.id,
        createdBy: req.user.id,
        amount: monto,
        type: tipo_transferencia,
        numeroRecibo,
        saved: true,
      });

      res.status(201).json({
        transfer: formattedTransfer,
        success: true,
        message: "Transferencia creada y guardada exitosamente",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        error: "Error interno del servidor al crear transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  },

  async getAllTransfers(
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      logger.info("Obteniendo transferencias de la base de datos...");

      const transfers = await prisma.transferencia.findMany({
        include: {
          origen: { select: { id: true, nombre: true } },
          destino: { select: { id: true, nombre: true } },
          moneda: {
            select: { id: true, codigo: true, nombre: true, simbolo: true },
          },
          usuarioSolicitante: {
            select: { id: true, nombre: true, username: true },
          },
          usuarioAprobador: {
            select: { id: true, nombre: true, username: true },
          },
        },
        orderBy: { fecha: "desc" },
      });

      logger.info(`Transferencias encontradas en BD: ${transfers.length}`);

      const formattedTransfers = transfers.map((transfer) => ({
        ...transfer,
        solicitado_por: transfer.solicitado_por
          ? transfer.solicitado_por
          : transfer.usuarioSolicitante?.id ?? "",
        monto: parseFloat(transfer.monto.toString()),
        fecha: transfer.fecha.toISOString(),
        fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null,
      }));

      res.status(200).json({
        transfers: formattedTransfers,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener transferencias", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener transferencias",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  },
};
