import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para realizar un cierre parcial de caja
router.post("/parcial", authenticateToken, async (req, res) => {
  try {
    const { observaciones } = req.body;
    const usuario = req.user;

    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const puntoAtencionId = usuario.punto_atencion_id;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const cuadreAbierto = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: {
          gte: hoy,
        },
        estado: "ABIERTO",
      },
    });

    if (!cuadreAbierto) {
      return res.status(400).json({
        success: false,
        error: "No existe un cuadre abierto para realizar cierre parcial",
      });
    }

    await prisma.cuadreCaja.update({
      where: { id: cuadreAbierto.id },
      data: {
        estado: "PARCIAL",
        observaciones: observaciones || "Cierre parcial realizado",
        fecha_cierre: new Date(),
      },
    });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { punto_atencion_id: null }, // Libera el punto de atención
    });

    res.status(200).json({
      success: true,
      message: "Cierre parcial realizado correctamente",
    });
  } catch (error) {
    logger.error("Error al realizar cierre parcial", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
