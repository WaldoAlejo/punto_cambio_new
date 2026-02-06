import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

const router = express.Router();

// Obtener movimientos de saldo con filtros (query params)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { puntoId, monedaCodigo, fechaInicio, fechaFin } = req.query;

    if (!puntoId) {
      return res.status(400).json({
        success: false,
        error: "puntoId es requerido",
      });
    }

    // Construir filtros dinámicamente
    const where: Prisma.MovimientoSaldoWhereInput = {
      punto_atencion_id: String(puntoId),
    };

    // Filtro por moneda
    if (monedaCodigo) {
      where.moneda = {
        codigo: String(monedaCodigo),
      };
    }

    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      where.fecha = {
        gte: fechaInicio ? new Date(String(fechaInicio)) : undefined,
        lte: fechaFin ? new Date(String(fechaFin)) : undefined,
      };
    }

    const movimientos = await prisma.movimientoSaldo.findMany({
      where,
      orderBy: { fecha: "desc" },
      include: {
        moneda: {
          select: { id: true, nombre: true, codigo: true, simbolo: true },
        },
        usuario: { select: { id: true, nombre: true } },
        puntoAtencion: { select: { id: true, nombre: true } },
      },
    });

    const payload = movimientos.map((ms) => ({
      id: ms.id,
      punto_atencion_id: ms.punto_atencion_id,
      moneda_id: ms.moneda_id,
      moneda_codigo: ms.moneda.codigo,
      tipo_movimiento: ms.tipo_movimiento,
      monto: parseFloat(ms.monto.toString()),
      saldo_anterior: parseFloat(ms.saldo_anterior.toString()),
      saldo_nuevo: parseFloat(ms.saldo_nuevo.toString()),
      usuario_id: ms.usuario_id,
      referencia_id: ms.referencia_id,
      tipo_referencia: ms.tipo_referencia,
      descripcion: ms.descripcion,
      fecha: ms.fecha,
      created_at: ms.created_at,
      moneda: {
        id: ms.moneda.id,
        nombre: ms.moneda.nombre,
        codigo: ms.moneda.codigo,
        simbolo: ms.moneda.simbolo,
      },
      usuario: {
        id: ms.usuario.id,
        nombre: ms.usuario.nombre,
      },
      puntoAtencion: {
        id: ms.puntoAtencion.id,
        nombre: ms.puntoAtencion.nombre,
      },
    }));

    res.json(payload);
  } catch (error) {
    console.error("Error in filtered balance movements route:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Obtener movimientos de saldo por punto (Prisma)
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
    const take = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 500);

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: { punto_atencion_id: pointId },
      orderBy: { fecha: "desc" },
      take,
      include: {
        moneda: {
          select: { id: true, nombre: true, codigo: true, simbolo: true },
        },
        usuario: { select: { id: true, nombre: true } },
        puntoAtencion: { select: { id: true, nombre: true } },
      },
    });

    const payload = movimientos.map((ms) => ({
      id: ms.id,
      punto_atencion_id: ms.punto_atencion_id,
      moneda_id: ms.moneda_id,
      tipo_movimiento: ms.tipo_movimiento,
      // Prisma.Decimal -> number
      monto: parseFloat(ms.monto.toString()),
      saldo_anterior: parseFloat(ms.saldo_anterior.toString()),
      saldo_nuevo: parseFloat(ms.saldo_nuevo.toString()),
      usuario_id: ms.usuario_id,
      referencia_id: ms.referencia_id,
      tipo_referencia: ms.tipo_referencia,
      descripcion: ms.descripcion,
      fecha: ms.fecha, // si prefieres ISO: ms.fecha.toISOString()
      created_at: ms.created_at,
      moneda: {
        id: ms.moneda.id,
        nombre: ms.moneda.nombre,
        codigo: ms.moneda.codigo,
        simbolo: ms.moneda.simbolo,
      },
      usuario: {
        id: ms.usuario.id,
        nombre: ms.usuario.nombre,
      },
      puntoAtencion: {
        id: ms.puntoAtencion.id,
        nombre: ms.puntoAtencion.nombre,
      },
    }));

    res.json({ success: true, movimientos: payload });
  } catch (error) {
    console.error("Error in balance movements route (Prisma):", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
