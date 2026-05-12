import express from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { pool } from "../lib/database.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
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
  const saldoActual = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: puntoAtencionId, moneda_id: monedaId } },
  });
  const nuevaCantidad = Number(saldoActual?.cantidad || 0) + monto;
  const nuevasBilletes = Number(saldoActual?.billetes || 0) + billetes;
  const nuevasMonedas = Number(saldoActual?.monedas_fisicas || 0) + monedas;
  if (saldoActual) {
    await prisma.saldo.update({
      where: { punto_atencion_id_moneda_id: { punto_atencion_id: puntoAtencionId, moneda_id: monedaId } },
      data: { cantidad: nuevaCantidad, billetes: nuevasBilletes, monedas_fisicas: nuevasMonedas },
    });
  } else {
    await prisma.saldo.create({
      data: { punto_atencion_id: puntoAtencionId, moneda_id: monedaId, cantidad: nuevaCantidad, billetes: nuevasBilletes, monedas_fisicas: nuevasMonedas },
    });
  }
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
  desglose_denominaciones?: string | object;
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

router.post("/", authenticateToken, requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO"]), async (req, res) => {
  const usuario = req.user as any;
  
  try {
    const { fecha, pointId, observaciones, movimientos } = req.body;
    
    // Priorizar pointId del body si el usuario tiene permisos
    let puntoAtencionId = usuario.punto_atencion_id;
    const esAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(usuario.rol);
    
    if (pointId) {
      if (esAdmin || pointId === usuario.punto_atencion_id) {
        puntoAtencionId = pointId;
      } else {
        return res.status(403).json({ 
          success: false, 
          error: "No tiene permisos para operar en este punto de atención" 
        });
      }
    }

    if (!puntoAtencionId) {
      return res.status(400).json({ success: false, error: "Sin punto de atención" });
    }

    const fechaBase = parseFechaParam((fecha as string | undefined)?.trim());
    const { gte } = gyeDayRangeUtcFromDate(fechaBase);
    const fechaInicioDia = gte;

    // 1. Buscar cuadre ABIERTO existente
    const cuadreAbierto = await prisma.cuadreCaja.findFirst({
      where: { punto_atencion_id: String(puntoAtencionId), fecha: { gte: fechaInicioDia }, estado: 'ABIERTO' },
    });
    
    if (cuadreAbierto) {
      return res.status(200).json({ success: true, cuadre: cuadreAbierto, message: "Ya existe cuadre abierto" });
    }

    // 2. Buscar cuadre PARCIAL (cambio de turno) y reactivarlo a ABIERTO
    const cuadreParcial = await prisma.cuadreCaja.findFirst({
      where: { punto_atencion_id: String(puntoAtencionId), fecha: { gte: fechaInicioDia }, estado: 'PARCIAL' },
      orderBy: { fecha_cierre: 'desc' },
    });

    if (cuadreParcial) {
      // Reactivar el cuadre PARCIAL a ABIERTO para el nuevo operador
      const cuadreReactivado = await prisma.cuadreCaja.update({
        where: { id: cuadreParcial.id },
        data: {
          estado: 'ABIERTO',
          usuario_id: usuario.id,
          observaciones: (cuadreParcial.observaciones || '') + ' | Reactivado por cambio de turno',
        },
      });

      logger.info("✅ Cuadre PARCIAL reactivado a ABIERTO (cambio de turno)", {
        usuario_id: usuario.id,
        punto_atencion_id: puntoAtencionId,
        cuadre_id: cuadreReactivado.id,
        cuadre_anterior_id: cuadreParcial.usuario_cierre_parcial
      });

      return res.status(200).json({ 
        success: true, 
        cuadre: cuadreReactivado, 
        message: "Cuadre reactivado desde cierre parcial" 
      });
    }

    // 3. Crear nuevo cuadre si no existe ni ABIERTO ni PARCIAL
    const cuadreId = randomUUID();
    const nuevoCuadre = await prisma.cuadreCaja.create({
      data: {
        id: cuadreId,
        estado: 'ABIERTO',
        fecha: fechaInicioDia,
        punto_atencion_id: String(puntoAtencionId),
        usuario_id: usuario.id,
        observaciones: observaciones || "",
      },
    });

    if (Array.isArray(movimientos)) {
      for (const mov of movimientos) {
        await actualizarSaldoFisicoYLogico(
          String(puntoAtencionId),
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
      cuadre_id: nuevoCuadre.id
    });
    return res.status(201).json({ success: true, cuadre: nuevoCuadre, message: "Cuadre abierto creado" });
  } catch (error) {
    logger.error("❌ Error creando cuadre abierto", { error });
    return res.status(500).json({ success: false, error: "Error creando cuadre abierto" });
  }
});

