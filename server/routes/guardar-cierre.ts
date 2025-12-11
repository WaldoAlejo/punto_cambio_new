// server/routes/guardar-cierre.ts
import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

interface DetalleRequest {
  moneda_id: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number; // alias del frontend para monedas físicas
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string;
}

function asNumber(x: unknown, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

router.post("/", authenticateToken, async (req, res) => {
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
    }

    // Transacción para mantener consistencia entre header y detalles
    const result = await prisma.$transaction(async (tx) => {
      // Reutilizar cabecera ABIERTO del día o crear una nueva
      let cabecera = await tx.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: puntoAtencionId,
          fecha: { gte: hoyGte, lt: hoyLt },
          estado: "ABIERTO",
        },
      });

      if (!cabecera) {
        cabecera = await tx.cuadreCaja.create({
          data: {
            usuario_id: usuario.id,
            punto_atencion_id: puntoAtencionId,
            fecha: new Date(), // fecha cabecera (hoy UTC)
            estado: tipo_cierre, // puede ser PARCIAL o CERRADO
            observaciones: observaciones || "",
            fecha_cierre: new Date(),
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
            fecha_cierre: new Date(),
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
          const billetes = asNumber(d.billetes);
          const monedas_fisicas = asNumber(d.monedas);
          const diferencia = Number((conteo_fisico - saldo_cierre).toFixed(2));

          return {
            cuadre_id: cabecera.id,
            moneda_id: d.moneda_id,
            saldo_apertura,
            saldo_cierre,
            conteo_fisico,
            billetes,
            monedas_fisicas,
            diferencia,
            movimientos_periodo: asNumber(d.movimientos_periodo),
            observaciones_detalle: d.observaciones_detalle ?? null,
          };
        });

        await tx.detalleCuadreCaja.createMany({ data: payload });
      }

      // Si el cierre es definitivo, actualizar saldos, cerrar jornada y liberar punto
      if (tipo_cierre === "CERRADO") {
        // Actualizar tabla Saldo con el conteo_fisico (saldo cuadrado = saldo inicial siguiente día)
        if (detalles.length > 0) {
          for (const detalle of detalles) {
            const conteoFisico = asNumber(detalle.conteo_fisico);
            const billetes = asNumber(detalle.billetes);
            const monedas_fisicas = asNumber(detalle.monedas);

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
                updated_at: new Date(),
              },
              create: {
                punto_atencion_id: puntoAtencionId,
                moneda_id: detalle.moneda_id,
                cantidad: conteoFisico,
                billetes: billetes,
                monedas_fisicas: monedas_fisicas,
              },
            });
          }
        }

        // Cerrar jornada activa del usuario (si existe)
        const jornadaActiva = await tx.jornada.findFirst({
          where: {
            usuario_id: usuario.id,
            punto_atencion_id: puntoAtencionId,
            fecha_salida: null,
            estado: { in: ["ACTIVO", "ALMUERZO"] },
          },
          orderBy: { fecha_inicio: "desc" },
        });

        if (jornadaActiva) {
          await tx.jornada.update({
            where: { id: jornadaActiva.id },
            data: {
              fecha_salida: new Date(),
              estado: "COMPLETADO",
              observaciones: "Jornada finalizada automáticamente al completar cierre de caja",
            },
          });
        }

        // Liberar punto de atención del usuario
        await tx.usuario.update({
          where: { id: usuario.id },
          data: { punto_atencion_id: null },
        });
      }

      return cabecera;
    });

    res.status(200).json({
      success: true,
      message:
        tipo_cierre === "PARCIAL"
          ? "Cierre parcial realizado correctamente"
          : "Cierre de caja realizado correctamente",
      cuadre_id: result.id,
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
});

export default router;
