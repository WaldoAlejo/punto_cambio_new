import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para realizar un cierre parcial de caja
router.post("/parcial", authenticateToken, async (req, res) => {
  try {
    const {
      detalles,
      observaciones,
    }: {
      detalles: Array<{
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
      }>;
      observaciones?: string;
    } = req.body;

    const usuario = req.user;

    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const puntoAtencionId = usuario.punto_atencion_id;

    const { gte: hoy } = gyeDayRangeUtcFromDate(new Date());

    // Buscar cuadre abierto
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

    // Actualizar cuadre a estado PARCIAL
    const cuadreActualizado = await prisma.cuadreCaja.update({
      where: { id: cuadreAbierto.id },
      data: {
        estado: "PARCIAL",
        observaciones: observaciones || "Cierre parcial realizado",
        fecha_cierre: new Date(),
        total_cambios: totalMovimientos,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
      },
    });

    // Eliminar detalles existentes y crear nuevos
    await prisma.detalleCuadreCaja.deleteMany({
      where: { cuadre_id: cuadreActualizado.id },
    });

    // Crear los detalles del cierre parcial
    for (const detalle of detalles) {
      const diferencia = parseFloat(
        (detalle.conteo_fisico - detalle.saldo_cierre).toFixed(2)
      );

      await prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: cuadreActualizado.id,
          moneda_id: detalle.moneda_id,
          saldo_apertura: parseFloat(detalle.saldo_apertura.toString()),
          saldo_cierre: parseFloat(detalle.saldo_cierre.toString()),
          conteo_fisico: parseFloat(detalle.conteo_fisico.toString()),
          billetes: parseInt(detalle.billetes.toString(), 10),
          monedas_fisicas: parseInt(detalle.monedas.toString(), 10),
          diferencia,
        },
      });
    }

    // Finalizar jornada del usuario actual
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

    // Liberar el punto de atención
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { punto_atencion_id: null },
    });

    res.status(200).json({
      success: true,
      message: "Cierre parcial realizado correctamente",
      cuadre_id: cuadreActualizado.id,
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

// Endpoint para verificar si hay cierres parciales pendientes
router.get("/pendientes", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;

    if (!usuario) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
    }

    const { gte: hoy } = gyeDayRangeUtcFromDate(new Date());

    // Buscar cierres parciales del día
    const cierresParciales = await prisma.cuadreCaja.findMany({
      where: {
        fecha: {
          gte: hoy,
        },
        estado: "PARCIAL",
      },
      include: {
        puntoAtencion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
        detalles: {
          include: {
            moneda: {
              select: {
                codigo: true,
                nombre: true,
                simbolo: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_cierre: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: cierresParciales,
    });
  } catch (error) {
    logger.error("Error al obtener cierres parciales pendientes", {
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
