// server/routes/guardar-cierre.ts
import express from "express";
import prisma, { Prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate, nowEcuador } from "../utils/timezone.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento as MovimientoTipoMovimiento,
  TipoReferencia as MovimientoTipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

interface DesgloseDenominacion {
  denominacion: number;
  tipo: 'BILLETE' | 'MONEDA';
  cantidad: number;
}

interface DetalleRequest {
  moneda_id: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  bancos_teorico?: number;
  conteo_bancos?: number;
  billetes: number;
  monedas: number; // alias del frontend para monedas físicas
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string;
  desglose_denominaciones?: DesgloseDenominacion[];
}

function asNumber(x: unknown, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

router.post(
  "/",
  authenticateToken,
  idempotency({ route: "/api/guardar-cierre" }),
  async (req, res) => {
  try {
    const {
      detalles = [],
      observaciones,
      tipo_cierre = "CERRADO",
      allowMismatch = false,
    }: {
      detalles: DetalleRequest[];
      observaciones?: string;
      tipo_cierre?: "CERRADO" | "PARCIAL";
      allowMismatch?: boolean;
    } = req.body || {};

    const usuario = req.user as
      | { id: string; punto_atencion_id: string }
      | undefined;

    if (!usuario?.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const puntoAtencionId = usuario.punto_atencion_id;

    // Día actual (zona GYE) para evitar problemas por timezone
    const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

    // Si se intenta cerrar definitivamente y ya hay un CERRADO para hoy → error (idempotencia)
    const cerradoHoy = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: hoyGte, lt: hoyLt },
        estado: "CERRADO",
      },
      select: { id: true },
    });

    if (cerradoHoy && tipo_cierre === "CERRADO") {
      return res.status(400).json({
        success: false,
        error: "Ya existe un cuadre CERRADO para el día de hoy",
      });
    }

    // Cálculo de totales (aunque vengan 0 detalles)
    const totalIngresos = detalles.reduce(
      (sum, d) => sum + asNumber(d.ingresos_periodo),
      0
    );
    const totalEgresos = detalles.reduce(
      (sum, d) => sum + asNumber(d.egresos_periodo),
      0
    );
    const totalMovimientos = detalles.reduce(
      (sum, d) => sum + asNumber(d.movimientos_periodo),
      0
    );

    // Si hay detalles, validar tolerancias (a menos que allowMismatch = true)
    if (detalles.length > 0 && !allowMismatch) {
      // Buscar códigos de moneda activos
      const monedas = await prisma.moneda.findMany({
        where: { activo: true },
        select: { id: true, codigo: true },
      });
      const monedaPorId = new Map(monedas.map((m) => [m.id, m.codigo]));

      const diferenciasInvalidas = detalles.filter((d) => {
        const codigo = monedaPorId.get(d.moneda_id);
        const tolerance = codigo === "USD" ? 1.0 : 0.01;
        const esperado = asNumber(d.saldo_cierre);
        const ingresado = asNumber(d.conteo_fisico);
        const diff = Math.abs(ingresado - esperado);
        return diff > tolerance + 1e-9;
      });

      if (diferenciasInvalidas.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "Las diferencias superan la tolerancia permitida. Si es correcto, habilita 'allowMismatch' para continuar.",
          detalles_invalidos: diferenciasInvalidas.map((d) => ({
            moneda_id: d.moneda_id,
            esperado: asNumber(d.saldo_cierre),
            ingresado: asNumber(d.conteo_fisico),
          })),
        });
      }

      // Validar que billetes + monedas_fisicas = conteo_fisico
      const breakdownInvalidos = detalles.filter((d) => {
        const conteoFisico = asNumber(d.conteo_fisico);
        const billetes = asNumber(d.billetes);
        const monedas_fisicas = asNumber(d.monedas);
        const suma = billetes + monedas_fisicas;
        const diff = Math.abs(suma - conteoFisico);
        return diff > 0.01; // Tolerancia para errores de redondeo
      });

      if (breakdownInvalidos.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "El desglose de billetes y monedas no coincide con el conteo físico total. Billetes + Monedas debe ser igual al conteo físico.",
          detalles_invalidos: breakdownInvalidos.map((d) => ({
            moneda_id: d.moneda_id,
            conteo_fisico: asNumber(d.conteo_fisico),
            billetes: asNumber(d.billetes),
            monedas_fisicas: asNumber(d.monedas),
            suma: asNumber(d.billetes) + asNumber(d.monedas),
          })),
        });
      }
    }

    // Transacción para mantener consistencia entre header y detalles
    const result = await prisma.$transaction(async (tx) => {
      // ═════════════════════════════════════════════════════════════════
      // BUSCAR CUADRE ABIERTO O PARCIAL MÁS RECIENTE
      // ═════════════════════════════════════════════════════════════════
      // Primero buscar cuadre ABIERTO del día actual
      let cabecera = await tx.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          fecha: { gte: hoyGte, lt: hoyLt },
          estado: "ABIERTO",
        },
      });

      // Si no hay ABIERTO del día, buscar cuadre PARCIAL (cambio de turno)
      if (!cabecera) {
        cabecera = await tx.cuadreCaja.findFirst({
          where: {
            punto_atencion_id: puntoAtencionId,
            fecha: { gte: hoyGte, lt: hoyLt },
            estado: "PARCIAL",
          },
          orderBy: { fecha_cierre: "desc" },
        });
      }

      // Si no hay cuadre del día, buscar cualquier cuadre ABIERTO anterior
      // (para permitir cerrar días anteriores que quedaron pendientes)
      if (!cabecera && tipo_cierre === "CERRADO") {
        cabecera = await tx.cuadreCaja.findFirst({
          where: {
            punto_atencion_id: puntoAtencionId,
            estado: { in: ["ABIERTO", "PARCIAL"] },
          },
          orderBy: { fecha: "desc" },
        });

        if (cabecera) {
          logger.info("Usando cuadre anterior para cierre", {
            cuadre_id: cabecera.id,
            cuadre_fecha: cabecera.fecha,
            cuadre_estado: cabecera.estado,
          });
        }
      }

      if (!cabecera) {
        // Si no hay cuadre existente, crear uno nuevo (solo si hay detalles)
        if (detalles.length === 0) {
          throw new Error("No hay cuadre abierto para cerrar y no se proporcionaron detalles");
        }

        cabecera = await tx.cuadreCaja.create({
          data: {
            usuario_id: usuario.id,
            punto_atencion_id: puntoAtencionId,
            fecha: new Date(), // UTC - la UI muestra en zona horaria local
            estado: tipo_cierre, // puede ser PARCIAL o CERRADO
            observaciones: observaciones || "",
            fecha_cierre: new Date(), // UTC - la UI muestra en zona horaria local
            total_cambios: totalMovimientos,
            total_ingresos: totalIngresos,
            total_egresos: totalEgresos,
          },
        });
      } else {
        cabecera = await tx.cuadreCaja.update({
          where: { id: cabecera.id },
          data: {
            estado: tipo_cierre,
            observaciones: observaciones ?? cabecera.observaciones ?? "",
            fecha_cierre: new Date(), // UTC - la UI muestra en zona horaria local
            total_cambios: totalMovimientos,
            total_ingresos: totalIngresos,
            total_egresos: totalEgresos,
          },
        });
      }

      // Re-crear detalles si vienen
      if (detalles.length > 0) {
        await tx.detalleCuadreCaja.deleteMany({
          where: { cuadre_id: cabecera.id },
        });

        const payload = detalles.map((d) => {
          const saldo_apertura = asNumber(d.saldo_apertura);
          const saldo_cierre = asNumber(d.saldo_cierre);
          const conteo_fisico = asNumber(d.conteo_fisico);
          const bancos_teorico = asNumber(d.bancos_teorico);
          const conteo_bancos = asNumber(d.conteo_bancos);
          const billetes = asNumber(d.billetes);
          const monedas_fisicas = asNumber(d.monedas);
          const diferencia = Number((conteo_fisico - saldo_cierre).toFixed(2));
          const diferencia_bancos = Number(
            (conteo_bancos - bancos_teorico).toFixed(2)
          );

          // Preparar desglose_denominaciones para Prisma (Json field)
          const desgloseData = d.desglose_denominaciones && d.desglose_denominaciones.length > 0
            ? d.desglose_denominaciones as unknown as Prisma.InputJsonValue
            : undefined;

          return {
            cuadre_id: cabecera.id,
            moneda_id: d.moneda_id,
            saldo_apertura,
            saldo_cierre,
            conteo_fisico,
            bancos_teorico,
            conteo_bancos,
            diferencia_bancos,
            billetes,
            monedas_fisicas,
            diferencia,
            movimientos_periodo: asNumber(d.movimientos_periodo),
            observaciones_detalle: d.observaciones_detalle ?? null,
            ...(desgloseData ? { desglose_denominaciones: desgloseData } : {}),
          };
        });

        await tx.detalleCuadreCaja.createMany({ data: payload });
      }

      // Si el cierre es definitivo, actualizar saldos y registrar ajustes de reconciliación
      if (tipo_cierre === "CERRADO") {
        // Actualizar tabla Saldo con el conteo_fisico (saldo cuadrado = saldo inicial siguiente día)
        if (detalles.length > 0) {
          for (const detalle of detalles) {
            const conteoFisico = asNumber(detalle.conteo_fisico);
            const billetes = asNumber(detalle.billetes);
            const monedas_fisicas = asNumber(detalle.monedas);
            const conteoBancos =
              detalle.conteo_bancos === null || detalle.conteo_bancos === undefined
                ? null
                : asNumber(detalle.conteo_bancos);

            await tx.saldo.upsert({
              where: {
                punto_atencion_id_moneda_id: {
                  punto_atencion_id: puntoAtencionId,
                  moneda_id: detalle.moneda_id,
                },
              },
              update: {
                cantidad: conteoFisico,
                billetes: billetes,
                monedas_fisicas: monedas_fisicas,
                ...(conteoBancos === null ? {} : { bancos: conteoBancos }),
                updated_at: new Date(),
              },
              create: {
                punto_atencion_id: puntoAtencionId,
                moneda_id: detalle.moneda_id,
                cantidad: conteoFisico,
                billetes: billetes,
                monedas_fisicas: monedas_fisicas,
                bancos: conteoBancos === null ? 0 : conteoBancos,
              },
            });

            // Ajuste contable para que la reconciliación por movimientos refleje el conteo físico.
            const saldoCierre = asNumber(detalle.saldo_cierre, NaN);
            const diff = Number((conteoFisico - saldoCierre).toFixed(2));
            if (Number.isFinite(saldoCierre) && Math.abs(diff) >= 0.01) {
              const already = await tx.movimientoSaldo.findFirst({
                where: {
                  punto_atencion_id: String(puntoAtencionId),
                  moneda_id: String(detalle.moneda_id),
                  tipo_referencia: MovimientoTipoReferencia.CIERRE_DIARIO,
                  referencia_id: String(cabecera.id),
                  descripcion: {
                    contains: "AJUSTE CIERRE",
                    mode: "insensitive",
                  },
                },
                select: { id: true },
              });

              if (!already) {
                await registrarMovimientoSaldo(
                  {
                    puntoAtencionId: puntoAtencionId,
                    monedaId: detalle.moneda_id,
                    tipoMovimiento:
                      diff > 0
                        ? MovimientoTipoMovimiento.INGRESO
                        : MovimientoTipoMovimiento.EGRESO,
                    monto: Math.abs(diff),
                    saldoAnterior: saldoCierre,
                    saldoNuevo: conteoFisico,
                    tipoReferencia: MovimientoTipoReferencia.CIERRE_DIARIO,
                    referenciaId: cabecera.id,
                    descripcion: `AJUSTE CIERRE ${new Date().toISOString().slice(0, 10)}`,
                    usuarioId: usuario.id,
                    saldoBucket: "CAJA",
                  },
                  tx
                );
              }
            }
          }
        }

      }

      // Tanto el cierre total como el parcial deben finalizar la jornada del operador actual
      const jornadaActiva = await tx.jornada.findFirst({
        where: {
          usuario_id: usuario.id,
          punto_atencion_id: puntoAtencionId,
          fecha_salida: null,
          estado: { in: ["ACTIVO", "ALMUERZO"] },
        },
        orderBy: { fecha_inicio: "desc" },
      });

      let jornadaFinalizada = false;
      if (jornadaActiva) {
        await tx.jornada.update({
          where: { id: jornadaActiva.id },
          data: {
            fecha_salida: new Date(), // UTC - corregido
            estado: "COMPLETADO",
            observaciones:
              tipo_cierre === "PARCIAL"
                ? "Jornada finalizada automáticamente al completar cierre parcial de caja"
                : "Jornada finalizada automáticamente al completar cierre de caja",
          },
        });
        jornadaFinalizada = true;
      }

      // Liberar punto de atención del usuario cuando el punto cerrado es el que tenía asignado
      const usuarioActual = await tx.usuario.findUnique({
        where: { id: usuario.id },
        select: { punto_atencion_id: true },
      });

      let puntoLiberado = false;
      if (usuarioActual?.punto_atencion_id === puntoAtencionId) {
        await tx.usuario.update({
          where: { id: usuario.id },
          data: { punto_atencion_id: null },
        });
        puntoLiberado = true;
      }

      return {
        cabecera,
        jornadaFinalizada,
        puntoLiberado,
      };
    });

    res.status(200).json({
      success: true,
      message:
        tipo_cierre === "PARCIAL"
          ? "Cierre parcial realizado correctamente"
          : "Cierre de caja realizado correctamente",
      cuadre_id: result.cabecera.id,
      jornada_finalizada: result.jornadaFinalizada,
      punto_liberado: result.puntoLiberado,
    });
  } catch (error) {
    logger.error("Error al guardar el cuadre de caja", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
  }
);

export default router;
