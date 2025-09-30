import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
const router = express.Router();
const updateBehaviorSchema = z.object({
    comportamiento_compra: z.enum(["MULTIPLICA", "DIVIDE"]),
    comportamiento_venta: z.enum(["MULTIPLICA", "DIVIDE"]),
});
// PATCH /api/currencies/:id/behavior - Actualizar comportamiento de una divisa
router.patch("/:id/behavior", authenticateToken, validate(updateBehaviorSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { comportamiento_compra, comportamiento_venta } = req.body;
        if (!req.user?.id) {
            res.status(401).json({
                error: "Usuario no autenticado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Verificar que el usuario tenga permisos de administrador
        if (req.user.rol !== "ADMIN" && req.user.rol !== "SUPER_USUARIO") {
            res.status(403).json({
                error: "No tiene permisos para modificar comportamientos de divisas",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        logger.info("Actualizando comportamiento de divisa", {
            currencyId: id,
            comportamiento_compra,
            comportamiento_venta,
            usuario_id: req.user.id,
        });
        // Verificar que la moneda existe
        const existingCurrency = await prisma.moneda.findUnique({
            where: { id },
        });
        if (!existingCurrency) {
            res.status(404).json({
                error: "Moneda no encontrada",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Actualizar el comportamiento
        const updatedCurrency = await prisma.moneda.update({
            where: { id },
            data: {
                comportamiento_compra,
                comportamiento_venta,
            },
            select: {
                id: true,
                codigo: true,
                nombre: true,
                simbolo: true,
                comportamiento_compra: true,
                comportamiento_venta: true,
            },
        });
        logger.info("Comportamiento de divisa actualizado exitosamente", {
            currencyId: id,
            codigo: updatedCurrency.codigo,
            comportamiento_compra: updatedCurrency.comportamiento_compra,
            comportamiento_venta: updatedCurrency.comportamiento_venta,
            usuario_id: req.user.id,
        });
        res.status(200).json({
            currency: updatedCurrency,
            success: true,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error al actualizar comportamiento de divisa", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            currencyId: req.params.id,
            usuario_id: req.user?.id,
        });
        res.status(500).json({
            error: "Error interno del servidor al actualizar comportamiento de divisa",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
});
// GET /api/currencies/:id/behavior - Obtener comportamiento de una divisa
router.get("/:id/behavior", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.id) {
            res.status(401).json({
                error: "Usuario no autenticado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const currency = await prisma.moneda.findUnique({
            where: { id },
            select: {
                id: true,
                codigo: true,
                nombre: true,
                simbolo: true,
                comportamiento_compra: true,
                comportamiento_venta: true,
            },
        });
        if (!currency) {
            res.status(404).json({
                error: "Moneda no encontrada",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        res.status(200).json({
            currency,
            success: true,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error al obtener comportamiento de divisa", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            currencyId: req.params.id,
            usuario_id: req.user?.id,
        });
        res.status(500).json({
            error: "Error interno del servidor al obtener comportamiento de divisa",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
});
export default router;
