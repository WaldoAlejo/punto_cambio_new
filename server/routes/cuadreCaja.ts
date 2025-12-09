import express from "express";
import { pool } from "../lib/database.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

async function actualizarSaldoFisicoYLogico(
  puntoAtencionId: string,
  monedaId: string,
  monto: number,
  _tipoMovimiento: string,
  tipoReferencia: string
) {
  let billetes = 0;
  let monedas = 0;
  if (tipoReferencia === "EXCHANGE") {
    billetes = monto;
  } else if (tipoReferencia === "SERVICIO_EXTERNO") {
    monedas = monto;
  }
  await pool.query(
    `UPDATE "Saldo"
     SET cantidad = cantidad + $1,
         billetes = billetes + $2,
         monedas_fisicas = monedas_fisicas + $3
     WHERE punto_atencion_id = $4::uuid
       AND moneda_id = $5::uuid`,
    [monto, billetes, monedas, puntoAtencionId, monedaId]
  );
}

const router = express.Router();

interface UsuarioAutenticado {
  id: string;
  punto_atencion_id: string;
}

interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  activo?: boolean;
  orden_display?: number;
}

interface DetalleCuadreCaja {
  id: string;
  moneda_id: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas_fisicas: number;
  diferencia: number;
  movimientos_periodo?: number;
  moneda?: Moneda;
}

interface CuadreCaja {
  id: string;
  estado: string;
  observaciones: string;
  fecha: string;
  punto_atencion_id: string;
}

router.post("/", authenticateToken, async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  if (!usuario?.punto_atencion_id) {
    return res.status(401).json({ success: false, error: "Sin punto de atención" });
  }

  try {
    const puntoAtencionId = usuario.punto_atencion_id;
    const fechaBase = parseFechaParam((req.body.fecha as string | undefined)?.trim());
    const { gte } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia: Date = new Date(gte);

    const cuadreResult = await pool.query<CuadreCaja>(
      `SELECT * FROM "CuadreCaja"
        WHERE punto_atencion_id = $1
          AND fecha >= $2::timestamp
          AND estado = 'ABIERTO'
        LIMIT 1`,
      [String(puntoAtencionId), fechaInicioDia.toISOString()]
    );
    if (cuadreResult.rows[0]) {
      return res.status(200).json({ success: true, cuadre: cuadreResult.rows[0], message: "Ya existe cuadre abierto" });
    }

    const insertResult = await pool.query<CuadreCaja>(
      `INSERT INTO "CuadreCaja" (estado, fecha, punto_atencion_id, observaciones)
        VALUES ('ABIERTO', $1, $2, $3)
        RETURNING *`,
      [fechaInicioDia.toISOString(), String(puntoAtencionId), req.body.observaciones || ""]
    );

    if (Array.isArray(req.body.movimientos)) {
      for (const mov of req.body.movimientos) {
        await actualizarSaldoFisicoYLogico(
          puntoAtencionId,
          mov.moneda_id,
          mov.monto,
          mov.tipoMovimiento,
          mov.tipoReferencia
        );
      }
    }

    logger.info("✅ Cuadre abierto creado", {
      usuario_id: usuario.id,
      punto_atencion_id: puntoAtencionId,
      fecha: fechaInicioDia.toISOString(),
      cuadre_id: insertResult.rows[0]?.id
    });
    return res.status(201).json({ success: true, cuadre: insertResult.rows[0], message: "Cuadre abierto creado" });
  } catch (error) {
    logger.error("❌ Error creando cuadre abierto", { error });
    return res.status(500).json({ success: false, error: "Error creando cuadre abierto" });
  }
});

function parseFechaParam(fecha?: string): Date {
  if (!fecha) return new Date();
  const d = new Date(`${fecha}T00:00:00`);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fechaInicioUtc: Date
): Promise<number> {
  try {
    const cierreResult = await pool.query(
      `SELECT dc.conteo_fisico
         FROM "DetalleCuadreCaja" dc
         INNER JOIN "CuadreCaja" c ON dc.cuadre_id = c.id
        WHERE dc.moneda_id = $1::uuid
          AND c.punto_atencion_id = $2
          AND c.estado = 'CERRADO'
          AND c.fecha < $3::timestamp
        ORDER BY c.fecha DESC, c.fecha_cierre DESC
        LIMIT 1`,
      [monedaId, puntoAtencionId, fechaInicioUtc.toISOString()]
    );

    if (cierreResult.rows[0]) {
      const apertura = Number(cierreResult.rows[0].conteo_fisico) || 0;
      logger.info("✅ Saldo de apertura obtenido del último cierre", {
        puntoAtencionId,
        monedaId,
        apertura,
      });
      return apertura;
    }

    logger.info("⚠️ No hay cierre anterior, saldo de apertura = 0", {
      puntoAtencionId,
      monedaId,
      fechaInicioUtc,
    });
    return 0;
  } catch (error) {
    logger.error("Error calculando saldo apertura", {
      error,
      puntoAtencionId,
      monedaId,
    });
    return 0;
  }
}

