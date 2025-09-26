import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET historial de saldo por punto (y opcionalmente por moneda) con paginación y filtros de fecha
// Ruta: GET /api/historial-saldo/:pointId?monedaId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=50
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params as { pointId: string };
    const {
      monedaId,
      from,
      to,
      page = "1",
      pageSize = "50",
    } = req.query as {
      monedaId?: string;
      from?: string;
      to?: string;
      page?: string;
      pageSize?: string;
    };

    // Sanitización y límites de paginación
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const sizeNum = Math.min(200, Math.max(1, parseInt(pageSize || "50", 10)));
    const skip = (pageNum - 1) * sizeNum;
    const take = sizeNum;

    // Construir where dinámico
    const where: any = { punto_atencion_id: pointId };

    if (monedaId) {
      where.moneda_id = monedaId;
    }

    // Filtros de fecha (UTC). Si quieres incluir todo el día en 'to',
    // puedes usar fin de día: new Date(`${to}T23:59:59.999Z`)
    if (from || to) {
      where.fecha = {};
      if (from) where.fecha.gte = new Date(from as string);
      if (to) where.fecha.lte = new Date(to as string);
    }

    // Conteo total y datos paginados en paralelo
    const [total, rows] = await Promise.all([
      prisma.historialSaldo.count({ where }),
      prisma.historialSaldo.findMany({
        where,
        orderBy: { fecha: "desc" },
        skip,
        take,
        include: {
          moneda: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    const historial = rows.map((row) => ({
      id: row.id,
      punto_atencion_id: row.punto_atencion_id,
      moneda_id: row.moneda_id,
      usuario_id: row.usuario_id,
      cantidad_anterior: Number(row.cantidad_anterior),
      cantidad_incrementada: Number(row.cantidad_incrementada),
      cantidad_nueva: Number(row.cantidad_nueva),
      tipo_movimiento: row.tipo_movimiento,
      fecha: row.fecha, // ya es Date; si prefieres string ISO: row.fecha.toISOString()
      descripcion: row.descripcion ?? null,
      numero_referencia: row.numero_referencia ?? null,
      moneda: {
        id: row.moneda.id,
        nombre: row.moneda.nombre,
        codigo: row.moneda.codigo,
        simbolo: row.moneda.simbolo,
      },
      usuario: {
        id: row.usuario.id,
        nombre: row.usuario.nombre,
      },
      puntoAtencion: {
        id: row.puntoAtencion.id,
        nombre: row.puntoAtencion.nombre,
      },
    }));

    return res.json({
      success: true,
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum) || 1,
      },
      historial,
    });
  } catch (error) {
    console.error("Error en GET /api/historial-saldo/:pointId:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: (error as any)?.message ?? null,
    });
  }
});

export default router;
