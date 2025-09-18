import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const isTimeoutError = (err: any) =>
  err?.code === "57014" || // PG: statement_timeout / canceling statement due to statement timeout
  err?.code === "ETIMEDOUT" ||
  err?.message?.toLowerCase?.().includes("timeout");

// Consulta principal (rápida) contra tabla Saldo
const SQL_MAIN = `
  SELECT 
    s.moneda_id,
    m.codigo   AS moneda_codigo,
    m.nombre   AS moneda_nombre,
    m.simbolo  AS moneda_simbolo,
    COALESCE(s.cantidad, 0) AS saldo
  FROM "Saldo" s
  JOIN "Moneda" m ON m.id = s.moneda_id
  WHERE s.punto_atencion_id = $1
  ORDER BY m.codigo;
`;

// Consulta fallback: calcula saldo = inicial + delta(movimientos)
const SQL_FALLBACK = `
WITH iniciales AS (
  SELECT moneda_id, SUM(cantidad_inicial) AS saldo_inicial
  FROM "SaldoInicial"
  WHERE punto_atencion_id = $1
    AND activo = TRUE
  GROUP BY moneda_id
),
movs AS (
  SELECT moneda_id,
         SUM(
           CASE
             WHEN tipo_movimiento IN ('INGRESO','TRANSFERENCIA_ENTRANTE') THEN monto
             WHEN tipo_movimiento IN ('EGRESO','TRANSFERENCIA_SALIENTE')   THEN -monto
             WHEN tipo_movimiento = 'AJUSTE'                               THEN monto
             WHEN tipo_movimiento = 'SALDO_INICIAL'                        THEN 0
             WHEN tipo_movimiento = 'CAMBIO_DIVISA'                        THEN 0
             ELSE 0
           END
         ) AS delta
  FROM "MovimientoSaldo"
  WHERE punto_atencion_id = $1
  GROUP BY moneda_id
)
SELECT 
  m.id      AS moneda_id,
  m.codigo  AS moneda_codigo,
  m.nombre  AS moneda_nombre,
  m.simbolo AS moneda_simbolo,
  COALESCE(i.saldo_inicial,0) + COALESCE(v.delta,0) AS saldo
FROM "Moneda" m
LEFT JOIN iniciales i ON i.moneda_id = m.id
LEFT JOIN movs     v  ON v.moneda_id = m.id
WHERE EXISTS (SELECT 1 FROM iniciales i2 WHERE i2.moneda_id = m.id)
   OR EXISTS (SELECT 1 FROM movs      v2 WHERE v2.moneda_id = m.id)
ORDER BY m.codigo;
`;

