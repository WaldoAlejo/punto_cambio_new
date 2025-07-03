// server/routes/occupiedPoints.ts

import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos ocupados (con jornada activa o almuerzo HOY)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Buscar jornadas activas o en almuerzo de hoy
    const jornadas = await prisma.jornada.findMany({
      where: {
        estado: { in: ["ACTIVO", "ALMUERZO"] },
        fecha_inicio: {
          gte: hoy,
          lt: manana,
        },
      },
      select: {
        punto_atencion_id: true,
      },
    });

    // Mapear a [{ id: string }]
    const puntosOcupados = jornadas.map((j) => ({ id: j.punto_atencion_id }));

    logger.info("Puntos ocupados consultados", {
      count: puntosOcupados.length,
      requestedBy: req.user?.id,
    });

    res.status(200).json({
      puntos: puntosOcupados,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al consultar puntos ocupados", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
    });
    res.status(500).json({
      error: "Error al consultar puntos ocupados",
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