function parseFechaParam(fecha?: string): Date {
  if (!fecha) return new Date();
  // Usar mediodía para evitar problemas de zona horaria al extraer el día calendario
  const d = new Date(`${fecha}T12:00:00`);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fechaInicioUtc: Date
): Promise<number> {
  try {
    const ultimoCierre = await prisma.detalleCuadreCaja.findFirst({
      where: {
        moneda_id: monedaId,
        cuadre: { punto_atencion_id: puntoAtencionId, estado: 'CERRADO', fecha: { lt: fechaInicioUtc } },
      },
      orderBy: { cuadre: { fecha: 'desc' } },
      include: { cuadre: true },
    });

    if (ultimoCierre) {
      const apertura = Number(ultimoCierre.conteo_fisico) || 0;
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

router.get("/", authenticateToken, requireRole(["OPERADOR", "ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]), async (req, res) => {
  const usuario = req.user as any;
  
  try {
    const fechaParam = (req.query.fecha as string | undefined)?.trim();
    const queryPointId = (req.query.pointId as string | undefined)?.trim();
    
    // Priorizar pointId de la query si el usuario es ADMIN/SUPER_USUARIO/ADMINISTRATIVO
    // O si es su propio punto
    let puntoAtencionId = usuario.punto_atencion_id;
    const esAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(usuario.rol);
    
    if (queryPointId) {
      if (esAdmin || queryPointId === usuario.punto_atencion_id) {
        puntoAtencionId = queryPointId;
      } else {
        return res.status(403).json({ 
          success: false, 
          error: "No tiene permisos para consultar este punto de atención" 
        });
      }
    }

    if (!puntoAtencionId) {
      logger.error("❌ usuario sin punto de atención asignado", {
        usuario_id: usuario.id,
      });
      return res.status(400).json({
        success: false,
        error: "Usuario no tiene punto de atención asignado",
      });
    }

    // Calcular rango de fechas correctamente
    let gte: Date, lt: Date;
    if (fechaParam) {
      const range = gyeDayRangeUtcFromDate(parseFechaParam(fechaParam));
      gte = range.gte;
      lt = range.lt;
    } else {
      const range = gyeDayRangeUtcFromDate(new Date());
      gte = range.gte;
      lt = range.lt;
    }
    
    const fechaInicioDia = gte;
    const fechaFinDia = lt;
    
    logger.info("🔍 GET /cuadre-caja iniciado", {
      usuario_id: usuario.id,
      punto_atencion_id: puntoAtencionId,
      punto_atencion_id_type: typeof puntoAtencionId,
      fecha: fechaInicioDia.toISOString(),
    });

    // Verificar si hay movimientos de cualquier tipo del día
    const [
      movimientosSaldo,
      cambiosDivisa,
      transferencias,
      serviciosExternos,
      guiasServientrega,
    ] = await Promise.all([
      // 1. Movimientos de saldo (tabla MovimientoSaldo)
      prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          fecha: { gte: fechaInicioDia, lt: fechaFinDia },
        },
      }),
      // 2. Cambios de divisa
      prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          fecha: { gte: fechaInicioDia, lt: fechaFinDia },
        },
      }),
      // 3. Transferencias (entrantes o salientes)
      prisma.transferencia.count({
        where: {
          OR: [
            { origen_id: puntoAtencionId },
            { destino_id: puntoAtencionId },
          ],
          fecha: { gte: fechaInicioDia, lt: fechaFinDia },
          estado: { in: ['COMPLETADO', 'APROBADO'] },
        },
      }),
      // 4. Servicios externos
      prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          fecha: { gte: fechaInicioDia, lt: fechaFinDia },
        },
      }),
      // 5. Guías Servientrega
      prisma.servientregaGuia.count({
        where: {
          punto_atencion_id: puntoAtencionId,
          created_at: { gte: fechaInicioDia, lt: fechaFinDia },
          estado: { not: 'CANCELADO' },
        },
      }),
    ]);

    logger.info("🔍 Resultados de conteos (debug):", {
      puntoAtencionId,
      fechaGte: fechaInicioDia.toISOString(),
      fechaLt: fechaFinDia.toISOString(),
      movimientosSaldo,
      cambiosDivisa,
      transferencias,
      serviciosExternos,
      guiasServientrega
    });

    const totalMovimientos = 
      movimientosSaldo + 
      cambiosDivisa + 
      transferencias + 
      serviciosExternos + 
      guiasServientrega;

    if (totalMovimientos === 0) {
      logger.info("ℹ️ Sin movimientos del día; devolviendo cuadre vacío", {
        punto_atencion_id: String(puntoAtencionId),
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

    logger.info("📊 Movimientos encontrados", {
      movimientos_saldo: movimientosSaldo,
      cambios_divisa: cambiosDivisa,
      transferencias: transferencias,
      servicios_externos: serviciosExternos,
      guias_servientrega: guiasServientrega,
      total: totalMovimientos,
    });

    // Obtener o crear cuadre abierto del día
    let cuadre = await prisma.cuadreCaja.findFirst({
      where: { punto_atencion_id: puntoAtencionId, fecha: { gte: fechaInicioDia }, estado: 'ABIERTO' },
    });
    if (!cuadre) {
      // Si no hay ABIERTO, verificar si ya existe uno CERRADO para el mismo día
      const cuadreCerrado = await prisma.cuadreCaja.findFirst({
        where: { punto_atencion_id: puntoAtencionId, fecha: { gte: fechaInicioDia }, estado: 'CERRADO' },
        orderBy: { fecha_cierre: 'desc' },
      });

      if (cuadreCerrado) {
        cuadre = cuadreCerrado;
        logger.info("ℹ️ Usando cuadre CERRADO existente para el día", {
          cuadre_id: cuadre.id,
        });
      } else {
        const cuadreId = randomUUID();
        cuadre = await prisma.cuadreCaja.create({
          data: {
            id: cuadreId,
            estado: 'ABIERTO',
            fecha: fechaInicioDia,
            punto_atencion_id: puntoAtencionId,
            usuario_id: usuario.id,
            observaciones: "",
          },
        });
        logger.info("📝 Cuadre creado", { cuadre_id: cuadre.id });
      }
    }

    // Obtener solo monedas activas con movimientos del día o con saldo no cero
    // NOTA: Se mantiene como raw SQL intencionalmente. Prisma no soporta nativamente
    // UNIONs de 6 tablas distintas en una sola query sin degradar rendimiento.
    const monedasResult = await pool.query<Moneda>(
      `SELECT id, codigo, nombre, simbolo, activo, orden_display
        FROM "Moneda"
        WHERE activo = true
          AND id IN (
            SELECT DISTINCT moneda_id
            FROM (
              SELECT ms.moneda_id
              FROM "MovimientoSaldo" ms
              WHERE ms.punto_atencion_id = $1
                AND ms.fecha >= $2::timestamp
                AND ms.fecha < $3::timestamp

              UNION

              SELECT cd.moneda_origen_id AS moneda_id
              FROM "CambioDivisa" cd
              WHERE cd.punto_atencion_id = $1
                AND cd.fecha >= $2::timestamp
                AND cd.fecha < $3::timestamp

              UNION

              SELECT cd.moneda_destino_id AS moneda_id
              FROM "CambioDivisa" cd
              WHERE cd.punto_atencion_id = $1
                AND cd.fecha >= $2::timestamp
                AND cd.fecha < $3::timestamp

              UNION

              SELECT se.moneda_id
              FROM "ServicioExternoMovimiento" se
              WHERE se.punto_atencion_id = $1
                AND se.fecha >= $2::timestamp
                AND se.fecha < $3::timestamp
                AND se.moneda_id IS NOT NULL

              UNION

              SELECT t.moneda_id
              FROM "Transferencia" t
              WHERE (t.origen_id = $1 OR t.destino_id = $1)
                AND t.fecha >= $2::timestamp
                AND t.fecha < $3::timestamp
                AND t.estado IN ('COMPLETADO', 'APROBADO')
                AND t.moneda_id IS NOT NULL

              UNION

              SELECT s.moneda_id
              FROM "Saldo" s
              WHERE s.punto_atencion_id = $1
                AND (
                  COALESCE(s.cantidad, 0) <> 0
                  OR COALESCE(s.billetes, 0) <> 0
                  OR COALESCE(s.monedas_fisicas, 0) <> 0
                  OR COALESCE(s.bancos, 0) <> 0
                )
            ) AS monedas_relevantes
            WHERE moneda_id IS NOT NULL
          )
        ORDER BY orden_display ASC`
      , [puntoAtencionId, fechaInicioDia.toISOString(), fechaFinDia.toISOString()]
    );
    const monedas = monedasResult.rows;
    logger.info(`📊 Monedas relevantes encontradas: ${monedas.length}`);

    // Calcular saldos para cada moneda (incluyendo TODAS las monedas activas)
    const detalles: DetalleCuadreCaja[] = [];

    for (const moneda of monedas) {
      try {
        logger.info(`📦 Procesando moneda: ${moneda.codigo}`, { moneda_id: moneda.id });
        
        // Obtener saldo de apertura (último conteo físico del cierre anterior)
        const saldoApertura = await calcularSaldoApertura(
          puntoAtencionId,
          moneda.id,
          fechaInicioDia
        );

        // Calcular saldo teórico (cierre) usando reconciliación de movimientos
        // como respaldo si no existe saldo físico persistido.
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

        // Obtener detalle existente del cuadre (si el operador ya guardó conteo físico)
        const detalleExistente = await prisma.detalleCuadreCaja.findFirst({
          where: { cuadre_id: cuadre.id, moneda_id: moneda.id },
        });

        // Leer snapshot de Saldo solo como fallback inicial (primer GET del día)
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

        // 🔒 FIX: Si el operador ya guardó un conteo físico (via cuadre-caja-conteo),
        // respetarlo SIEMPRE. El GET nunca debe pisar el conteo del operador.
        // Solo si no existe detalle, usamos Saldo como valor inicial.
        let conteoFísico: number;
        let billetes: number;
        let monedasFísicas: number;
        let bancosTeorico: number;
        let conteoBancos: number;

        if (detalleExistente) {
          conteoFísico = Number(detalleExistente.conteo_fisico);
          billetes = Number(detalleExistente.billetes);
          monedasFísicas = Number(detalleExistente.monedas_fisicas);
          bancosTeorico = Number(detalleExistente.bancos_teorico);
          conteoBancos = Number(detalleExistente.conteo_bancos);
        } else {
          // Si no hay detalle guardado por el operador, usar el teórico reconciliado
          // como valor inicial (diferencia = 0). NUNCA usar Saldo.cantidad porque
          // guardar-cierre.ts la actualiza con el conteo físico del cierre anterior,
          // lo cual generaría diferencias espurias al inicio del día.
          conteoFísico = saldoCierreTeórico;
          billetes = 0;
          monedasFísicas = 0;
          bancosTeorico = saldoFísico ? Number(saldoFísico.bancos) : 0;
          conteoBancos = bancosTeorico;
        }

        const diferencia = Number((conteoFísico - saldoCierreTeórico).toFixed(2));

        let detalle: DetalleCuadreCaja;
        if (!detalleExistente) {
          const detalleId = randomUUID();
          detalle = (await prisma.detalleCuadreCaja.create({
            data: {
              id: detalleId,
              cuadre_id: cuadre.id,
              moneda_id: moneda.id,
              saldo_apertura: saldoApertura,
              saldo_cierre: saldoCierreTeórico,
              conteo_fisico: conteoFísico,
              diferencia,
              billetes,
              monedas_fisicas: monedasFísicas,
              movimientos_periodo: movimientosPeriodo.length,
              bancos_teorico: bancosTeorico,
              conteo_bancos: conteoBancos,
            },
          })) as any;
          logger.info(`✅ Detalle creado para ${moneda.codigo}`, {
            saldo_apertura: saldoApertura,
            saldo_cierre_teorico: saldoCierreTeórico,
            conteo_fisico: conteoFísico,
            ingresos,
            egresos,
          });
        } else {
          // Solo actualizar campos calculados (teórico, movimientos).
          // NUNCA pisar conteo_fisico, billetes, monedas, bancos del operador.
          detalle = (await prisma.detalleCuadreCaja.update({
            where: { id: detalleExistente.id },
            data: {
              saldo_apertura: saldoApertura,
              saldo_cierre: saldoCierreTeórico,
              diferencia,
              movimientos_periodo: movimientosPeriodo.length,
            },
          })) as any;
          logger.info(`✅ Detalle actualizado para ${moneda.codigo}`, {
            saldo_apertura: saldoApertura,
            saldo_cierre_teorico: saldoCierreTeórico,
            conteo_fisico: conteoFísico,
            ingresos,
            egresos,
          });
        }

        // Adjuntar info de bancos para la respuesta
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

        // Parsear desglose_denominaciones si existe
        let desgloseDenominaciones = null;
        if (detalle.desglose_denominaciones) {
          try {
            desgloseDenominaciones = typeof detalle.desglose_denominaciones === 'string'
              ? JSON.parse(detalle.desglose_denominaciones)
              : detalle.desglose_denominaciones;
          } catch (e) {
            logger.warn("Error parseando desglose_denominaciones", { detalle_id: detalle.id });
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
          desglose_denominaciones: desgloseDenominaciones,
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
