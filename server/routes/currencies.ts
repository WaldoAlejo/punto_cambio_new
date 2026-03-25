import express from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Obtener todas las monedas (acceso para todos los usuarios autenticados)
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const currencies = await prisma.moneda.findMany({
        orderBy: [{ orden_display: "asc" }, { nombre: "asc" }],
      });

      logger.info("Monedas obtenidas", {
        count: currencies.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        currencies,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener monedas", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener monedas",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Crear moneda (solo admins)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { codigo, nombre, simbolo, orden_display = 0 } = req.body;

      if (!codigo || !nombre || !simbolo) {
        res.status(400).json({
          error: "Los campos código, nombre y símbolo son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existingCurrency = await prisma.moneda.findFirst({
        where: { codigo: codigo.toUpperCase() },
      });

      if (existingCurrency) {
        res.status(400).json({
          error: "El código de moneda ya existe",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const createData = {
        codigo: codigo.toUpperCase(),
        nombre,
        simbolo,
        orden_display: parseInt(orden_display.toString()) || 0,
        activo: true,
      };

      const newCurrency = await prisma.moneda.create({
        data: createData,
      });

      logger.info("Moneda creada", {
        currencyId: newCurrency.id,
        codigo: newCurrency.codigo,
        createdBy: req.user?.id,
      });

      res.status(201).json({
        currency: newCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al crear moneda",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Actualizar moneda (solo admins)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const currencyId = req.params.id;
      const { codigo, nombre, simbolo, orden_display } = req.body;

      const existingCurrency = await prisma.moneda.findUnique({
        where: { id: currencyId },
      });

      if (!existingCurrency) {
        res.status(404).json({
          error: "Moneda no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verificar si el código ya existe en otra moneda
      if (codigo && codigo !== existingCurrency.codigo) {
        const codeExists = await prisma.moneda.findFirst({
          where: {
            codigo: codigo.toUpperCase(),
            id: { not: currencyId },
          },
        });

        if (codeExists) {
          res.status(400).json({
            error: "El código de moneda ya existe",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const updateData: Prisma.MonedaUpdateInput = {};
      if (codigo) updateData.codigo = codigo.toUpperCase();
      if (nombre) updateData.nombre = nombre;
      if (simbolo) updateData.simbolo = simbolo;
      if (orden_display !== undefined)
        updateData.orden_display = parseInt(orden_display.toString()) || 0;

      const updatedCurrency = await prisma.moneda.update({
        where: { id: currencyId },
        data: updateData,
      });

      logger.info("Moneda actualizada", {
        currencyId: updatedCurrency.id,
        codigo: updatedCurrency.codigo,
        updatedBy: req.user?.id,
      });

      res.status(200).json({
        currency: updatedCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al actualizar moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al actualizar moneda",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Cambiar el estado de una moneda (solo admins)
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const currencyId = req.params.id;

      const existingCurrency = await prisma.moneda.findUnique({
        where: { id: currencyId },
      });

      if (!existingCurrency) {
        res.status(404).json({
          error: "Moneda no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedCurrency = await prisma.moneda.update({
        where: { id: currencyId },
        data: { activo: !existingCurrency.activo },
      });

      logger.info("Estado de moneda cambiado", {
        currencyId: updatedCurrency.id,
        newStatus: updatedCurrency.activo,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        currency: updatedCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cambiar el estado de la moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al cambiar el estado de la moneda",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
