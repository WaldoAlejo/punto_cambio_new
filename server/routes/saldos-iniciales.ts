import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

const toNumber = (v: any) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace?.(",", "."));
  return Number(v);
};

// Obtener saldos iniciales por punto de atención
router.get("/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;

    const query = `
      SELECT 
        si.id, si.punto_atencion_id, si.moneda_id, si.cantidad_inicial,
        si.asignado_por, si.observaciones, si.activo, si.created_at,
        m.nombre AS moneda_nombre, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo,
        pa.nombre AS punto_nombre, pa.ciudad
      FROM "SaldoInicial" si
      JOIN "Moneda" m ON si.moneda_id = m.id
      JOIN "PuntoAtencion" pa ON si.punto_atencion_id = pa.id
      WHERE si.punto_atencion_id = $1 AND si.activo = true
      ORDER BY si.created_at DESC
    `;
    const result = await pool.query(query, [pointId]);

    res.json({ success: true, saldos: result.rows });
  } catch (error) {
    console.error("Error in get initial balances route:", error);
    res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
});

// Asignar saldo inicial
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    console.warn("=== SALDOS INICIALES POST START ===");
    console.warn("Request body:", req.body);
    console.warn("Request user:", req.user);

    try {
      const { punto_atencion_id, moneda_id, cantidad_inicial, observaciones } =
        req.body;

      console.warn("Extracted data:", {
        punto_atencion_id,
        moneda_id,
        cantidad_inicial,
        observaciones,
      });

      if (!punto_atencion_id || !moneda_id || cantidad_inicial === undefined) {
        console.warn("Missing required fields");
        return res
          .status(400)
          .json({ success: false, error: "Faltan campos obligatorios" });
      }

      if (!req.user?.id) {
        console.warn("User not authenticated");
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      // Verificar si ya existe un saldo inicial activo
      console.warn("Checking for existing initial balance...");
      const existingQuery = `
      SELECT id, cantidad_inicial FROM "SaldoInicial" 
      WHERE punto_atencion_id = $1 AND moneda_id = $2 AND activo = true
      LIMIT 1
    `;
      const existingResult = await pool.query(existingQuery, [
        punto_atencion_id,
        moneda_id,
      ]);
      console.warn("Existing balance check result:", existingResult.rows);

      if (existingResult.rows.length > 0) {
        console.warn("Initial balance already exists:", existingResult.rows[0]);

        // Si ya existe, actualizar el saldo existente
        const updateQuery = `
          UPDATE "SaldoInicial" 
          SET cantidad_inicial = $3, observaciones = $4, updated_at = NOW()
          WHERE punto_atencion_id = $1 AND moneda_id = $2 AND activo = true
          RETURNING *
        `;
        const cantidad = toNumber(cantidad_inicial);
        console.warn(
          "Updating existing initial balance with amount:",
          cantidad
        );

        const updateResult = await pool.query(updateQuery, [
          punto_atencion_id,
          moneda_id,
          cantidad,
          observaciones ?? null,
        ]);
        console.warn("Initial balance updated:", updateResult.rows[0]);

        // Actualizar también el saldo actual
        console.warn("Updating current balance...");
        const upsertSaldoQuery = `
          INSERT INTO "Saldo" (punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas)
          VALUES ($1, $2, $3, 0, 0)
          ON CONFLICT (punto_atencion_id, moneda_id)
          DO UPDATE SET cantidad = EXCLUDED.cantidad
        `;
        await pool.query(upsertSaldoQuery, [
          punto_atencion_id,
          moneda_id,
          cantidad,
        ]);
        console.warn("Current balance updated successfully");

        const response = {
          success: true,
          saldo: updateResult.rows[0],
          updated: true,
        };
        console.warn("Sending update success response:", response);
        return res.json(response);
      }

      // Crear el saldo inicial
      console.warn("Creating initial balance...");
      const insertQuery = `
      INSERT INTO "SaldoInicial" 
        (punto_atencion_id, moneda_id, cantidad_inicial, asignado_por, observaciones, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `;
      const cantidad = toNumber(cantidad_inicial);
      console.warn("Converted amount:", cantidad);
      console.warn("Insert query params:", [
        punto_atencion_id,
        moneda_id,
        cantidad,
        req.user.id,
        observaciones ?? null,
      ]);

      const insertResult = await pool.query(insertQuery, [
        punto_atencion_id,
        moneda_id,
        cantidad,
        req.user.id,
        observaciones ?? null,
      ]);
      console.warn("Initial balance created:", insertResult.rows[0]);

      // Crear o actualizar el saldo actual
      console.warn("Upserting current balance...");
      const upsertSaldoQuery = `
      INSERT INTO "Saldo" (punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas)
      VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (punto_atencion_id, moneda_id)
      DO UPDATE SET cantidad = EXCLUDED.cantidad
    `;
      await pool.query(upsertSaldoQuery, [
        punto_atencion_id,
        moneda_id,
        cantidad,
      ]);
      console.warn("Current balance upserted successfully");

      const response = { success: true, saldo: insertResult.rows[0] };
      console.warn("Sending success response:", response);
      res.json(response);
    } catch (error) {
      console.error("=== SALDOS INICIALES POST ERROR ===");
      console.error("Error details:", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );

      const errorResponse = {
        success: false,
        error: "Error interno del servidor",
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== SALDOS INICIALES POST END ===");
    }
  }
);

export default router;
