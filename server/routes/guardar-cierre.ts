import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

interface DetalleRequest {
  moneda_id: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number;
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string;
}

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      detalles,
      observaciones,
      tipo_cierre = "CERRADO",
    }: {
      detalles: DetalleRequest[];
      observaciones?: string;
      tipo_cierre?: "CERRADO" | "PARCIAL";
    } = req.body;

    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const puntoAtencionId = usuario.punto_atencion_id;

    // Usar ventana de día GYE para evitar problemas de zona horaria
    const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

    const cuadreCerradoHoy = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: {
          gte: hoyGte,
          lt: hoyLt,
        },
        estado: "CERRADO",
      },
    });

    if (cuadreCerradoHoy && tipo_cierre === "CERRADO") {
      return res.status(400).json({
        success: false,
        error: "Ya existe un cuadre cerrado para el día de hoy",
      });
    }

    const cuadreExistente = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: {
          gte: hoyGte,
          lt: hoyLt,
        },
        estado: "ABIERTO",
      },
    });

    // Calcular totales
    const totalIngresos = detalles.reduce(
      (sum, d) => sum + (d.ingresos_periodo || 0),
      0
    );
    const totalEgresos = detalles.reduce(
      (sum, d) => sum + (d.egresos_periodo || 0),
      0
    );
    const totalMovimientos = detalles.reduce(
      (sum, d) => sum + (d.movimientos_periodo || 0),
      0
    );

    let cuadre;

    if (cuadreExistente) {
      cuadre = await prisma.cuadreCaja.update({
        where: { id: cuadreExistente.id },
        data: {
          estado: tipo_cierre,
          observaciones: observaciones || "",
          fecha_cierre: new Date(),
          total_cambios: totalMovimientos,
          total_ingresos: totalIngresos,
          total_egresos: totalEgresos,
        },
      });
    } else {
      cuadre = await prisma.cuadreCaja.create({
        data: {
          usuario_id: usuario.id,
          punto_atencion_id: puntoAtencionId,
          estado: tipo_cierre,
          observaciones: observaciones || "",
          fecha_cierre: new Date(),
          total_cambios: totalMovimientos,
          total_ingresos: totalIngresos,
          total_egresos: totalEgresos,
        },
      });
    }

    await prisma.detalleCuadreCaja.deleteMany({
      where: { cuadre_id: cuadre.id },
    });

    for (const detalle of detalles) {
      const diferencia = parseFloat(
        (detalle.conteo_fisico - detalle.saldo_cierre).toFixed(2)
      );

      await prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: cuadre.id,
          moneda_id: detalle.moneda_id,
          saldo_apertura: parseFloat(detalle.saldo_apertura.toString()),
          saldo_cierre: parseFloat(detalle.saldo_cierre.toString()),
          conteo_fisico: parseFloat(detalle.conteo_fisico.toString()),
          billetes: parseInt(detalle.billetes.toString(), 10),
          monedas_fisicas: parseInt(detalle.monedas.toString(), 10),
          diferencia,
          movimientos_periodo: detalle.movimientos_periodo || 0,
          observaciones_detalle: detalle.observaciones_detalle || null,
        },
      });
    }

    // Al cerrar caja, finalizamos la jornada activa del usuario
    await prisma.jornada.updateMany({
      where: {
        usuario_id: usuario.id,
        punto_atencion_id: puntoAtencionId,
        estado: "ACTIVO",
      },
      data: {
        fecha_salida: new Date(),
        estado: "COMPLETADO",
      },
    });

    // Liberar el punto de atención para el usuario
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { punto_atencion_id: null },
    });

    const mensaje =
      tipo_cierre === "PARCIAL"
        ? "Cierre parcial realizado correctamente"
        : "Cierre de caja realizado correctamente";

    res.status(200).json({
      success: true,
      message: mensaje,
      cuadre_id: cuadre.id,
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
