import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { detalles, observaciones } = req.body;

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

    // Verificar si ya existe un cuadre abierto hoy
    const cuadreExistente = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: {
          gte: hoy,
        },
        estado: "ABIERTO",
      },
    });

    if (cuadreExistente) {
      return res.status(400).json({
        success: false,
        error: "Ya existe un cuadre abierto para el día de hoy",
      });
    }

    // Crear el cuadre de caja principal
    const nuevoCuadre = await prisma.cuadreCaja.create({
      data: {
        usuario_id: usuario.id,
        punto_atencion_id: puntoAtencionId,
        observaciones: observaciones || "",
      },
    });

    // Crear los detalles asociados
    for (const detalle of detalles as {
      moneda_id: string;
      saldo_apertura: number;
      saldo_cierre: number;
      conteo_fisico: number;
      billetes: number;
      monedas: number;
    }[]) {
      const {
        moneda_id,
        saldo_apertura,
        saldo_cierre,
        conteo_fisico,
        billetes,
        monedas,
      } = detalle;

      const diferencia = parseFloat((conteo_fisico - saldo_cierre).toFixed(2));

      await prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: nuevoCuadre.id,
          moneda_id,
          saldo_apertura: parseFloat(saldo_apertura.toString()),
          saldo_cierre: parseFloat(saldo_cierre.toString()),
          conteo_fisico: parseFloat(conteo_fisico.toString()),
          billetes: parseInt(billetes.toString(), 10),
          monedas_fisicas: parseInt(monedas.toString(), 10),
          diferencia,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Cuadre de caja guardado correctamente",
    });
  } catch (error) {
    logger.error("Error al guardar el cuadre de caja", {
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
