import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// Util: obtener ID de moneda USD asegurando que todas las transacciones sean en USD
async function getUsdMonedaId(client: any): Promise<string> {
  const r = await client.query(
    'SELECT id FROM "Moneda" WHERE codigo = $1 LIMIT 1',
    ["USD"]
  );
  if (r.rows.length === 0) {
    throw new Error("No existe la moneda USD en la base de datos (codigo=USD)");
  }
  return r.rows[0].id as string;
}

// Crear un movimiento de servicio externo (una transacción a la vez)
// Body: { punto_atencion_id, servicio, tipo_movimiento, monto, descripcion?, numero_referencia?, comprobante_url? }
router.post("/movimientos", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id;
    const {
      punto_atencion_id,
      servicio,
      tipo_movimiento, // 'INGRESO' | 'EGRESO'
      monto,
      descripcion,
      numero_referencia,
      comprobante_url,
    } = req.body || {};

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Usuario no autenticado" });
    }

    if (
      !punto_atencion_id ||
      !servicio ||
      !tipo_movimiento ||
      monto === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Faltan parámetros requeridos: punto_atencion_id, servicio, tipo_movimiento, monto",
      });
    }

    if (!["INGRESO", "EGRESO"].includes(String(tipo_movimiento))) {
      return res
        .status(400)
        .json({ success: false, message: "tipo_movimiento inválido" });
    }

    const montoNum = parseFloat(monto);
    if (!isFinite(montoNum) || montoNum <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "monto debe ser un número > 0" });
    }

    await client.query("BEGIN");

    // Obtener USD
    const usdId = await getUsdMonedaId(client);

    // Saldo actual
    const saldoQ = await client.query(
      'SELECT cantidad FROM "Saldo" WHERE punto_atencion_id = $1 AND moneda_id = $2 FOR UPDATE',
      [punto_atencion_id, usdId]
    );
    const saldoAnterior = saldoQ.rows.length
      ? parseFloat(saldoQ.rows[0].cantidad)
      : 0;

    // Calcular nuevo saldo
    const saldoNuevo =
      String(tipo_movimiento) === "INGRESO"
        ? saldoAnterior + montoNum
        : saldoAnterior - montoNum;

    if (String(tipo_movimiento) === "EGRESO" && saldoNuevo < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Saldo insuficiente. Disponible: ${saldoAnterior}, Requerido: ${montoNum}`,
      });
    }

    // Insert ServicioExternoMovimiento
    const insertExt = `
      INSERT INTO "ServicioExternoMovimiento"
      (punto_atencion_id, servicio, tipo_movimiento, moneda_id, monto, usuario_id, fecha, descripcion, numero_referencia, comprobante_url)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
      RETURNING id
    `;
    const extResult = await client.query(insertExt, [
      punto_atencion_id,
      servicio,
      tipo_movimiento,
      usdId,
      montoNum,
      userId,
      descripcion || null,
      numero_referencia || null,
      comprobante_url || null,
    ]);
    const servicioMovimientoId = extResult.rows[0].id as string;

    // Insert MovimientoSaldo (asiento contable)
    const insertMs = `
      INSERT INTO "MovimientoSaldo"
      (punto_atencion_id, moneda_id, tipo_movimiento, monto, saldo_anterior, saldo_nuevo, usuario_id, referencia_id, tipo_referencia, descripcion, fecha, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SERVICIO_EXTERNO', $9, NOW(), NOW())
      RETURNING id
    `;
    await client.query(insertMs, [
      punto_atencion_id,
      usdId,
      tipo_movimiento,
      montoNum,
      saldoAnterior,
      saldoNuevo,
      userId,
      servicioMovimientoId,
      `ServicioExterno: ${servicio}` + (descripcion ? ` - ${descripcion}` : ""),
    ]);

    // Upsert Saldo
    const upsertSaldo = `
      INSERT INTO "Saldo" (punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas)
      VALUES ($1, $2, $3, 0, 0)
      ON CONFLICT (punto_atencion_id, moneda_id)
      DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = NOW()
      RETURNING cantidad
    `;
    const saldoRes = await client.query(upsertSaldo, [
      punto_atencion_id,
      usdId,
      saldoNuevo,
    ]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      movimiento_id: servicioMovimientoId,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: parseFloat(saldoRes.rows[0].cantidad),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creando movimiento de servicio externo:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  } finally {
    client.release();
  }
});

// Listar movimientos de servicios externos por punto con filtros opcionales
// Query: servicio?, desde?, hasta?, limit?
router.get("/movimientos/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    const {
      servicio,
      desde,
      hasta,
      limit = 50,
    } = req.query as Record<string, string>;

    const params: any[] = [pointId];
    let query = `
      SELECT sem.*, m.nombre as moneda_nombre, m.codigo as moneda_codigo, u.nombre as usuario_nombre
      FROM "ServicioExternoMovimiento" sem
      JOIN "Moneda" m ON sem.moneda_id = m.id
      JOIN "Usuario" u ON sem.usuario_id = u.id
      WHERE sem.punto_atencion_id = $1
    `;

    if (servicio) {
      params.push(servicio);
      query += ` AND sem.servicio = $${params.length}`;
    }
    if (desde) {
      params.push(desde);
      query += ` AND sem.fecha >= $${params.length}`;
    }
    if (hasta) {
      params.push(hasta);
      query += ` AND sem.fecha <= $${params.length}`;
    }

    params.push(Number(limit));
    query += ` ORDER BY sem.fecha DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    const movimientos = result.rows.map((row) => ({
      id: row.id,
      punto_atencion_id: row.punto_atencion_id,
      servicio: row.servicio,
      tipo_movimiento: row.tipo_movimiento,
      moneda_id: row.moneda_id,
      monto: parseFloat(row.monto),
      usuario_id: row.usuario_id,
      fecha: row.fecha,
      descripcion: row.descripcion,
      numero_referencia: row.numero_referencia,
      comprobante_url: row.comprobante_url,
      moneda: {
        id: row.moneda_id,
        nombre: row.moneda_nombre,
        codigo: row.moneda_codigo,
      },
      usuario: { id: row.usuario_id, nombre: row.usuario_nombre },
    }));

    return res.json({ success: true, movimientos });
  } catch (error) {
    console.error("Error listando movimientos de servicios externos:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
