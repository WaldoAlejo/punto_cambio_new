import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { z } from "zod";
const router = express.Router();
/** Validación de params con Zod */
const paramsSchema = z.object({
    pointId: z.string().uuid("ID de punto de atención inválido"),
});
/**
 * GET /balances/:pointId
 * Devuelve los saldos actuales (todas las monedas) para un punto de atención.
 *  - 100% Prisma
 *  - Sin caché
 *  - Decimales normalizados a number
 */
router.get("/:pointId", authenticateToken, async (req, res) => {
    try {
        // Headers anti-caché
        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
        });
        // Validar params
        const parsed = paramsSchema.safeParse(req.params);
        if (!parsed.success) {
            res.status(400).json({
                error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const { pointId } = parsed.data;
        // Opcional: verificar que el punto exista (da mejor DX en UI)
        const punto = await prisma.puntoAtencion.findUnique({
            where: { id: pointId },
            select: { id: true, nombre: true, activo: true },
        });
        if (!punto) {
            res.status(404).json({
                error: "Punto de atención no encontrado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Traer saldos + info de moneda
        const balances = await prisma.saldo.findMany({
            where: { punto_atencion_id: pointId },
            include: {
                moneda: {
                    select: { id: true, codigo: true, nombre: true, simbolo: true },
                },
            },
            orderBy: [{ moneda: { codigo: "asc" } }],
        });
        const formatted = balances.map((b) => ({
            id: b.id,
            punto_atencion_id: b.punto_atencion_id,
            moneda_id: b.moneda_id,
            moneda: {
                id: b.moneda.id,
                codigo: b.moneda.codigo,
                nombre: b.moneda.nombre,
                simbolo: b.moneda.simbolo,
            },
            cantidad: Number(b.cantidad),
            billetes: Number(b.billetes),
            monedas_fisicas: Number(b.monedas_fisicas),
            bancos: Number(b.bancos),
            updated_at: b.updated_at.toISOString(),
        }));
        logger.info("Saldos obtenidos", {
            pointId,
            pointName: punto.nombre,
            count: formatted.length,
            requestedBy: req.user?.id ?? null,
        });
        res.status(200).json({
            success: true,
            punto: { id: punto.id, nombre: punto.nombre, activo: punto.activo },
            saldos: formatted,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error al obtener saldos", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            requestedBy: req.user?.id ?? null,
        });
        res.status(500).json({
            error: "Error al obtener saldos",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
});
export default router;
