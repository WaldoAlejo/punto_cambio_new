// server/routes/cuadreCaja.ts
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
  // rol?: "ADMIN" | "SUPER_USUARIO" | "OPERADOR" | string; // <- Si lo tienes, úsalo para permitir pointId externo
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
        WHERE dc.moneda_id = $1
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

    // Determinar día GYE desde la fecha solicitada (o hoy)
    const fechaBase = parseFechaParam(fechaParam);
    const { gte } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia: Date = new Date(gte); // Inicio del día GYE (para consultas de movimientos)
    logger.info("📅 Fechas calculadas", {
      fechaBase: fechaBase.toISOString(),
      fechaInicioDia: fechaInicioDia.toISOString(),
    });

    // Cuadre ABIERTO (si existiera) del día
    const cuadreResult = await pool.query<CuadreCaja>(
      `SELECT c.*,
              json_agg(
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
              ) FILTER (WHERE dc.id IS NOT NULL) AS detalles
         FROM "CuadreCaja" c
    LEFT JOIN "DetalleCuadreCaja" dc ON c.id = dc.cuadre_id
    LEFT JOIN "Moneda" m           ON dc.moneda_id = m.id
        WHERE c.punto_atencion_id = $1
          AND c.fecha >= $2::timestamp
          AND c.estado = 'ABIERTO'
     GROUP BY c.id
     LIMIT 1`,
      [puntoAtencionId, fechaInicioDia.toISOString()]
    );
    const cuadre = cuadreResult.rows[0] || null;
    logger.info("✅ Cuadre consultado", {
      tiene_cuadre_abierto: !!cuadre,
    });

    // Jornada activa (solo para información, no afecta el rango de consulta de movimientos)
    const jornadaResult = await pool.query<Jornada>(
      `SELECT *
         FROM "Jornada"
        WHERE usuario_id = $1
          AND punto_atencion_id = $2
          AND estado = 'ACTIVO'
     ORDER BY fecha_inicio DESC
        LIMIT 1`,
      [usuario.id, puntoAtencionId]
    );
    const jornadaActiva = jornadaResult.rows[0] || null;
    logger.info("✅ Jornada consultada", {
      tiene_jornada_activa: !!jornadaActiva,
    });

    // IMPORTANTE: Para el cierre diario, siempre contamos TODOS los movimientos del día,
    // independientemente de cuándo empezó la jornada del operador.
    // Esto asegura que servicios externos u otros movimientos registrados antes de que
    // el operador iniciara su jornada sean incluidos en el cierre.
    const fechaInicio: Date = fechaInicioDia;

    // Movimientos desde fechaInicio (UTC)
    const cambiosResult = await pool.query<CambioDivisa>(
      `SELECT *
         FROM "CambioDivisa"
        WHERE punto_atencion_id = $1
          AND fecha >= $2::timestamp
          AND estado = $3`,
      [puntoAtencionId, fechaInicio.toISOString(), "COMPLETADO"]
    );
    const cambiosHoy = cambiosResult.rows;
    logger.info("✅ Cambios de divisas consultados", {
      cantidad: cambiosHoy.length,
    });

    const [
      transferIn,
      transferOut,
      serviciosExternos,
      servientregaMovimientos,
    ] = await Promise.all([
      pool.query<Transferencia>(
        `SELECT *
           FROM "Transferencia"
          WHERE destino_id = $1
            AND fecha >= $2::timestamp
            AND estado = 'APROBADO'`,
        [puntoAtencionId, fechaInicio.toISOString()]
      ),
      pool.query<Transferencia>(
        `SELECT *
           FROM "Transferencia"
          WHERE origen_id = $1
            AND fecha >= $2::timestamp
            AND estado = 'APROBADO'`,
        [puntoAtencionId, fechaInicio.toISOString()]
      ),
      pool.query<{
        id: string;
        moneda_id: string;
        monto: number;
        tipo_movimiento: string;
      }>(
        `SELECT id, moneda_id, monto, tipo_movimiento
           FROM "ServicioExternoMovimiento"
          WHERE punto_atencion_id = $1
            AND fecha >= $2::timestamp`,
        [puntoAtencionId, fechaInicio.toISOString()]
      ),
      pool.query<{
        id: string;
        moneda_id: string;
        monto: number;
        tipo_movimiento: string;
      }>(
        `SELECT id, moneda_id, monto, tipo_movimiento
           FROM "MovimientoSaldo"
          WHERE punto_atencion_id = $1
            AND fecha >= $2::timestamp
            AND tipo_referencia = 'SERVIENTREGA'`,
        [puntoAtencionId, fechaInicio.toISOString()]
      ),
    ]);
    logger.info("✅ Movimientos consultados", {
      transferencias_entrada: transferIn.rowCount,
      transferencias_salida: transferOut.rowCount,
      servicios_externos: serviciosExternos.rowCount,
      servientrega_movimientos: servientregaMovimientos.rowCount,
    });

    // Obtener ID de la moneda USD (dólar) para Servientrega
    const monedaUsdResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Moneda" WHERE codigo = 'USD' LIMIT 1`
    );
    const monedaUsdId = monedaUsdResult.rows[0]?.id;
    logger.info("✅ Moneda USD identificada", { monedaUsdId });

    // IDs de monedas usadas en movimientos (cambios, transferencias y servicios externos)
    const monedaIdsDeCambios = new Set<string>(
      cambiosHoy
        .flatMap((c) => [c.moneda_origen_id, c.moneda_destino_id])
        .filter(Boolean) as string[]
    );
    const monedaIdsDeTransfers = new Set<string>(
      [
        ...transferIn.rows.map((t) => t.moneda_id),
        ...transferOut.rows.map((t) => t.moneda_id),
      ].filter(Boolean) as string[]
    );
    const monedaIdsDeServiciosExternos = new Set<string>(
      serviciosExternos.rows.map((s) => s.moneda_id).filter(Boolean) as string[]
    );
    // Servientrega siempre usa USD
    const monedaIdsDeServientrega = new Set<string>(
      monedaUsdId ? [monedaUsdId] : []
    );

    // IDs de monedas con saldo (pueden no haber tenido movimientos hoy)
    const saldosResult = await pool.query<{ moneda_id: string }>(
      `SELECT DISTINCT moneda_id
         FROM "Saldo"
        WHERE punto_atencion_id = $1
          AND COALESCE(cantidad, 0) <> 0`,
      [puntoAtencionId]
    );
    const monedaIdsDeSaldos = new Set<string>(
      saldosResult.rows.map((r) => r.moneda_id)
    );

    // Solo monedas que tuvieron movimientos durante el día
    // Unir sets → universo de monedas a mostrar (solo las que tuvieron actividad)
    const universoIds = new Set<string>([
      ...Array.from(monedaIdsDeCambios),
      ...Array.from(monedaIdsDeTransfers),
      ...Array.from(monedaIdsDeServiciosExternos),
      ...Array.from(monedaIdsDeServientrega),
    ]);

    // Obtener información de las monedas que tuvieron movimientos
    const conocidaPorId = new Map<string, Moneda>();

    if (universoIds.size > 0) {
      const monedasResult = await pool.query<Moneda>(
        `SELECT id, codigo, nombre, simbolo, activo, orden_display
           FROM "Moneda"
          WHERE id = ANY($1::uuid[])
       ORDER BY orden_display NULLS LAST, nombre ASC`,
        [Array.from(universoIds)]
      );
      monedasResult.rows.forEach((m) => conocidaPorId.set(m.id, m));
    }

    const monedas: Moneda[] = Array.from(universoIds)
      .map((id) => conocidaPorId.get(id)!)
      .filter(Boolean);

    // Si no hay ninguna moneda, responder vacío pero con metadatos útiles
    if (monedas.length === 0) {
      logger.info("✅ No hay monedas con movimientos, retornando cuadre vacío");
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
            cambios: { cantidad: cambiosHoy.length, ingresos: 0, egresos: 0 },
            servicios_externos: {
              cantidad: serviciosExternos.rowCount || 0,
              ingresos: 0,
              egresos: 0,
            },
            transferencias_entrada: { cantidad: transferIn.rowCount, monto: 0 },
            transferencias_salida: { cantidad: transferOut.rowCount, monto: 0 },
          },
        },
      });
    }
    
    logger.info("📊 Procesando monedas", { cantidad_monedas: monedas.length, monedas_codigos: monedas.map(m => m.codigo).join(",") });

    // Pre-índices para sumar rápido
    const cambiosByMoneda = new Map<
      string,
      { ingresos: number; egresos: number; cantidad: number }
    >();
    const addCambios = (
      monedaId: string,
      tipo: "ingresos" | "egresos",
      monto: number
    ) => {
      const curr = cambiosByMoneda.get(monedaId) || {
        ingresos: 0,
        egresos: 0,
        cantidad: 0,
      };
      curr[tipo] += monto;
      curr.cantidad += 1;
      cambiosByMoneda.set(monedaId, curr);
    };
    for (const c of cambiosHoy) {
      if (c.moneda_destino_id)
        addCambios(
          c.moneda_destino_id,
          "ingresos",
          Number(c.monto_destino) || 0
        );
      if (c.moneda_origen_id)
        addCambios(c.moneda_origen_id, "egresos", Number(c.monto_origen) || 0);
    }

    const transfInByMoneda = new Map<
      string,
      { monto: number; cantidad: number }
    >();
    for (const t of transferIn.rows) {
      const m = transfInByMoneda.get(t.moneda_id) || { monto: 0, cantidad: 0 };
      m.monto += Number(t.monto) || 0;
      m.cantidad += 1;
      transfInByMoneda.set(t.moneda_id, m);
    }

    const transfOutByMoneda = new Map<
      string,
      { monto: number; cantidad: number }
    >();
    for (const t of transferOut.rows) {
      const m = transfOutByMoneda.get(t.moneda_id) || { monto: 0, cantidad: 0 };
      m.monto += Number(t.monto) || 0;
      m.cantidad += 1;
      transfOutByMoneda.set(t.moneda_id, m);
    }

    // Servicios externos por moneda (ingresos y egresos)
    const serviciosExternosByMoneda = new Map<
      string,
      { ingresos: number; egresos: number; cantidad: number }
    >();
    for (const s of serviciosExternos.rows) {
      const curr = serviciosExternosByMoneda.get(s.moneda_id) || {
        ingresos: 0,
        egresos: 0,
        cantidad: 0,
      };
      if (s.tipo_movimiento === "INGRESO") {
        curr.ingresos += Number(s.monto) || 0;
      } else {
        curr.egresos += Number(s.monto) || 0;
      }
      curr.cantidad += 1;
      serviciosExternosByMoneda.set(s.moneda_id, curr);
    }

    // Servientrega: obtener ingresos y egresos desde MovimientoSaldo
    const servientregaByMoneda = new Map<
      string,
      { ingresos: number; egresos: number; cantidad: number }
    >();
    for (const s of servientregaMovimientos.rows) {
      const curr = servientregaByMoneda.get(s.moneda_id) || {
        ingresos: 0,
        egresos: 0,
        cantidad: 0,
      };
      const monto = Number(s.monto) || 0;
      if (monto > 0) {
        curr.ingresos += monto;
      } else if (monto < 0) {
        curr.egresos += Math.abs(monto);
      }
      curr.cantidad += 1;
      servientregaByMoneda.set(s.moneda_id, curr);
    }

    // Construir detalles por moneda
    logger.info("🔄 Iniciando construcción de detalles");
    const detallesConValores = await Promise.all(
      monedas.map(async (moneda) => {
        logger.info(`🔍 Procesando moneda: ${moneda.codigo}`);
        try {
          const saldoApertura = await calcularSaldoApertura(
            puntoAtencionId,
            moneda.id,
            fechaInicio
          );

          const c = cambiosByMoneda.get(moneda.id) || {
            ingresos: 0,
            egresos: 0,
            cantidad: 0,
          };
          const tIn = transfInByMoneda.get(moneda.id) || {
            monto: 0,
            cantidad: 0,
          };
          const tOut = transfOutByMoneda.get(moneda.id) || {
            monto: 0,
            cantidad: 0,
          };
          const sExt = serviciosExternosByMoneda.get(moneda.id) || {
            ingresos: 0,
            egresos: 0,
            cantidad: 0,
          };
          const servientrega = servientregaByMoneda.get(moneda.id) || {
            ingresos: 0,
            egresos: 0,
            cantidad: 0,
          };

          // Calcular el saldo real basado en todos los movimientos registrados
          // Esto incluye cambios, transferencias Y servicios externos automáticamente
          let saldo_cierre_teorico = 0;
          try {
            saldo_cierre_teorico =
              await saldoReconciliationService.calcularSaldoReal(
                puntoAtencionId,
                moneda.id
              );
          } catch (calcError) {
            logger.error("⚠️ Error calculando saldo real para moneda", {
              moneda_id: moneda.id,
              moneda_codigo: moneda.codigo,
              error: calcError instanceof Error ? calcError.message : String(calcError),
            });
            // Fallback: calcular manualmente como saldo_apertura + ingresos - egresos
            saldo_cierre_teorico = saldoApertura + 
              (c.ingresos || 0) + 
              (sExt.ingresos || 0) + 
              (servientrega.ingresos || 0) - 
              (c.egresos || 0) - 
              (sExt.egresos || 0) - 
              (servientrega.egresos || 0);
          }

          // Para el desglose, mostrar cambios, servicios externos y servientrega como ingresos/egresos del período
          // Las transferencias se muestran por separado en el desglose pero no se suman al cálculo
          // ⚠️ IMPORTANTE: Incluir servicios externos y servientrega en ingresos/egresos para que coincida con saldo_cierre_teorico
          const ingresos_periodo = 
            (c.ingresos || 0) + 
            (sExt.ingresos || 0) + 
            (servientrega.ingresos || 0);
          const egresos_periodo = 
            (c.egresos || 0) + 
            (sExt.egresos || 0) + 
            (servientrega.egresos || 0);

          return {
            moneda_id: moneda.id,
            codigo: moneda.codigo,
            nombre: moneda.nombre,
            simbolo: moneda.simbolo,
            saldo_apertura: saldoApertura,
            saldo_cierre: saldo_cierre_teorico,
            ingresos_periodo,
            egresos_periodo,
            desglose: {
              cambios: {
                ingresos: c.ingresos || 0,
                egresos: c.egresos || 0,
                cantidad: c.cantidad || 0,
              },
              servicios_externos: {
                ingresos: sExt.ingresos || 0,
                egresos: sExt.egresos || 0,
                cantidad: sExt.cantidad || 0,
              },
              servientrega: {
                ingresos: servientrega.ingresos || 0,
                egresos: servientrega.egresos || 0,
                cantidad: servientrega.cantidad || 0,
              },
              transferencias: {
                entrada: tIn.monto || 0,
                salida: tOut.monto || 0,
                cantidad_entrada: tIn.cantidad || 0,
                cantidad_salida: tOut.cantidad || 0,
              },
            },
          };
        } catch (monedaError) {
          logger.error("❌ Error procesando moneda en cuadre", {
            moneda_id: moneda.id,
            moneda_codigo: moneda.codigo,
            error: monedaError instanceof Error ? monedaError.message : String(monedaError),
          });
          throw monedaError;
        }
      })
    );
    logger.info("✅ Detalles construidos correctamente", {
      cantidad_detalles: detallesConValores.length,
    });

    // Totales globales
    const totalCambiosIngresos = cambiosHoy.reduce(
      (s, c) => s + (Number(c.monto_destino) || 0),
      0
    );
    const totalCambiosEgresos = cambiosHoy.reduce(
      (s, c) => s + (Number(c.monto_origen) || 0),
      0
    );
    const totalTransfIn = transferIn.rows.reduce(
      (s, t) => s + (Number(t.monto) || 0),
      0
    );
    const totalTransfOut = transferOut.rows.reduce(
      (s, t) => s + (Number(t.monto) || 0),
      0
    );
    const totalServiciosExtIngresos = serviciosExternos.rows
      .filter((s) => s.tipo_movimiento === "INGRESO")
      .reduce((s, se) => s + (Number(se.monto) || 0), 0);
    const totalServiciosExtEgresos = serviciosExternos.rows
      .filter((s) => s.tipo_movimiento === "EGRESO")
      .reduce((s, se) => s + (Number(se.monto) || 0), 0);

    // Totales de Servientrega
    const servientregaData = monedaUsdId
      ? servientregaByMoneda.get(monedaUsdId)
      : null;
    const totalServientregaIngresos = servientregaData?.ingresos || 0;
    const totalServientregaEgresos = servientregaData?.egresos || 0;
    const totalServientregaCantidad = servientregaData?.cantidad || 0;

    logger.info("✅ GET /cuadre-caja completado exitosamente", {
      detalles: detallesConValores.length,
      cambios: cambiosHoy.length,
    });

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
          cambios: {
            cantidad: cambiosHoy.length,
            ingresos: totalCambiosIngresos,
            egresos: totalCambiosEgresos,
          },
          servicios_externos: {
            cantidad: serviciosExternos.rowCount,
            ingresos: totalServiciosExtIngresos,
            egresos: totalServiciosExtEgresos,
          },
          servientrega: {
            cantidad: totalServientregaCantidad,
            ingresos: totalServientregaIngresos,
            egresos: totalServientregaEgresos,
          },
          transferencias_entrada: {
            cantidad: transferIn.rowCount,
            monto: totalTransfIn,
          },
          transferencias_salida: {
            cantidad: transferOut.rowCount,
            monto: totalTransfOut,
          },
        },
      },
    });
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
