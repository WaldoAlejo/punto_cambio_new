import express from "express";
import type { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { randomUUID } from "crypto";
import {
  todayGyeDateOnly,
  gyeDayRangeUtcFromDateOnly,
} from "../utils/timezone.js";

const router = express.Router();

// Obtener movimientos contables (historial de movimientos de saldo) por punto
router.get(
  "/:pointId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { pointId } = req.params;
      const { limit = 50, moneda_id } = req.query;

      console.log(
        `🔍 Obteniendo movimientos contables para punto: ${pointId}`,
        {
          limit,
          moneda_id,
        }
      );

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

      const params: any[] = [pointId];

      // Date scoping: default to today's GYE day unless date/from/to provided
      const { date, from, to } = req.query as {
        date?: string;
        from?: string;
        to?: string;
      };
      let gte: Date;
      let lt: Date;
      if (from || to) {
        const fromStr = (from || (to as string)) as string;
        const toStr = (to || (from as string)) as string;
        gte = gyeDayRangeUtcFromDateOnly(fromStr).gte;
        lt = gyeDayRangeUtcFromDateOnly(toStr).lt;
      } else {
        const dateStr = (date && String(date)) || todayGyeDateOnly();
        const r = gyeDayRangeUtcFromDateOnly(dateStr);
        gte = r.gte;
        lt = r.lt;
      }
      query += ` AND ms.fecha >= $${params.length + 1} AND ms.fecha < $${
        params.length + 2
      }`;
      params.push(gte, lt);

      // Filtrar por moneda si se especifica
      if (moneda_id) {
        query += ` AND ms.moneda_id = $${params.length + 1}`;
        params.push(moneda_id as string);
      }

      query += ` ORDER BY ms.fecha DESC LIMIT $${params.length + 1}`;
      params.push(limit as string);

      const result = await pool.query(query, params);

      // Formatear los resultados para incluir los objetos anidados
      type Row = {
        id: string;
        tipo_movimiento: string;
        monto: string | number;
        saldo_anterior: string | number;
        saldo_nuevo: string | number;
        descripcion: string | null;
        fecha: string;
        moneda_id: string;
        usuario_id: string;
        punto_atencion_id: string;
        referencia_id: string | null;
        tipo_referencia: string | null;
        moneda_nombre: string;
        moneda_codigo: string;
        moneda_simbolo: string;
        usuario_nombre: string;
        punto_nombre: string;
      };

      const movimientos = (result.rows as Row[]).map((row) => ({
        id: row.id,
        tipo_movimiento: row.tipo_movimiento,
        monto:
          typeof row.monto === "number" ? row.monto : parseFloat(row.monto),
        saldo_anterior:
          typeof row.saldo_anterior === "number"
            ? row.saldo_anterior
            : parseFloat(row.saldo_anterior),
        saldo_nuevo:
          typeof row.saldo_nuevo === "number"
            ? row.saldo_nuevo
            : parseFloat(row.saldo_nuevo),
        descripcion: row.descripcion ?? undefined,
        fecha: row.fecha,
        moneda_id: row.moneda_id,
        usuario_id: row.usuario_id,
        punto_atencion_id: row.punto_atencion_id,
        referencia_id: row.referencia_id ?? undefined,
        tipo_referencia: row.tipo_referencia ?? undefined,
        moneda_codigo: row.moneda_codigo,
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
  }
);

// Validar saldo para un cambio de divisas
router.post(
  "/validar-saldo",
  authenticateToken,
  async (req: Request, res: Response) => {
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
  }
);

// Procesar movimientos contables para un cambio de divisas
router.post(
  "/procesar-cambio",
  authenticateToken,
  async (req: Request, res: Response) => {
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

      // Tipar para evitar inferencia a never[] si no hay usos previos
      const saldos_actualizados: Array<{
        moneda_id: string;
        saldo_anterior: number;
        saldo_nuevo: number;
        tipo_movimiento: string;
        monto: number;
      }> = [];

      // Obtener el cambio para conocer los detalles de billetes/monedas por cada moneda
      const cambioResult = await client.query(
        `SELECT id, moneda_origen_id, moneda_destino_id,
                COALESCE(divisas_entregadas_billetes, 0) AS divisas_entregadas_billetes,
                COALESCE(divisas_entregadas_monedas, 0) AS divisas_entregadas_monedas,
                COALESCE(divisas_recibidas_billetes, 0) AS divisas_recibidas_billetes,
                COALESCE(divisas_recibidas_monedas, 0) AS divisas_recibidas_monedas
         FROM "CambioDivisa" WHERE id = $1`,
        [cambio_id]
      );

      if (cambioResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Cambio no encontrado para procesar movimientos contables",
        });
      }

      const cambioRow = cambioResult.rows[0] as {
        moneda_origen_id: string;
        moneda_destino_id: string;
        divisas_entregadas_billetes: number;
        divisas_entregadas_monedas: number;
        divisas_recibidas_billetes: number;
        divisas_recibidas_monedas: number;
      };

      for (const movimiento of movimientos as Array<{
        punto_atencion_id: string;
        moneda_id: string;
        tipo_movimiento: string;
        monto: number | string;
        usuario_id: string;
        referencia_id?: string | null;
        tipo_referencia?: string | null;
        descripcion?: string | null;
      }>) {
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
        const monto_decimal =
          typeof monto === "number" ? monto : parseFloat(monto);
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

        // Calcular ajustes de billetes/monedas_fisicas según el tipo de movimiento y moneda
        let delta_billetes = 0;
        let delta_monedas_fisicas = 0;

        if (moneda_id === cambioRow.moneda_destino_id) {
          // Moneda que sale al cliente (EGRESO en cantidad)
          // Usamos los valores que recibe el cliente en esa moneda
          // Para compras/ventas esto representa lo que sale de caja en esa moneda
          delta_billetes = -Number(cambioRow.divisas_recibidas_billetes || 0);
          delta_monedas_fisicas = -Number(
            cambioRow.divisas_recibidas_monedas || 0
          );
        } else if (moneda_id === cambioRow.moneda_origen_id) {
          // Moneda que entra desde el cliente (INGRESO en cantidad)
          // Usamos los valores que entrega el cliente en esa moneda
          delta_billetes = Number(cambioRow.divisas_entregadas_billetes || 0);
          delta_monedas_fisicas = Number(
            cambioRow.divisas_entregadas_monedas || 0
          );
        }

        // Leer valores actuales de billetes/monedas
        const saldoDetResult = await client.query(
          `SELECT COALESCE(billetes,0) AS billetes, COALESCE(monedas_fisicas,0) AS monedas_fisicas
           FROM "Saldo" WHERE punto_atencion_id = $1 AND moneda_id = $2`,
          [punto_atencion_id, moneda_id]
        );

        const billetes_actual = saldoDetResult.rows.length
          ? Number(saldoDetResult.rows[0].billetes)
          : 0;
        const monedas_actual = saldoDetResult.rows.length
          ? Number(saldoDetResult.rows[0].monedas_fisicas)
          : 0;

        const billetes_nuevo = billetes_actual + delta_billetes;
        const monedas_nuevo = monedas_actual + delta_monedas_fisicas;

        // Validación básica: no permitir negativos en conteo monetario por tipo
        if (tipo_movimiento === "EGRESO") {
          if (billetes_nuevo < 0 || monedas_nuevo < 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              success: false,
              message:
                "Saldo físico insuficiente (billetes/monedas) para realizar el egreso",
            });
          }
        }

        // Actualizar saldo actual (asegurar ID no nulo) incluyendo billetes/monedas_fisicas
        const upsertSaldoQuery = `
        INSERT INTO "Saldo" (id, punto_atencion_id, moneda_id, cantidad, billetes, monedas_fisicas, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (punto_atencion_id, moneda_id)
        DO UPDATE SET cantidad = EXCLUDED.cantidad, billetes = EXCLUDED.billetes, monedas_fisicas = EXCLUDED.monedas_fisicas, updated_at = NOW()
      `;

        const saldo_id = randomUUID();

        await client.query(upsertSaldoQuery, [
          saldo_id,
          punto_atencion_id,
          moneda_id,
          saldo_nuevo,
          billetes_nuevo,
          monedas_nuevo,
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
  }
);

export default router;
