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
    console.warn("=== CURRENCIES ROUTE - GET / START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);

    try {
      console.warn("Querying database for currencies...");
      const currencies = await prisma.moneda.findMany({
        orderBy: [{ orden_display: "asc" }, { nombre: "asc" }],
      });
      console.warn(
        "Database query result - currencies count:",
        currencies.length
      );
      console.warn("Currencies data:", currencies);

      logger.info("Monedas obtenidas", {
        count: currencies.length,
        requestedBy: req.user?.id,
      });

      const responseData = {
        currencies,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== CURRENCIES ROUTE GET ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al obtener monedas", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al obtener monedas",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== CURRENCIES ROUTE - GET / END ===");
    }
  }
);

// Crear moneda (solo admins)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== CURRENCIES ROUTE - POST / START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("Request body received:", req.body);

    try {
      const { codigo, nombre, simbolo, orden_display = 0 } = req.body;
      console.warn("Extracted currency data:", {
        codigo,
        nombre,
        simbolo,
        orden_display,
      });

      if (!codigo || !nombre || !simbolo) {
        console.warn("Missing required fields");
        const badRequestResponse = {
          error: "Los campos código, nombre y símbolo son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending bad request response:", badRequestResponse);
        res.status(400).json(badRequestResponse);
        return;
      }

      console.warn("Checking if currency code already exists...");
      const existingCurrency = await prisma.moneda.findFirst({
        where: { codigo: codigo.toUpperCase() },
      });

      if (existingCurrency) {
        console.warn("Currency code already exists:", codigo);
        const conflictResponse = {
          error: "El código de moneda ya existe",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending conflict response:", conflictResponse);
        res.status(400).json(conflictResponse);
        return;
      }

      const createData = {
        codigo: codigo.toUpperCase(),
        nombre,
        simbolo,
        orden_display: parseInt(orden_display.toString()) || 0,
        activo: true,
      };
      console.warn("Data to create currency:", createData);

      console.warn("Creating currency in database...");
      const newCurrency = await prisma.moneda.create({
        data: createData,
      });
      console.warn("Currency created successfully:", newCurrency);

      logger.info("Moneda creada", {
        currencyId: newCurrency.id,
        codigo: newCurrency.codigo,
        createdBy: req.user?.id,
      });

      const responseData = {
        currency: newCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error("=== CURRENCIES ROUTE POST ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al crear moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al crear moneda",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== CURRENCIES ROUTE - POST / END ===");
    }
  }
);

// Actualizar moneda (solo admins)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== CURRENCIES ROUTE - PUT /:id START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("Currency ID to update:", req.params.id);
    console.warn("Update data received:", req.body);

    try {
      const currencyId = req.params.id;
      const { codigo, nombre, simbolo, orden_display } = req.body;

      console.warn("Checking if currency exists...");
      const existingCurrency = await prisma.moneda.findUnique({
        where: { id: currencyId },
      });

      if (!existingCurrency) {
        console.warn("Currency not found:", currencyId);
        const notFoundResponse = {
          error: "Moneda no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending not found response:", notFoundResponse);
        res.status(404).json(notFoundResponse);
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
          console.warn("Currency code already exists:", codigo);
          const conflictResponse = {
            error: "El código de moneda ya existe",
            success: false,
            timestamp: new Date().toISOString(),
          };
          console.warn("Sending conflict response:", conflictResponse);
          res.status(400).json(conflictResponse);
          return;
        }
      }

      const updateData: Prisma.MonedaUpdateInput = {};
      if (codigo) updateData.codigo = codigo.toUpperCase();
      if (nombre) updateData.nombre = nombre;
      if (simbolo) updateData.simbolo = simbolo;
      if (orden_display !== undefined)
        updateData.orden_display = parseInt(orden_display.toString()) || 0;

      console.warn("Updating currency...");
      const updatedCurrency = await prisma.moneda.update({
        where: { id: currencyId },
        data: updateData,
      });
      console.warn("Currency updated successfully:", updatedCurrency);

      logger.info("Moneda actualizada", {
        currencyId: updatedCurrency.id,
        codigo: updatedCurrency.codigo,
        updatedBy: req.user?.id,
      });

      const responseData = {
        currency: updatedCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== CURRENCIES ROUTE UPDATE ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al actualizar moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al actualizar moneda",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== CURRENCIES ROUTE - PUT /:id END ===");
    }
  }
);

// Cambiar el estado de una moneda (solo admins)
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== CURRENCIES ROUTE - PATCH /:id/toggle START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("Currency ID to toggle:", req.params.id);

    try {
      const currencyId = req.params.id;

      console.warn("Fetching currency from database...");
      const existingCurrency = await prisma.moneda.findUnique({
        where: { id: currencyId },
      });

      if (!existingCurrency) {
        console.warn("Currency not found:", currencyId);
        const notFoundResponse = {
          error: "Moneda no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending not found response:", notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      console.warn("Toggling currency status...");
      const updatedCurrency = await prisma.moneda.update({
        where: { id: currencyId },
        data: { activo: !existingCurrency.activo },
      });
      console.warn("Currency status toggled successfully:", updatedCurrency);

      logger.info("Estado de moneda cambiado", {
        currencyId: updatedCurrency.id,
        newStatus: updatedCurrency.activo,
        requestedBy: req.user?.id,
      });

      const responseData = {
        currency: updatedCurrency,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== CURRENCIES ROUTE TOGGLE ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al cambiar el estado de la moneda", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al cambiar el estado de la moneda",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== CURRENCIES ROUTE - PATCH /:id/toggle END ===");
    }
  }
);

export default router;
