import express from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { pool } from "../lib/database.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";

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
  bancos_teorico?: number;
  conteo_bancos?: number;
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
  usuario_cierre_parcial?: string;
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

    // 1. Buscar cuadre ABIERTO existente
    const cuadreAbiertoResult = await pool.query<CuadreCaja>(
      `SELECT * FROM "CuadreCaja"
        WHERE punto_atencion_id = $1
          AND fecha >= $2::timestamp
          AND estado = 'ABIERTO'
        LIMIT 1`,
      [String(puntoAtencionId), fechaInicioDia.toISOString()]
    );
    
    if (cuadreAbiertoResult.rows[0]) {
      return res.status(200).json({ success: true, cuadre: cuadreAbiertoResult.rows[0], message: "Ya existe cuadre abierto" });
    }

    // 2. Buscar cuadre PARCIAL (cambio de turno) y reactivarlo a ABIERTO
    const cuadreParcialResult = await pool.query<CuadreCaja>(
      `SELECT * FROM "CuadreCaja"
        WHERE punto_atencion_id = $1
          AND fecha >= $2::timestamp
          AND estado = 'PARCIAL'
        ORDER BY fecha_cierre DESC
        LIMIT 1`,
      [String(puntoAtencionId), fechaInicioDia.toISOString()]
    );

    if (cuadreParcialResult.rows[0]) {
      // Reactivar el cuadre PARCIAL a ABIERTO para el nuevo operador
      const updateResult = await pool.query<CuadreCaja>(
        `UPDATE "CuadreCaja" 
         SET estado = 'ABIERTO', 
             usuario_id = $1,
             observaciones = COALESCE(observaciones, '') || ' | Reactivado por cambio de turno'
         WHERE id = $2
         RETURNING *`,
        [usuario.id, cuadreParcialResult.rows[0].id]
      );

      logger.info("✅ Cuadre PARCIAL reactivado a ABIERTO (cambio de turno)", {
        usuario_id: usuario.id,
        punto_atencion_id: puntoAtencionId,
        cuadre_id: updateResult.rows[0]?.id,
        cuadre_anterior_id: cuadreParcialResult.rows[0].usuario_cierre_parcial
      });

      return res.status(200).json({ 
        success: true, 
        cuadre: updateResult.rows[0], 
        message: "Cuadre reactivado desde cierre parcial" 
      });
    }

    // 3. Crear nuevo cuadre si no existe ni ABIERTO ni PARCIAL
    const cuadreId = randomUUID();
    const insertResult = await pool.query<CuadreCaja>(
      `INSERT INTO "CuadreCaja" (id, estado, fecha, punto_atencion_id, usuario_id, observaciones)
        VALUES ($1, 'ABIERTO', $2, $3, $4, $5)
        RETURNING *`,
      [cuadreId, fechaInicioDia.toISOString(), String(puntoAtencionId), usuario.id, req.body.observaciones || ""]
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
    const { gte, lt } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia: Date = new Date(gte);
    const fechaFinDia: Date = new Date(lt);
    
    logger.info("🔍 GET /cuadre-caja iniciado", {
      usuario_id: usuario.id,
      punto_atencion_id: puntoAtencionId,
      fecha: fechaInicioDia.toISOString(),
    });

    // Short-circuit: si no hay movimientos del día, devolver respuesta vacía
    const movimientosDelDia = await prisma.movimientoSaldo.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: fechaInicioDia, lt: fechaFinDia },
      },
    });

    if (movimientosDelDia === 0) {
      logger.info("ℹ️ Sin movimientos del día; devolviendo cuadre vacío", {
        punto_atencion_id: puntoAtencionId,
        fecha: fechaInicioDia.toISOString(),
      });
      return res.status(200).json({
        success: true,
        data: {
          detalles: [],
          observaciones: "",
          periodo_inicio: fechaInicioDia.toISOString(),
          totales: {
            cambios: 0,
            transferencias_entrada: 0,
            transferencias_salida: 0,
          },
          mensaje: "No hay movimientos de divisas hoy",
        },
      });
    }

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
      // Si no hay ABIERTO, verificar si ya existe uno CERRADO para el mismo día
      const cerradoRes = await pool.query<CuadreCaja>(
        `SELECT * FROM "CuadreCaja"
          WHERE punto_atencion_id = $1
            AND fecha >= $2::timestamp
            AND estado = 'CERRADO'
          ORDER BY fecha_cierre DESC
          LIMIT 1`,
        [puntoAtencionId, fechaInicioDia.toISOString()]
      );

      if (cerradoRes.rows[0]) {
        cuadre = cerradoRes.rows[0];
        logger.info("ℹ️ Usando cuadre CERRADO existente para el día", {
          cuadre_id: cuadre.id,
        });
      } else {
        const cuadreId = randomUUID();
        const insertResult = await pool.query<CuadreCaja>(
          `INSERT INTO "CuadreCaja" (id, estado, fecha, punto_atencion_id, usuario_id, observaciones)
            VALUES ($1, 'ABIERTO', $2, $3, $4, $5)
            RETURNING *`,
          [cuadreId, fechaInicioDia.toISOString(), puntoAtencionId, usuario.id, ""]
        );
        cuadre = insertResult.rows[0];
        logger.info("📝 Cuadre creado", { cuadre_id: cuadre.id });
      }
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

    // Calcular saldos para cada moneda (incluyendo TODAS las monedas activas)
    const detalles: DetalleCuadreCaja[] = [];

    for (const moneda of monedas) {
      try {
        logger.info(`📦 Procesando moneda: ${moneda.codigo}`);
        
        // Obtener saldo de apertura (último conteo físico del cierre anterior)
        const saldoApertura = await calcularSaldoApertura(
          puntoAtencionId,
          moneda.id,
          fechaInicioDia
        );

        // Calcular saldo teórico (cierre) usando reconciliación de movimientos
        let saldoCierreTeórico = 0;
        try {
          saldoCierreTeórico = await saldoReconciliationService.calcularSaldoReal(
            puntoAtencionId,
            moneda.id
          );
        } catch (saldoError) {
          logger.error(`❌ Error calculando saldo real para ${moneda.codigo}, usando saldo de apertura`, {
            error: saldoError instanceof Error ? saldoError.message : String(saldoError),
            moneda: moneda.codigo,
            puntoAtencionId,
          });
          // Si falla el cálculo, usar el saldo de apertura como fallback
          saldoCierreTeórico = saldoApertura;
        }

        // Obtener saldo físico actual de la tabla Saldo
        const saldoFísico = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoAtencionId,
              moneda_id: moneda.id,
            },
          },
          select: {
            cantidad: true,
            billetes: true,
            monedas_fisicas: true,
            bancos: true,
          },
        });

        const conteoFísico = saldoFísico ? Number(saldoFísico.cantidad) : saldoCierreTeórico;
        const billetes = saldoFísico ? Number(saldoFísico.billetes) : 0;
        const monedasFísicas = saldoFísico ? Number(saldoFísico.monedas_fisicas) : 0;
        const bancosTeorico = saldoFísico ? Number(saldoFísico.bancos) : 0;
        const conteoBancos = bancosTeorico;

        // Calcular movimientos del período (ingresos y egresos)
        const movimientosPeriodo = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: moneda.id,
            fecha: {
              gte: new Date(fechaInicioDia),
              lt: new Date(fechaInicioDia.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        let ingresos = 0;
        let egresos = 0;

        for (const mov of movimientosPeriodo) {
          const monto = Number(mov.monto);
          if (monto > 0) {
            ingresos += monto;
          } else {
            egresos += Math.abs(monto);
          }
        }

        // Obtener o crear detalle del cuadre
        const detalleResult = await pool.query<DetalleCuadreCaja>(
          `SELECT * FROM "DetalleCuadreCaja"
            WHERE cuadre_id = $1::uuid AND moneda_id = $2::uuid`,
          [cuadre.id, moneda.id]
        );

        let detalle = detalleResult.rows[0];
        const diferencia = Number((conteoFísico - saldoCierreTeórico).toFixed(2));

        if (!detalle) {
          const detalleId = randomUUID();
          const insertResult = await pool.query<DetalleCuadreCaja>(
            `INSERT INTO "DetalleCuadreCaja" (
              id, cuadre_id, moneda_id, saldo_apertura, saldo_cierre, conteo_fisico, 
              diferencia, billetes, monedas_fisicas, movimientos_periodo
            ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [detalleId, cuadre.id, moneda.id, saldoApertura, saldoCierreTeórico, conteoFísico, diferencia, billetes, monedasFísicas, movimientosPeriodo.length]
          );
          detalle = insertResult.rows[0];
          logger.info(`✅ Detalle creado para ${moneda.codigo}`, {
            saldo_apertura: saldoApertura,
            saldo_cierre_teorico: saldoCierreTeórico,
            conteo_fisico: conteoFísico,
            ingresos,
            egresos,
          });
        } else {
          await pool.query(
            `UPDATE "DetalleCuadreCaja"
              SET saldo_apertura = $1, saldo_cierre = $2, conteo_fisico = $3,
                  diferencia = $4, billetes = $5, monedas_fisicas = $6, movimientos_periodo = $7
              WHERE id = $8::uuid`,
            [saldoApertura, saldoCierreTeórico, conteoFísico, diferencia, billetes, monedasFísicas, movimientosPeriodo.length, detalle.id]
          );
          detalle.saldo_apertura = saldoApertura;
          detalle.saldo_cierre = saldoCierreTeórico;
          detalle.conteo_fisico = conteoFísico;
          detalle.diferencia = diferencia;
          detalle.billetes = billetes;
          detalle.monedas_fisicas = monedasFísicas;
          detalle.movimientos_periodo = movimientosPeriodo.length;
          logger.info(`✅ Detalle actualizado para ${moneda.codigo}`, {
            saldo_apertura: saldoApertura,
            saldo_cierre_teorico: saldoCierreTeórico,
            conteo_fisico: conteoFísico,
            ingresos,
            egresos,
          });
        }

        // Adjuntar info de bancos (no se persiste aquí para no pisar conteos de cierre)
        detalle.bancos_teorico = bancosTeorico;
        detalle.conteo_bancos = conteoBancos;

        detalle.moneda = moneda;
        detalles.push(detalle);
      } catch (monedaError) {
        logger.error(`❌ Error procesando moneda ${moneda.codigo}`, {
          error: monedaError instanceof Error ? monedaError.message : String(monedaError),
          stack: monedaError instanceof Error ? monedaError.stack : undefined,
        });
      }
    }

    // Mapear detalles al formato esperado por el frontend
    const detallesMapeados = await Promise.all(
      detalles.map(async (detalle) => {
        // Calcular ingresos y egresos del período para este detalle
        const movimientosPeriodo = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: detalle.moneda_id,
            fecha: {
              gte: new Date(fechaInicioDia),
              lt: new Date(fechaInicioDia.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        let ingresos = 0;
        let egresos = 0;

        for (const mov of movimientosPeriodo) {
          const monto = Number(mov.monto);
          if (monto > 0) {
            ingresos += monto;
          } else {
            egresos += Math.abs(monto);
          }
        }

        return {
          moneda_id: detalle.moneda_id,
          codigo: detalle.moneda?.codigo || "",
          nombre: detalle.moneda?.nombre || "",
          simbolo: detalle.moneda?.simbolo || "",
          saldo_apertura: Number(detalle.saldo_apertura) || 0,
          saldo_cierre: Number(detalle.saldo_cierre) || 0,
          conteo_fisico: Number(detalle.conteo_fisico) || 0,
          bancos_teorico: Number(detalle.bancos_teorico) || 0,
          conteo_bancos: Number(detalle.conteo_bancos) || 0,
          billetes: detalle.billetes || 0,
          monedas: detalle.monedas_fisicas || 0,
          ingresos_periodo: ingresos,
          egresos_periodo: egresos,
          movimientos_periodo: detalle.movimientos_periodo || 0,
        };
      })
    );

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("❌ Error en GET /cuadre-caja", {
      error: errorMessage,
      stack: errorStack,
      usuario_id: usuario?.id,
      punto_atencion_id: usuario?.punto_atencion_id,
    });
    
    return res.status(500).json({
      success: false,
      error: "Error al obtener datos de cuadre",
      message: errorMessage,
      debug: process.env.NODE_ENV === "development" ? {
        error: errorMessage,
        stack: errorStack,
      } : undefined,
    });
  }
});

export default router;
