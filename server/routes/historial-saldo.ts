import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

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
    const offset = (pageNum - 1) * sizeNum;

    // Construir SQL dinámico con parámetros
    const whereClauses: string[] = ["hs.punto_atencion_id = $1"]; // $1 siempre es pointId
    const params: any[] = [pointId];

    let paramIndex = params.length + 1;

    if (monedaId) {
      whereClauses.push(`hs.moneda_id = $${paramIndex++}`);
      params.push(monedaId);
    }
    if (from) {
      whereClauses.push(`hs.fecha >= $${paramIndex++}`);
      params.push(new Date(from));
    }
    if (to) {
      whereClauses.push(`hs.fecha <= $${paramIndex++}`);
      params.push(new Date(to));
    }

    // Conteo total
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM "HistorialSaldo" hs
      WHERE ${whereClauses.join(" AND ")}
    `;

    const countResult = await pool.query(countQuery, params);
    const total: number = countResult.rows[0]?.total ?? 0;

    // Datos paginados
    const dataParams = params.slice();
    const limitIndex = dataParams.length + 1;
    const offsetIndex = dataParams.length + 2;
    dataParams.push(sizeNum, offset);

    const dataQuery = `
      SELECT 
        hs.*,
        m.nombre AS moneda_nombre, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo,
        u.nombre AS usuario_nombre,
        pa.nombre AS punto_nombre
      FROM "HistorialSaldo" hs
      JOIN "Moneda" m ON hs.moneda_id = m.id
      JOIN "Usuario" u ON hs.usuario_id = u.id
      JOIN "PuntoAtencion" pa ON hs.punto_atencion_id = pa.id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY hs.fecha DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const dataResult = await pool.query(dataQuery, dataParams);

    const historial = dataResult.rows.map((row: any) => ({
      id: row.id,
      punto_atencion_id: row.punto_atencion_id,
      moneda_id: row.moneda_id,
      usuario_id: row.usuario_id,
      cantidad_anterior: row.cantidad_anterior,
      cantidad_incrementada: row.cantidad_incrementada,
      cantidad_nueva: row.cantidad_nueva,
      tipo_movimiento: row.tipo_movimiento,
      fecha: row.fecha,
      descripcion: row.descripcion,
      numero_referencia: row.numero_referencia,
      moneda: {
        id: row.moneda_id,
        nombre: row.moneda_nombre,
        codigo: row.moneda_codigo,
        simbolo: row.moneda_simbolo,
      },
      usuario: {
        id: row.usuario_id,
        nombre: row.usuario_nombre,
      },
      puntoAtencion: {
        id: row.punto_atencion_id,
        nombre: row.punto_nombre,
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