router.get("/", authenticateToken, async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  if (!usuario?.punto_atencion_id) {
    return res.status(401).json({ success: false, error: "Sin punto de atención" });
  }

  try {
    const fechaParam = (req.query.fecha as string | undefined)?.trim();
    const puntoAtencionId = usuario.punto_atencion_id;

    if (!puntoAtencionId) {
      logger.error("❌ usuario sin punto de atención asignado", {
        usuario_id: usuario.id,
      });
      return res.status(400).json({
        success: false,
        error: "Usuario no tiene punto de atención asignado",
      });
    }

    const fechaBase = parseFechaParam(fechaParam);
    const { gte } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia: Date = new Date(gte);
    
    logger.info("🔍 GET /cuadre-caja iniciado", {
      usuario_id: usuario.id,
      punto_atencion_id: puntoAtencionId,
      fecha: fechaInicioDia.toISOString(),
    });

    // Obtener o crear cuadre abierto del día
    const cuadreResult = await pool.query<CuadreCaja>(
      `SELECT * FROM "CuadreCaja"
        WHERE punto_atencion_id = $1
          AND fecha >= $2::timestamp
          AND estado = 'ABIERTO'
        LIMIT 1`,
      [puntoAtencionId, fechaInicioDia.toISOString()]
    );

    let cuadre = cuadreResult.rows[0];
    if (!cuadre) {
      const insertResult = await pool.query<CuadreCaja>(
        `INSERT INTO "CuadreCaja" (estado, fecha, punto_atencion_id, usuario_id, observaciones)
          VALUES ('ABIERTO', $1, $2, $3, $4)
          RETURNING *`,
        [fechaInicioDia.toISOString(), puntoAtencionId, usuario.id, ""]
      );
      cuadre = insertResult.rows[0];
      logger.info("📝 Cuadre creado", { cuadre_id: cuadre.id });
    }

    // Obtener todas las monedas activas
    const monedasResult = await pool.query<Moneda>(
      `SELECT id, codigo, nombre, simbolo, activo, orden_display
        FROM "Moneda"
        WHERE activo = true
        ORDER BY orden_display ASC`
    );
    const monedas = monedasResult.rows;
    logger.info(`📊 Monedas encontradas: ${monedas.length}`);

    // Calcular saldos para cada moneda
    const detalles: DetalleCuadreCaja[] = [];

    for (const moneda of monedas) {
      try {
        logger.info(`📦 Procesando moneda: ${moneda.codigo}`);
        
        // Obtener saldo de apertura
        const saldoApertura = await calcularSaldoApertura(
          puntoAtencionId,
          moneda.id,
          fechaInicioDia
        );

        // Por ahora, saldo de cierre = saldo de apertura (sin movimientos)
        const saldoCierre = saldoApertura;

        // Obtener o crear detalle del cuadre
        const detalleResult = await pool.query<DetalleCuadreCaja>(
          `SELECT * FROM "DetalleCuadreCaja"
            WHERE cuadre_id = $1::uuid AND moneda_id = $2::uuid`,
          [cuadre.id, moneda.id]
        );

        let detalle = detalleResult.rows[0];
        if (!detalle) {
          const insertResult = await pool.query<DetalleCuadreCaja>(
            `INSERT INTO "DetalleCuadreCaja" (
              cuadre_id, moneda_id, saldo_apertura, saldo_cierre, conteo_fisico, 
              diferencia, billetes, monedas_fisicas, movimientos_periodo
            ) VALUES ($1::uuid, $2::uuid, $3, $4, 0, 0, 0, 0, 0)
            RETURNING *`,
            [cuadre.id, moneda.id, saldoApertura, saldoCierre]
          );
          detalle = insertResult.rows[0];
          logger.info(`✅ Detalle creado para ${moneda.codigo}`);
        } else {
          await pool.query(
            `UPDATE "DetalleCuadreCaja"
              SET saldo_apertura = $1, saldo_cierre = $2
              WHERE id = $3::uuid`,
            [saldoApertura, saldoCierre, detalle.id]
          );
          detalle.saldo_apertura = saldoApertura;
          detalle.saldo_cierre = saldoCierre;
          logger.info(`✅ Detalle actualizado para ${moneda.codigo}`);
        }

        detalle.moneda = moneda;
        detalles.push(detalle);
      } catch (monedaError) {
        logger.error(`❌ Error procesando moneda ${moneda.codigo}`, {
          error: monedaError instanceof Error ? monedaError.message : String(monedaError),
        });
      }
    }

    // Mapear detalles al formato esperado por el frontend
    const detallesMapeados = detalles.map((detalle) => ({
      moneda_id: detalle.moneda_id,
      codigo: detalle.moneda?.codigo || "",
      nombre: detalle.moneda?.nombre || "",
      simbolo: detalle.moneda?.simbolo || "",
      saldo_apertura: Number(detalle.saldo_apertura) || 0,
      saldo_cierre: Number(detalle.saldo_cierre) || 0,
      conteo_fisico: Number(detalle.conteo_fisico) || 0,
      billetes: detalle.billetes || 0,
      monedas: detalle.monedas_fisicas || 0,
      ingresos_periodo: 0,
      egresos_periodo: 0,
      movimientos_periodo: 0,
    }));

    logger.info("✅ Cuadre de caja obtenido", {
      cuadre_id: cuadre.id,
      detalles_count: detallesMapeados.length,
    });

    return res.status(200).json({
      success: true,
      data: {
        cuadre_id: cuadre.id,
        periodo_inicio: fechaInicioDia.toISOString(),
        detalles: detallesMapeados,
        observaciones: cuadre.observaciones || ""
      }
    });
  } catch (error) {
    logger.error("❌ Error en GET /cuadre-caja", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      usuario_id: usuario?.id,
      punto_atencion_id: usuario?.punto_atencion_id,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      debug: process.env.LOG_LEVEL === "debug" ? String(error) : undefined,
    });
  }
});

export default router;
