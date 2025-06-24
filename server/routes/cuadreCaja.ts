import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const cuadre = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: hoy,
        },
        estado: "ABIERTO",
      },
      include: {
        detalles: {
          include: {
            moneda: true,
          },
        },
      },
    });

    const cambiosHoy = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: hoy,
        },
      },
      select: {
        moneda_origen_id: true,
        moneda_destino_id: true,
      },
    });

    const monedasUsadas = new Set<string>();
    cambiosHoy.forEach((c) => {
      monedasUsadas.add(c.moneda_origen_id);
      monedasUsadas.add(c.moneda_destino_id);
    });

    const monedas = await prisma.moneda.findMany({
      where: {
        id: {
          in: Array.from(monedasUsadas),
        },
      },
    });

    const detallesConValores = monedas.map((moneda) => {
      const detalle = cuadre?.detalles.find((d) => d.moneda_id === moneda.id);
      return {
        moneda_id: moneda.id,
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        saldo_apertura: detalle?.saldo_apertura || 0,
        saldo_cierre: detalle?.saldo_cierre || 0,
        conteo_fisico: detalle?.conteo_fisico || 0,
        billetes: detalle?.billetes || 0,
        monedas: detalle?.monedas_fisicas || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        detalles: detallesConValores,
        observaciones: cuadre?.observaciones || "",
      },
    });
  } catch (error) {
    logger.error("Error al obtener cuadre de caja", {
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
