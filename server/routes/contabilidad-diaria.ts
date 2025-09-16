import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import logger from "../utils/logger.js";
import {
  gyeDayRangeUtcFromDateOnly,
  gyeParseDateOnly,
  gyeDateOnlyToUtcMidnight,
} from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /api/contabilidad-diaria/:pointId/:fecha
 * Devuelve un resumen de movimientos por moneda para el día de Guayaquil (YYYY-MM-DD).
 */
router.get("/:pointId/:fecha", authenticateToken, async (req, res) => {
  try {
    const { pointId, fecha } = req.params;
    if (!pointId) {
      return res.status(400).json({ success: false, error: "Falta pointId" });
    }
    // Validar fecha como YYYY-MM-DD (día calendario de GYE)
    const { y } = gyeParseDateOnly(fecha); // lanza error si no cumple

    // Calcular rango UTC que cubre ese día en GYE
    const { gte, lt } = gyeDayRangeUtcFromDateOnly(fecha);

    // Resumen por moneda desde MovimientoSaldo
    // Mapear tipos de movimiento a ingresos/egresos:
    // Ingresos: VENTA, TRANSFERENCIA_ENTRADA, AJUSTE (positivo), SALDO_INICIAL
    // Egresos: COMPRA, TRANSFERENCIA_SALIDA, AJUSTE (negativo)
    const query = `
      SELECT
        ms.moneda_id,
        SUM(CASE
              WHEN ms.tipo_movimiento IN ('VENTA','TRANSFERENCIA_ENTRADA','SALDO_INICIAL')
                   OR (ms.tipo_movimiento = 'AJUSTE' AND ms.monto > 0)
                THEN ms.monto ELSE 0 END
        ) AS ingresos,
        SUM(CASE
              WHEN ms.tipo_movimiento IN ('COMPRA','TRANSFERENCIA_SALIDA')
                   OR (ms.tipo_movimiento = 'AJUSTE' AND ms.monto < 0)
                THEN ABS(ms.monto) ELSE 0 END
        ) AS egresos,
        COUNT(*) AS movimientos
      FROM "MovimientoSaldo" ms
      WHERE ms.punto_atencion_id = $1
        AND ms.fecha >= $2 AND ms.fecha < $3
      GROUP BY ms.moneda_id
      ORDER BY ms.moneda_id
    `;

    const result = await pool.query(query, [
      pointId,
      gte.toISOString(),
      lt.toISOString(),
    ]);
    return res.json({
      success: true,
      fecha,
      rango_utc: { gte, lt },
      pointId,
      resumen: result.rows,
    });
  } catch (error) {
    logger.error("Error en GET /contabilidad-diaria", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * POST /api/contabilidad-diaria/:pointId/:fecha/cerrar
 * Crea (o actualiza) un registro en CierreDiario marcándolo como CERRADO.
 * Idempotente por (punto_atencion_id, fecha). Usa bloqueos para evitar dobles cierres.
 */
router.post(
  "/:pointId/:fecha/cerrar",
  authenticateToken,
  async (req: any, res) => {
    const client = await pool.connect();
    try {
      const { pointId, fecha } = req.params;
      const { observaciones, diferencias_reportadas } = req.body || {};
      const usuario = req.user;

      if (!usuario?.id) {
        return res
          .status(401)
          .json({ success: false, error: "No autenticado" });
      }
      if (!pointId) {
        return res.status(400).json({ success: false, error: "Falta pointId" });
      }

      // Validar YYYY-MM-DD (lanza si es inválida)
      const { y } = gyeParseDateOnly(fecha);
      // Usamos la cadena YYYY-MM-DD y casteamos a ::date en SQL para la columna DATE
      await client.query("BEGIN");

      // Bloquear (si existe) el registro del día para este punto
      const lockRes = await client.query(
        `
      SELECT id, estado
      FROM "CierreDiario"
      WHERE punto_atencion_id = $1 AND fecha = $2::date
      FOR UPDATE
    `,
        [pointId, fecha]
      );

      // Si ya existe y está cerrado, devolver la fila actual (idempotente)
      if (lockRes.rows.length === 1 && lockRes.rows[0].estado === "CERRADO") {
        await client.query("COMMIT");
        return res.status(200).json({
          success: true,
          info: "ya_cerrado",
          cierre: lockRes.rows[0],
        });
      }

      // Si no existe, crear directamente como CERRADO
      if (lockRes.rows.length === 0) {
        const insertRes = await client.query(
          `
        INSERT INTO "CierreDiario"
          (punto_atencion_id, fecha, usuario_id, observaciones, estado, fecha_cierre, cerrado_por, diferencias_reportadas)
        VALUES ($1, $2::date, $3, $4, 'CERRADO', NOW(), $3, $5)
        RETURNING *
      `,
          [
            pointId,
            fecha, // YYYY-MM-DD
            usuario.id,
            observaciones ?? null,
            diferencias_reportadas
              ? JSON.stringify(diferencias_reportadas)
              : null,
          ]
        );

        await client.query("COMMIT");
        return res
          .status(201)
          .json({ success: true, cierre: insertRes.rows[0] });
      }

      // Existe pero no está CERRADO -> actualizar
      const updateRes = await client.query(
        `
      UPDATE "CierreDiario"
      SET estado = 'CERRADO',
          fecha_cierre = NOW(),
          cerrado_por = $3,
          observaciones = COALESCE($4, observaciones),
          diferencias_reportadas = COALESCE($5, diferencias_reportadas),
          updated_at = NOW()
      WHERE punto_atencion_id = $1 AND fecha = $2::date
      RETURNING *
    `,
        [
          pointId,
          fecha, // YYYY-MM-DD
          usuario.id,
          observaciones ?? null,
          diferencias_reportadas
            ? JSON.stringify(diferencias_reportadas)
            : null,
        ]
      );

      await client.query("COMMIT");
      return res.json({ success: true, cierre: updateRes.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(
        "Error en POST /contabilidad-diaria/:pointId/:fecha/cerrar",
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    } finally {
      client.release();
    }
  }
);

export default router;
