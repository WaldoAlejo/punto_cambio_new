import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// Obtener vista consolidada de saldos por punto
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log("🔍 Vista saldos: Iniciando consulta...");
    console.log("👤 Usuario solicitante:", {
      id: req.user?.id,
      rol: req.user?.rol,
    });

    const query = `
      SELECT 
        pa.id as punto_atencion_id,
        pa.nombre as punto_nombre,
        pa.ciudad,
        m.id as moneda_id,
        m.nombre as moneda_nombre,
        m.simbolo as moneda_simbolo,
        m.codigo as moneda_codigo,
        COALESCE(si.cantidad_inicial, 0) as saldo_inicial,
        COALESCE(s.cantidad, 0) as saldo_actual,
        COALESCE(s.billetes, 0) as billetes,
        COALESCE(s.monedas_fisicas, 0) as monedas_fisicas,
        (COALESCE(s.cantidad, 0) - COALESCE(si.cantidad_inicial, 0)) as diferencia,
        s.updated_at as ultima_actualizacion,
        si.fecha_asignacion as fecha_saldo_inicial
      FROM "PuntoAtencion" pa
      CROSS JOIN "Moneda" m
      LEFT JOIN "SaldoInicial" si ON pa.id = si.punto_atencion_id AND m.id = si.moneda_id AND si.activo = true
      LEFT JOIN "Saldo" s ON pa.id = s.punto_atencion_id AND m.id = s.moneda_id
      WHERE pa.activo = true AND m.activo = true
      ORDER BY pa.nombre, m.orden_display, m.nombre
    `;

    console.log("📊 Ejecutando consulta SQL...");
    const result = await pool.query(query);

    console.log(`💰 Saldos encontrados: ${result.rows.length} registros`);

    // Agrupar por punto para mostrar resumen
    const puntosSummary = result.rows.reduce((acc, row) => {
      if (!acc[row.punto_atencion_id]) {
        acc[row.punto_atencion_id] = {
          nombre: row.punto_nombre,
          ciudad: row.ciudad,
          monedas: 0,
        };
      }
      acc[row.punto_atencion_id].monedas++;
      return acc;
    }, {});

    console.log("📍 Resumen por puntos:", puntosSummary);
    console.log("💰 Primeros 5 registros:", result.rows.slice(0, 5));

    res.json({
      success: true,
      saldos: result.rows,
    });
  } catch (error) {
    console.error("❌ Error in balance view route:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