// ---------------------------------------------
// GET /:pointId  → saldos por punto (main + fallback)
// ---------------------------------------------
router.get("/:pointId", authenticateToken, async (req, res) => {
  const { pointId } = req.params;

  try {
    console.log(`🔍 Saldos (main) punto=${pointId}`);
    const result = await pool.query(SQL_MAIN, [pointId]);

    // Si hay filas, devolvemos; si no hay, igual devolvemos vacío (no es error)
    if (result?.rows) {
      const saldos = result.rows.map((row) => ({
        moneda_id: row.moneda_id,
        moneda_codigo: row.moneda_codigo,
        moneda_nombre: row.moneda_nombre,
        moneda_simbolo: row.moneda_simbolo,
        saldo: Number(row.saldo) || 0,
      }));
      console.log(`✅ Saldos (main) OK: ${saldos.length} monedas`);
      return res.json({ success: true, saldos, source: "saldo_table" });
    }

    // Por seguridad, si no hubo rows, intentamos fallback
    console.warn("ℹ️ Main sin rows, probando fallback…");
    const fb = await pool.query(SQL_FALLBACK, [pointId]);
    const saldosFb = fb.rows.map((row) => ({
      moneda_id: row.moneda_id,
      moneda_codigo: row.moneda_codigo,
      moneda_nombre: row.moneda_nombre,
      moneda_simbolo: row.moneda_simbolo,
      saldo: Number(row.saldo) || 0,
    }));
    console.log(`✅ Saldos (fallback) OK: ${saldosFb.length} monedas`);
    return res.json({
      success: true,
      saldos: saldosFb,
      source: "fallback_cte",
    });
  } catch (err: any) {
    console.error("❌ Error main saldos:", err?.message || err);

    // Si fue timeout u otro error del main → intentamos fallback
    if (isTimeoutError(err)) {
      try {
        console.warn("⏱️ Timeout en main. Ejecutando fallback…");
        const fb = await pool.query(SQL_FALLBACK, [req.params.pointId]);
        const saldosFb = fb.rows.map((row) => ({
          moneda_id: row.moneda_id,
          moneda_codigo: row.moneda_codigo,
          moneda_nombre: row.moneda_nombre,
          moneda_simbolo: row.moneda_simbolo,
          saldo: Number(row.saldo) || 0,
        }));
        console.log(
          `✅ Saldos (fallback por timeout) OK: ${saldosFb.length} monedas`
        );
        return res.json({
          success: true,
          saldos: saldosFb,
          source: "fallback_cte",
        });
      } catch (err2: any) {
        console.error("❌ Fallback también falló:", err2?.message || err2);
        return res.status(503).json({
          success: false,
          error: "Servicio no disponible",
          message:
            err2?.message ||
            "Se agotó el tiempo de respuesta en el cálculo de saldos",
        });
      }
    }

    // Error no recuperable
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

// ---------------------------------------------
// GET /:pointId/:monedaId  → saldo de una moneda específica
// ---------------------------------------------
router.get("/:pointId/:monedaId", authenticateToken, async (req, res) => {
  const { pointId, monedaId } = req.params;

  try {
    console.log(`🔍 Saldo específico (main)`, { pointId, monedaId });

    const q = `
      SELECT 
        s.cantidad AS saldo,
        m.codigo   AS moneda_codigo,
        m.nombre   AS moneda_nombre,
        m.simbolo  AS moneda_simbolo
      FROM "Saldo" s
      JOIN "Moneda" m ON m.id = s.moneda_id
      WHERE s.punto_atencion_id = $1 AND s.moneda_id = $2
    `;
    const result = await pool.query(q, [pointId, monedaId]);

    if (result.rows.length === 0) {
      // Fallback puntual (opcional): calcular solo esa moneda
      const qFb = `
        WITH inicial AS (
          SELECT SUM(cantidad_inicial) AS saldo_inicial
          FROM "SaldoInicial"
          WHERE punto_atencion_id = $1 AND moneda_id = $2 AND activo = TRUE
        ),
        movs AS (
          SELECT
            SUM(
              CASE
                WHEN tipo_movimiento IN ('INGRESO','TRANSFERENCIA_ENTRANTE') THEN monto
                WHEN tipo_movimiento IN ('EGRESO','TRANSFERENCIA_SALIENTE')   THEN -monto
                WHEN tipo_movimiento = 'AJUSTE'                               THEN monto
                WHEN tipo_movimiento IN ('SALDO_INICIAL','CAMBIO_DIVISA')     THEN 0
                ELSE 0
              END
            ) AS delta
          FROM "MovimientoSaldo"
          WHERE punto_atencion_id = $1 AND moneda_id = $2
        )
        SELECT 
          m.codigo  AS moneda_codigo,
          m.nombre  AS moneda_nombre,
          m.simbolo AS moneda_simbolo,
          COALESCE(i.saldo_inicial,0) + COALESCE(v.delta,0) AS saldo
        FROM "Moneda" m
        LEFT JOIN inicial i ON TRUE
        LEFT JOIN movs    v ON TRUE
        WHERE m.id = $2
        LIMIT 1;
      `;
      const fb = await pool.query(qFb, [pointId, monedaId]);

      if (fb.rows.length === 0) {
        return res.json({
          success: true,
          saldo: 0,
          moneda_codigo: null,
          message: "No se encontró saldo para esta moneda en este punto",
          source: "none",
        });
      }

      const row = fb.rows[0];
      return res.json({
        success: true,
        saldo: Number(row.saldo) || 0,
        moneda_codigo: row.moneda_codigo,
        moneda_nombre: row.moneda_nombre,
        moneda_simbolo: row.moneda_simbolo,
        source: "fallback_cte",
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      saldo: Number(row.saldo) || 0,
      moneda_codigo: row.moneda_codigo,
      moneda_nombre: row.moneda_nombre,
      moneda_simbolo: row.moneda_simbolo,
      source: "saldo_table",
    });
  } catch (error: any) {
    console.error("Error al obtener saldo específico:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// ---------------------------------------------
// GET /vista/:pointId  → endpoint alterno rápido (CTE optimizada)
//    Útil para el fallback del frontend: /vista-saldos-puntos/:pointId
// ---------------------------------------------
router.get("/vista/:pointId", authenticateToken, async (req, res) => {
  const { pointId } = req.params;
  try {
    console.log(`🔍 Saldos (vista/fallback) punto=${pointId}`);
    const result = await pool.query(SQL_FALLBACK, [pointId]);
    const saldos = result.rows.map((row) => ({
      moneda_id: row.moneda_id,
      moneda_codigo: row.moneda_codigo,
      moneda_nombre: row.moneda_nombre,
      moneda_simbolo: row.moneda_simbolo,
      saldo: Number(row.saldo) || 0,
    }));
    console.log(`✅ Saldos (vista) OK: ${saldos.length} monedas`);
    res.json({ success: true, saldos, source: "fallback_cte" });
  } catch (err: any) {
    console.error("❌ Error vista/fallback:", err?.message || err);
    res.status(503).json({
      success: false,
      error: "Servicio no disponible",
      message:
        err?.message ||
        "Se agotó el tiempo de respuesta en el cálculo de saldos (vista)",
    });
  }
});

export default router;
