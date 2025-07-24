import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { pool } from "../lib/database.js";

const router = express.Router();

// Obtener saldos iniciales por punto de atención
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;

    const query = `
      SELECT si.*, m.nombre as moneda_nombre, m.codigo as moneda_codigo, m.simbolo as moneda_simbolo,
             pa.nombre as punto_nombre, pa.ciudad
      FROM "SaldoInicial" si
      JOIN "Moneda" m ON si.moneda_id = m.id
      JOIN "PuntoAtencion" pa ON si.punto_atencion_id = pa.id
      WHERE si.punto_atencion_id = $1 AND si.activo = true
      ORDER BY si.created_at DESC
    `;

    const result = await pool.query(query, [pointId]);

    res.json({
      success: true,
      saldos: result.rows,
    });
  } catch (error) {
    console.error("Error in get initial balances route:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Asignar saldo inicial
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { punto_atencion_id, moneda_id, cantidad_inicial, observaciones } =
        req.body;

      if (!punto_atencion_id || !moneda_id || cantidad_inicial === undefined) {
        return res.status(400).json({
          success: false,
          error: "Faltan campos obligatorios",
        });
      }

      // Verificar si ya existe un saldo inicial activo
      const existingQuery = `
      SELECT * FROM "SaldoInicial" 
      WHERE punto_atencion_id = $1 AND moneda_id = $2 AND activo = true
    `;
      const existingResult = await pool.query(existingQuery, [
        punto_atencion_id,
        moneda_id,
      ]);

      if (existingResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "Ya existe un saldo inicial activo para esta moneda en este punto",
        });
      }

      // Crear el saldo inicial
      const insertQuery = `
      INSERT INTO "SaldoInicial" (punto_atencion_id, moneda_id, cantidad_inicial, asignado_por, observaciones, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `;

      const userId = req.user?.id ?? ""; // Manejo seguro
      const insertResult = await pool.query(insertQuery, [
        punto_atencion_id,
        moneda_id,
        parseFloat(cantidad_inicial),
        userId,
        observaciones,
      ]);

      // Crear o actualizar el saldo actual
      const upsertSaldoQuery = `
      INSERT INTO "Saldo" (punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas)
      VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (punto_atencion_id, moneda_id)
      DO UPDATE SET cantidad = $3
    `;
      await pool.query(upsertSaldoQuery, [
        punto_atencion_id,
        moneda_id,
        parseFloat(cantidad_inicial),
      ]);

      res.json({
        success: true,
        saldo: insertResult.rows[0],
      });
    } catch (error) {
      console.error("Error in create initial balance route:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

export default router;
