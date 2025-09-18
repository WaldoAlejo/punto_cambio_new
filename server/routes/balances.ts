import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener saldos por punto
router.get(
  "/:pointId",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      // Headers para evitar caché
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const { pointId } = req.params;

      // Validar que pointId es un UUID válido
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(pointId)) {
        res.status(400).json({
          error: "ID de punto de atención inválido",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const balances = await prisma.saldo.findMany({
        where: {
          punto_atencion_id: pointId,
        },
        include: {
          moneda: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              simbolo: true,
            },
          },
        },
      });

      const formattedBalances = balances.map((balance) => ({
        ...balance,
        cantidad: parseFloat(balance.cantidad.toString()),
        billetes: parseFloat(balance.billetes.toString()),
        monedas_fisicas: parseFloat(balance.monedas_fisicas.toString()),
        updated_at: balance.updated_at.toISOString(),
      }));

      logger.info("Saldos obtenidos", {
        pointId,
        count: formattedBalances.length,
        requestedBy: req.user?.id, // <-- Ya no marca error si defines el tipo extendido
      });

      res.status(200).json({
        balances: formattedBalances,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener saldos", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener saldos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
