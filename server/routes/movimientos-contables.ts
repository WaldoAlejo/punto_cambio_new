import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { randomUUID } from "crypto";

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

// Validar saldo para un cambio de divisas
router.post("/validar-saldo", authenticateToken, async (req, res) => {
  try {
    const { punto_atencion_id, moneda_id, monto_requerido } = req.body;

    console.log(`🔍 Validando saldo para cambio:`, {
      punto_atencion_id,
      moneda_id,
      monto_requerido,
    });

    if (!punto_atencion_id || !moneda_id || monto_requerido === undefined) {
      return res.status(400).json({
        success: false,
        message: "Faltan parámetros requeridos",
      });
    }

    // Obtener saldo actual
    const saldoQuery = `
      SELECT cantidad FROM "Saldo" 
      WHERE punto_atencion_id = $1 AND moneda_id = $2
    `;
    const saldoResult = await pool.query(saldoQuery, [
      punto_atencion_id,
      moneda_id,
    ]);

    const saldo_actual =
      saldoResult.rows.length > 0
        ? parseFloat(saldoResult.rows[0].cantidad)
        : 0;

    const valido = saldo_actual >= parseFloat(monto_requerido);

    console.log(`💰 Validación de saldo:`, {
      saldo_actual,
      monto_requerido: parseFloat(monto_requerido),
      valido,
    });

    res.json({
      success: true,
      valido,
      saldo_actual,
      mensaje: valido
        ? "Saldo suficiente"
        : `Saldo insuficiente. Disponible: ${saldo_actual}, Requerido: ${monto_requerido}`,
    });
  } catch (error) {
    console.error("Error al validar saldo:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Procesar movimientos contables para un cambio de divisas
router.post("/procesar-cambio", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { cambio_id, movimientos } = req.body;

    console.log(
      `🔄 Procesando movimientos contables para cambio: ${cambio_id}`,
      {
        movimientos_count: movimientos?.length || 0,
      }
    );

    if (!cambio_id || !movimientos || !Array.isArray(movimientos)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Faltan parámetros requeridos o formato inválido",
      });
    }

    const saldos_actualizados = [];

    for (const movimiento of movimientos) {
      const {
        punto_atencion_id,
        moneda_id,
        tipo_movimiento,
        monto,
        usuario_id,
        referencia_id,
        tipo_referencia,
        descripcion,
      } = movimiento;

      // Obtener saldo actual
      const saldoQuery = `
        SELECT cantidad FROM "Saldo" 
        WHERE punto_atencion_id = $1 AND moneda_id = $2
      `;
      const saldoResult = await client.query(saldoQuery, [
        punto_atencion_id,
        moneda_id,
      ]);

      const saldo_anterior =
        saldoResult.rows.length > 0
          ? parseFloat(saldoResult.rows[0].cantidad)
          : 0;

      // Calcular nuevo saldo
      const monto_decimal = parseFloat(monto);
      const saldo_nuevo =
        tipo_movimiento === "INGRESO"
          ? saldo_anterior + monto_decimal
          : saldo_anterior - monto_decimal;

      // Validar que no quede saldo negativo en EGRESO
      if (tipo_movimiento === "EGRESO" && saldo_nuevo < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Saldo insuficiente para ${descripcion}. Disponible: ${saldo_anterior}, Requerido: ${monto_decimal}`,
        });
      }

      // Crear el movimiento de saldo
      const insertMovimientoQuery = `
        INSERT INTO "MovimientoSaldo" 
        (id, punto_atencion_id, moneda_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, 
         usuario_id, referencia_id, tipo_referencia, descripcion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const movimiento_id = randomUUID();

      await client.query(insertMovimientoQuery, [
        movimiento_id,
        punto_atencion_id,
        moneda_id,
        tipo_movimiento,
        monto_decimal,
        saldo_anterior,
        saldo_nuevo,
        usuario_id,
        referencia_id,
        tipo_referencia,
        descripcion,
      ]);

      // Actualizar saldo actual (asegurar ID no nulo)
      const upsertSaldoQuery = `
        INSERT INTO "Saldo" (id, punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, updated_at)
        VALUES ($1, $2, $3, $4, 0, 0, NOW())
        ON CONFLICT (punto_atencion_id, moneda_id)
        DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = NOW()
      `;

      const saldo_id = randomUUID();

      await client.query(upsertSaldoQuery, [
        saldo_id,
        punto_atencion_id,
        moneda_id,
        saldo_nuevo,
      ]);

      saldos_actualizados.push({
        moneda_id,
        saldo_anterior,
        saldo_nuevo,
        tipo_movimiento,
        monto: monto_decimal,
      });

      console.log(`✅ Movimiento procesado:`, {
        moneda_id,
        tipo_movimiento,
        monto: monto_decimal,
        saldo_anterior,
        saldo_nuevo,
      });
    }

    await client.query("COMMIT");

    console.log(`✅ Cambio procesado exitosamente: ${cambio_id}`);

    res.json({
      success: true,
      saldos_actualizados,
      message: "Movimientos contables procesados exitosamente",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al procesar movimientos contables:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  } finally {
    client.release();
  }
});

export default router;
