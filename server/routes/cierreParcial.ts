// server/routes/cierreParcial.ts
import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

type DetalleReq = {
  moneda_id: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number; // alias frontend
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string;
};

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- POST /cierre-parcial/parcial ----------
router.post("/parcial", authenticateToken, async (req, res) => {
  try {
    const {
      detalles = [],
      observaciones,
      allowMismatch = false,
    }: {
      detalles: DetalleReq[];
      observaciones?: string;
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
    const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

    // Buscar cabecera ABIERTO de hoy
    const cabeceraAbierta = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: hoyGte, lt: hoyLt },
        estado: "ABIERTO",
      },
      select: { id: true },
    });

    if (!cabeceraAbierta) {
      return res.status(400).json({
        success: false,
        error: "No existe un cuadre ABIERTO para realizar cierre parcial",
      });
    }

    // Totales
    const totalIngresos = detalles.reduce(
      (s, d) => s + asNumber(d.ingresos_periodo),
      0
    );
    const totalEgresos = detalles.reduce(
      (s, d) => s + asNumber(d.egresos_periodo),
      0
    );
    const totalMovimientos = detalles.reduce(
      (s, d) => s + asNumber(d.movimientos_periodo),
      0
    );

    // Validación de tolerancia (opcional, se puede saltar con allowMismatch)
    if (detalles.length > 0 && !allowMismatch) {
      const monedas = await prisma.moneda.findMany({
        where: { activo: true },
        select: { id: true, codigo: true },
      });
      const codigoPorId = new Map(monedas.map((m) => [m.id, m.codigo]));

      const invalidas = detalles.filter((d) => {
        const codigo = codigoPorId.get(d.moneda_id);
        const tol = codigo === "USD" ? 1.0 : 0.01;
        const esperado = asNumber(d.saldo_cierre);
        const ingresado = asNumber(d.conteo_fisico);
        const diff = Math.abs(ingresado - esperado);
        return diff > tol + 1e-9;
      });

      if (invalidas.length > 0) {
        return res.status(400).json({
          success: false,
          error:
            "Las diferencias superan la tolerancia permitida. Si es correcto, habilita 'allowMismatch' para continuar.",
          detalles_invalidos: invalidas.map((d) => ({
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

    const actualizado = await prisma.$transaction(async (tx) => {
      // Actualiza cabecera a PARCIAL con totales y fecha_cierre
      const cabecera = await tx.cuadreCaja.update({
        where: { id: cabeceraAbierta.id },
        data: {
          estado: "PARCIAL",
          observaciones: observaciones || "Cierre parcial realizado",
          fecha_cierre: new Date(),
          total_cambios: totalMovimientos,
          total_ingresos: totalIngresos,
          total_egresos: totalEgresos,
        },
      });

      // Reemplazar detalles
      await tx.detalleCuadreCaja.deleteMany({
        where: { cuadre_id: cabecera.id },
      });

      if (detalles.length > 0) {
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

      // *** Importante: en PARCIAL NO se cierra jornada ni se libera punto ***
      return cabecera;
    });

    return res.status(200).json({
      success: true,
      message: "Cierre parcial realizado correctamente",
      cuadre_id: actualizado.id,
    });
  } catch (error) {
    logger.error("Error al realizar cierre parcial", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// ---------- GET /cierre-parcial/pendientes ----------
router.get("/pendientes", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as
      | { id: string; punto_atencion_id?: string }
      | undefined;

    if (!usuario) {
      return res
        .status(401)
        .json({ success: false, error: "Usuario no autenticado" });
    }

    const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

    // Por seguridad, mostrar solo los parciales del punto del usuario.
    // TODO: Si hay roles ADMIN/SUPER, permitir filtrar por ?pointId para ver otros puntos.
    const where: any = {
      fecha: { gte: hoyGte, lt: hoyLt },
      estado: "PARCIAL",
    };
    if (usuario.punto_atencion_id) {
      where.punto_atencion_id = usuario.punto_atencion_id;
    }

    const cierresParciales = await prisma.cuadreCaja.findMany({
      where,
      include: {
        puntoAtencion: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, username: true } },
        detalles: {
          include: {
            moneda: { select: { codigo: true, nombre: true, simbolo: true } },
          },
        },
      },
      orderBy: { fecha_cierre: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: cierresParciales,
    });
  } catch (error) {
    logger.error("Error al obtener cierres parciales pendientes", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
