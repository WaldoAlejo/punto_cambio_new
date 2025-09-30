import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
const router = express.Router();
/**
 * GET /saldos-actuales/:pointId
 * Saldos actuales por punto de atención (todas las monedas)
 */
router.get("/:pointId", authenticateToken, async (req, res) => {
    try {
        const { pointId } = req.params;
        const saldos = await prisma.saldo.findMany({
            where: { punto_atencion_id: pointId },
            include: {
                moneda: {
                    select: { id: true, codigo: true, nombre: true, simbolo: true },
                },
            },
            orderBy: { moneda: { codigo: "asc" } },
        });
        const payload = saldos.map((s) => ({
            moneda_id: s.moneda_id,
            moneda_codigo: s.moneda?.codigo ?? null,
            moneda_nombre: s.moneda?.nombre ?? null,
            moneda_simbolo: s.moneda?.simbolo ?? null,
            saldo: parseFloat(s.cantidad.toString()),
        }));
        res.json({ success: true, saldos: payload });
    }
    catch (error) {
        console.error("Error al obtener saldos actuales:", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
            message: error instanceof Error ? error.message : "Error desconocido",
        });
    }
});
/**
 * GET /saldos-actuales/:pointId/:monedaId
 * Saldo actual de una moneda específica en un punto
 */
router.get("/:pointId/:monedaId", authenticateToken, async (req, res) => {
    try {
        const { pointId, monedaId } = req.params;
        const saldo = await prisma.saldo.findUnique({
            where: {
                // Composite unique de tu schema: @@unique([punto_atencion_id, moneda_id])
                punto_atencion_id_moneda_id: {
                    punto_atencion_id: pointId,
                    moneda_id: monedaId,
                },
            },
            include: {
                moneda: { select: { codigo: true, nombre: true, simbolo: true } },
            },
        });
        if (!saldo) {
            return res.json({
                success: true,
                saldo: 0,
                moneda_codigo: null,
                message: "No se encontró saldo para esta moneda en este punto",
            });
        }
        res.json({
            success: true,
            saldo: parseFloat(saldo.cantidad.toString()),
            moneda_codigo: saldo.moneda?.codigo ?? null,
            moneda_nombre: saldo.moneda?.nombre ?? null,
            moneda_simbolo: saldo.moneda?.simbolo ?? null,
        });
    }
    catch (error) {
        console.error("Error al obtener saldo específico:", error);
        res.status(500).json({
            success: false,
            error: "Error interno del servidor",
            message: error instanceof Error ? error.message : "Error desconocido",
        });
    }
});
export default router;
