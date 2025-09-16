// server/routes/cuadreCaja.ts
import express from "express";
import { pool } from "../lib/database.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

interface UsuarioAutenticado {
  id: string;
  punto_atencion_id: string;
}

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
}

interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
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
  detalles?: DetalleCuadreCaja[];
}

async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fecha: Date
): Promise<number> {
  try {
    const cierreResult = await pool.query(
      `SELECT dc.conteo_fisico FROM "DetalleCuadreCaja" dc
       INNER JOIN "CuadreCaja" c ON dc.cuadre_id = c.id
       WHERE dc.moneda_id = $1 AND c.punto_atencion_id = $2 
       AND c.estado IN ('CERRADO', 'PARCIAL') AND c.fecha < $3
       ORDER BY c.fecha DESC LIMIT 1`,
      [monedaId, puntoAtencionId, fecha.toISOString()]
    );
    if (cierreResult.rows[0]) return Number(cierreResult.rows[0].conteo_fisico);

    const saldoResult = await pool.query(
      `SELECT cantidad FROM "Saldo" WHERE punto_atencion_id = $1 AND moneda_id = $2`,
      [puntoAtencionId, monedaId]
    );
    return saldoResult.rows[0] ? Number(saldoResult.rows[0].cantidad) : 0;
  } catch (error) {
    logger.error("Error calculando saldo apertura", { error });
    return 0;
  }
}

router.get("/", authenticateToken, async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  if (!usuario?.punto_atencion_id)
    return res
      .status(401)
      .json({ success: false, error: "Sin punto de atención" });

  const { gte: hoy } = gyeDayRangeUtcFromDate(new Date());
  let fechaInicio: Date = new Date(hoy);

  try {
    const cuadreResult = await pool.query<CuadreCaja>(
      `SELECT c.*, json_agg(
         json_build_object(
           'id', dc.id,
           'moneda_id', dc.moneda_id,
           'saldo_apertura', dc.saldo_apertura,
           'saldo_cierre', dc.saldo_cierre,
           'conteo_fisico', dc.conteo_fisico,
           'billetes', dc.billetes,
           'monedas_fisicas', dc.monedas_fisicas,
           'diferencia', dc.diferencia,
           'moneda', json_build_object(
             'id', m.id,
             'codigo', m.codigo,
             'nombre', m.nombre,
             'simbolo', m.simbolo
           )
         )
       ) FILTER (WHERE dc.id IS NOT NULL) as detalles
       FROM "CuadreCaja" c
       LEFT JOIN "DetalleCuadreCaja" dc ON c.id = dc.cuadre_id
       LEFT JOIN "Moneda" m ON dc.moneda_id = m.id
       WHERE c.punto_atencion_id = $1 AND c.fecha >= $2 AND c.estado = 'ABIERTO'
       GROUP BY c.id
       LIMIT 1`,
      [usuario.punto_atencion_id, hoy.toISOString()]
    );
    const cuadre = cuadreResult.rows[0] || null;

    const jornadaResult = await pool.query<Jornada>(
      `SELECT * FROM "Jornada" WHERE usuario_id = $1 AND punto_atencion_id = $2 AND estado = 'ACTIVO'
       ORDER BY fecha_inicio DESC LIMIT 1`,
      [usuario.id, usuario.punto_atencion_id]
    );
    const jornadaActiva = jornadaResult.rows[0] || null;

    fechaInicio = jornadaActiva?.fecha_inicio
      ? new Date(jornadaActiva.fecha_inicio)
      : new Date(gyeDayRangeUtcFromDate(new Date()).gte);

    const cambiosResult = await pool.query<CambioDivisa>(
      `SELECT * FROM "CambioDivisa" WHERE punto_atencion_id = $1 AND fecha >= $2 AND estado = $3`,
      [usuario.punto_atencion_id, fechaInicio.toISOString(), "COMPLETADO"]
    );
    const cambiosHoy = cambiosResult.rows;

    const [transferIn, transferOut] = await Promise.all([
      pool.query<Transferencia>(
        `SELECT * FROM "Transferencia" WHERE destino_id = $1 AND fecha >= $2 AND estado = $3`,
        [usuario.punto_atencion_id, fechaInicio.toISOString(), "APROBADO"]
      ),
      pool.query<Transferencia>(
        `SELECT * FROM "Transferencia" WHERE origen_id = $1 AND fecha >= $2 AND estado = $3`,
        [usuario.punto_atencion_id, fechaInicio.toISOString(), "APROBADO"]
      ),
    ]);

    const monedasUsadas = Array.from(
      new Set(
        cambiosHoy
          .flatMap((c) => [c.moneda_origen_id, c.moneda_destino_id])
          .filter(Boolean)
      )
    );

    const monedas: Moneda[] = [];
    if (monedasUsadas.length > 0) {
      const monedasResult = await pool.query<Moneda>(
        `SELECT * FROM "Moneda" WHERE id = ANY($1::uuid[]) AND activo = true ORDER BY orden_display`,
        [monedasUsadas]
      );
      monedas.push(...monedasResult.rows);
    }

    if (monedas.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          detalles: [],
          observaciones:
            cuadre?.observaciones ||
            (jornadaActiva ? "" : "Cierre sin jornada activa"),
          cuadre_id: cuadre?.id,
          periodo_inicio: fechaInicio,
          totales: {
            cambios: cambiosHoy.length,
            transferencias_entrada: transferIn.rowCount,
            transferencias_salida: transferOut.rowCount,
          },
        },
      });
    }

    const detallesConValores = await Promise.all(
      monedas.map(async (moneda) => {
        const saldoApertura = await calcularSaldoApertura(
          usuario.punto_atencion_id,
          moneda.id,
          fechaInicio
        );
        const ingresos = cambiosHoy
          .filter((c) => c.moneda_destino_id === moneda.id)
          .reduce((s, c) => s + Number(c.monto_destino), 0);
        const egresos = cambiosHoy
          .filter((c) => c.moneda_origen_id === moneda.id)
          .reduce((s, c) => s + Number(c.monto_origen), 0);
        const saldoCierre = saldoApertura + ingresos - egresos;
        return {
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          saldo_apertura: saldoApertura,
          saldo_cierre: saldoCierre,
          ingresos_periodo: ingresos,
          egresos_periodo: egresos,
          movimientos_periodo: cambiosHoy.filter(
            (c) =>
              c.moneda_origen_id === moneda.id ||
              c.moneda_destino_id === moneda.id
          ).length,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        detalles: detallesConValores,
        observaciones:
          cuadre?.observaciones ||
          (jornadaActiva ? "" : "Cierre sin jornada activa"),
        cuadre_id: cuadre?.id,
        periodo_inicio: fechaInicio,
        totales: {
          cambios: cambiosHoy.length,
          transferencias_entrada: transferIn.rowCount,
          transferencias_salida: transferOut.rowCount,
        },
      },
    });
  } catch (error) {
    logger.error("❌ CuadreCaja Error Detalle", {
      error,
      usuario,
      fechaInicio,
    });
    res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
});

export default router;
