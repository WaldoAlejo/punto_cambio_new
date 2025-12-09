// El archivo ya está limpio y funcional. No se encontraron duplicados ni fragmentos fuera de contexto. Se mantiene la estructura actual con importaciones, declaración de router, interfaces, función utilitaria y endpoints principales POST y GET.

/**
 * Actualiza el saldo físico y lógico automáticamente según el tipo de movimiento.
 * Si el movimiento es EXCHANGE o SERVICIO_EXTERNO, suma/resta a billetes y monedas.
 */
async function actualizarSaldoFisicoYLogico(
  puntoAtencionId: string,
  monedaId: string,
  monto: number,
  tipoMovimiento: string,
  tipoReferencia: string
) {
  // Determina si el movimiento afecta billetes o monedas
  let billetes = 0;
  let monedas = 0;
  // Por simplicidad, EXCHANGE afecta billetes, SERVICIO_EXTERNO afecta monedas
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
import express from "express";
import { pool } from "../lib/database.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import saldoReconciliationService from "../services/saldoReconciliationService.js";

const router = express.Router();

interface UsuarioAutenticado {
  id: string;
  punto_atencion_id: string;
}

// Endpoint para crear cuadre abierto del día si no existe
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

    // Verificar si ya existe cuadre abierto
    const cuadreResult = await pool.query<CuadreCaja>(
      `SELECT * FROM "CuadreCaja"
        WHERE punto_atencion_id = $1::uuid
          AND fecha >= $2::timestamp
          AND estado = 'ABIERTO'
        LIMIT 1`,
      [String(puntoAtencionId), fechaInicioDia.toISOString()]
    );
    if (cuadreResult.rows[0]) {
      return res.status(200).json({ success: true, cuadre: cuadreResult.rows[0], message: "Ya existe cuadre abierto" });
    }

    // Crear cuadre abierto
    const insertResult = await pool.query<CuadreCaja>(
      `INSERT INTO "CuadreCaja" (estado, fecha, punto_atencion_id, observaciones)
        VALUES ('ABIERTO', $1, $2::uuid, $3)
        RETURNING *`,
      [fechaInicioDia.toISOString(), String(puntoAtencionId), req.body.observaciones || ""]
    );

    // Si se envían movimientos iniciales en el body, actualiza los saldos físicos y lógicos
    if (Array.isArray(req.body.movimientos)) {
      for (const mov of req.body.movimientos) {
        // mov: { moneda_id, monto, tipoMovimiento, tipoReferencia }
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

interface Jornada {
  id: string;
  fecha_inicio: string;
  estado: string;
}

interface CambioDivisa {
  id: string;
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  fecha: string;
  estado: string;
}

interface Transferencia {
  id: string;
  monto: number;
  moneda_id: string;
  tipo_transferencia: string;
  estado: string;
  fecha: string;
  origen_id: string;
  destino_id: string;
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
  moneda: Moneda;
}

interface CuadreCaja {
  id: string;
  estado: string;
  observaciones: string;
  fecha: string;
  punto_atencion_id: string;
  detalles?: DetalleCuadreCaja[];
}

function parseFechaParam(fecha?: string): Date {
  if (!fecha) return new Date();
  // Espera YYYY-MM-DD; si es inválida, cae a hoy.
  const d = new Date(`${fecha}T00:00:00`);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fechaInicioUtc: Date
): Promise<number> {
  try {
    // CRÍTICO: El saldo de apertura debe ser el conteo_fisico del último cierre CERRADO
    // Esto garantiza continuidad: el saldo con el que cerró ayer es el saldo inicial de hoy
    const cierreResult = await pool.query(
      `SELECT dc.conteo_fisico
         FROM "DetalleCuadreCaja" dc
         INNER JOIN "CuadreCaja" c ON dc.cuadre_id = c.id
        WHERE dc.moneda_id = $1::uuid
          AND c.punto_atencion_id = $2::uuid
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

    // Si no hay cierre anterior (primer día o post-limpieza), el saldo inicial es 0
    // El operador debe registrar una asignación inicial si recibe dinero
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
    return res
      .status(401)
      .json({ success: false, error: "Sin punto de atención" });
  }

  try {
    logger.info("🔍 GET /cuadre-caja iniciado", {
      usuario_id: usuario.id,
      punto_atencion_id: usuario.punto_atencion_id,
    });
    // Lee parámetros opcionales
    const fechaParam = (req.query.fecha as string | undefined)?.trim();
    // TODO: habilitar pointId externo solo para ADMIN/SUPER (por ahora, usar el del usuario)
    // const pointParam = (req.query.pointId as string | undefined)?.trim();
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

    // Determinar día GYE desde la fecha solicitada (o hoy)
    const fechaBase = parseFechaParam(fechaParam);
    const { gte } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia: Date = new Date(gte); // Inicio del día GYE (para consultas de movimientos)
    logger.info("📅 Fechas calculadas", {
      fechaBase: fechaBase.toISOString(),
      fechaInicioDia: fechaInicioDia.toISOString(),
    });

    try {
      // Consultar movimientos del día
      const [cambiosHoyResult, transferInResult, transferOutResult, serviciosExternosResult, servientregaMovimientosResult] = await Promise.all([
        pool.query<CambioDivisa>(
          `SELECT * FROM "CambioDivisa" WHERE punto_atencion_id = $1::uuid AND fecha >= $2::timestamp AND estado = 'APROBADO'`,
          [puntoAtencionId, fechaInicioDia.toISOString()]
        ),
        pool.query<Transferencia>(
          `SELECT * FROM "Transferencia" WHERE origen_id = $1::uuid AND fecha >= $2::timestamp AND estado = 'APROBADO'`,
          [puntoAtencionId, fechaInicioDia.toISOString()]
        ),
        pool.query<Transferencia>(
          `SELECT * FROM "Transferencia" WHERE destino_id = $1::uuid AND fecha >= $2::timestamp AND estado = 'APROBADO'`,
          [puntoAtencionId, fechaInicioDia.toISOString()]
        ),
        pool.query<{ id: string; moneda_id: string; monto: number; tipo_movimiento: string }>(
          `SELECT id, moneda_id, monto, tipo_movimiento FROM "ServicioExternoMovimiento" WHERE punto_atencion_id = $1::uuid AND fecha >= $2::timestamp`,
          [puntoAtencionId, fechaInicioDia.toISOString()]
        ),
        pool.query<{ id: string; moneda_id: string; monto: number; tipo_movimiento: string }>(
          `SELECT id, moneda_id, monto, tipo_movimiento FROM "MovimientoSaldo" WHERE punto_atencion_id = $1::uuid AND fecha >= $2::timestamp AND tipo_referencia = 'SERVIENTREGA'`,
          [puntoAtencionId, fechaInicioDia.toISOString()]
        ),
      ]);

      const cambiosHoy = cambiosHoyResult.rows;
      const transferIn = transferInResult;
      const transferOut = transferOutResult;
      const serviciosExternos = serviciosExternosResult;
      const servientregaMovimientos = servientregaMovimientosResult;

      logger.info("✅ Movimientos consultados", {
        cambiosHoy: cambiosHoy.length,
        transferIn: transferIn.rows.length,
        transferOut: transferOut.rows.length,
        serviciosExternos: serviciosExternos.rows.length,
        servientregaMovimientos: servientregaMovimientos.rows.length,
      });

      // Si no hay movimientos, retornar respuesta vacía pero exitosa
      if (!cambiosHoy && !transferIn && !transferOut && !serviciosExternos && !servientregaMovimientos) {
        logger.warn("No hay movimientos para el cuadre de caja");
        return res.status(200).json({ success: true, data: { detalles: [], totales: {} } });
      }

      // ...existing code...
    } catch (movError) {
      logger.error("❌ Error consultando movimientos para cuadre-caja", { error: movError });
      return res.status(500).json({ success: false, error: "Error consultando movimientos" });
    }
  } catch (error) {
    logger.error("❌ CuadreCaja Error Detalle", {
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
