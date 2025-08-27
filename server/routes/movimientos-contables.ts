import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// Obtener movimientos contables (historial de movimientos de saldo) por punto
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    const { limit = 50, moneda_id } = req.query;

    console.log(`🔍 Obteniendo movimientos contables para punto: ${pointId}`, {
      limit,
      moneda_id,
    });

    let query = `
      SELECT ms.*, 
             m.nombre as moneda_nombre, m.codigo as moneda_codigo, m.simbolo as moneda_simbolo,
             u.nombre as usuario_nombre,
             pa.nombre as punto_nombre
      FROM "MovimientoSaldo" ms
      JOIN "Moneda" m ON ms.moneda_id = m.id
      JOIN "Usuario" u ON ms.usuario_id = u.id
      JOIN "PuntoAtencion" pa ON ms.punto_atencion_id = pa.id
      WHERE ms.punto_atencion_id = $1
    `;

    const params = [pointId];

    // Filtrar por moneda si se especifica
    if (moneda_id) {
      query += ` AND ms.moneda_id = $${params.length + 1}`;
      params.push(moneda_id as string);
    }

    query += ` ORDER BY ms.fecha DESC LIMIT $${params.length + 1}`;
    params.push(limit as string);

    const result = await pool.query(query, params);

    // Formatear los resultados para incluir los objetos anidados
    const movimientos = result.rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      monto: parseFloat(row.monto),
      saldo_anterior: parseFloat(row.saldo_anterior),
      saldo_nuevo: parseFloat(row.saldo_nuevo),
      descripcion: row.descripcion,
      fecha: row.fecha,
      moneda_id: row.moneda_id,
      usuario_id: row.usuario_id,
      punto_atencion_id: row.punto_atencion_id,
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

    console.log(`✅ Movimientos obtenidos: ${movimientos.length}`);

    res.json({
      success: true,
      movimientos,
    });
  } catch (error) {
    console.error("Error al obtener movimientos contables:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
