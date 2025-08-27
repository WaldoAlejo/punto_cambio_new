import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// Obtener saldos actuales por punto de atención
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;

    console.log(`🔍 Obteniendo saldos actuales para punto: ${pointId}`);

    const query = `
      SELECT 
        s.moneda_id,
        m.codigo as moneda_codigo,
        m.nombre as moneda_nombre,
        m.simbolo as moneda_simbolo,
        COALESCE(s.monto, 0) as saldo
      FROM "Saldo" s
      JOIN "Moneda" m ON s.moneda_id = m.id
      WHERE s.punto_atencion_id = $1
      ORDER BY m.codigo
    `;

    const result = await pool.query(query, [pointId]);

    const saldos = result.rows.map((row) => ({
      moneda_id: row.moneda_id,
      moneda_codigo: row.moneda_codigo,
      moneda_nombre: row.moneda_nombre,
      moneda_simbolo: row.moneda_simbolo,
      saldo: parseFloat(row.saldo),
    }));

    console.log(`✅ Saldos obtenidos: ${saldos.length} monedas`);

    res.json({
      success: true,
      saldos,
    });
  } catch (error) {
    console.error("Error al obtener saldos actuales:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
