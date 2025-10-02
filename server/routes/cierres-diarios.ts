// server/routes/cierres-diarios.ts
import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import {
  gyeDayRangeUtcFromDate,
  todayGyeDateOnly,
  gyeParseDateOnly,
} from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /api/cierres-diarios/resumen-dia-anterior
 * Obtiene el resumen de cierres del día anterior con saldos por divisa
 * Solo accesible para ADMIN y SUPER_USUARIO
 */
router.get("/resumen-dia-anterior", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as { id: string; rol: string } | undefined;

    // Log para debug
    logger.info("Acceso a resumen-dia-anterior", {
      usuario: usuario?.id,
      rol: usuario?.rol,
    });

    // Verificar permisos
    const isAdmin = ["ADMIN", "SUPER_USUARIO"].includes(usuario?.rol || "");
    if (!usuario || !isAdmin) {
      logger.warn("Acceso denegado a resumen-dia-anterior", {
        usuario: usuario?.id,
        rol: usuario?.rol,
      });
      return res.status(403).json({
        success: false,
        error: "No tiene permisos para acceder a esta información",
      });
    }

    // Calcular el rango del día anterior en zona GYE
    // Obtener la fecha actual de Ecuador (no UTC del servidor)
    const hoyGyeStr = todayGyeDateOnly(); // "YYYY-MM-DD" en hora de Ecuador
    const { y, m, d } = gyeParseDateOnly(hoyGyeStr);

    // Calcular ayer restando 1 día
    const ayerDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    ayerDate.setUTCDate(ayerDate.getUTCDate() - 1);

    const ayerY = ayerDate.getUTCFullYear();
    const ayerM = ayerDate.getUTCMonth() + 1;
    const ayerD = ayerDate.getUTCDate();
    const ayerStr = `${ayerY}-${ayerM.toString().padStart(2, "0")}-${ayerD
      .toString()
      .padStart(2, "0")}`;

    // Log para debug de fechas
    logger.info("Calculando resumen de cierres", {
      hoy_ecuador: hoyGyeStr,
      ayer_ecuador: ayerStr,
      servidor_utc: new Date().toISOString(),
    });

    const { gte: ayerGte, lt: ayerLt } = gyeDayRangeUtcFromDate(ayerDate);

    // Obtener todos los puntos activos
    const puntosActivos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
      },
      orderBy: { nombre: "asc" },
    });

    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        simbolo: true,
      },
      orderBy: { orden_display: "asc" },
    });

    // Obtener cierres del día anterior
    const cierres = await prisma.cuadreCaja.findMany({
      where: {
        fecha: { gte: ayerGte, lt: ayerLt },
        estado: "CERRADO",
      },
      include: {
        puntoAtencion: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
          },
        },
        detalles: {
          include: {
            moneda: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                simbolo: true,
              },
            },
          },
        },
      },
      orderBy: { fecha_cierre: "desc" },
    });

    // Crear un mapa de puntos con cierre
    const puntosConCierre = new Map(
      cierres.map((cierre) => [cierre.punto_atencion_id, cierre])
    );

    // Construir el resumen
    const resumen = puntosActivos.map((punto) => {
      const cierre = puntosConCierre.get(punto.id);

      if (!cierre) {
        // Punto sin cierre
        return {
          punto_id: punto.id,
          punto_nombre: punto.nombre,
          ciudad: punto.ciudad,
          tiene_cierre: false,
          fecha_cierre: null,
          hora_cierre: null,
          usuario_cierre: null,
          saldos_por_divisa: [],
          observaciones: null,
        };
      }

      // Punto con cierre
      const saldosPorDivisa = cierre.detalles.map((detalle) => ({
        moneda_id: detalle.moneda.id,
        moneda_codigo: detalle.moneda.codigo,
        moneda_nombre: detalle.moneda.nombre,
        moneda_simbolo: detalle.moneda.simbolo,
        saldo_apertura: Number(detalle.saldo_apertura),
        saldo_cierre: Number(detalle.saldo_cierre),
        conteo_fisico: Number(detalle.conteo_fisico),
        diferencia: Number(detalle.diferencia),
        billetes: detalle.billetes,
        monedas_fisicas: detalle.monedas_fisicas,
        movimientos_periodo: detalle.movimientos_periodo,
      }));

      return {
        punto_id: punto.id,
        punto_nombre: punto.nombre,
        ciudad: punto.ciudad,
        tiene_cierre: true,
        fecha_cierre: cierre.fecha_cierre,
        hora_cierre: cierre.fecha_cierre
          ? cierre.fecha_cierre.toISOString()
          : null,
        usuario_cierre: cierre.usuario.nombre,
        saldos_por_divisa: saldosPorDivisa,
        observaciones: cierre.observaciones,
        total_ingresos: Number(cierre.total_ingresos),
        total_egresos: Number(cierre.total_egresos),
      };
    });

    // Estadísticas generales
    const totalPuntos = puntosActivos.length;
    const puntosConCierreCount = resumen.filter((r) => r.tiene_cierre).length;
    const puntosSinCierreCount = totalPuntos - puntosConCierreCount;

    res.status(200).json({
      success: true,
      data: {
        fecha_consultada: ayerStr,
        estadisticas: {
          total_puntos: totalPuntos,
          puntos_con_cierre: puntosConCierreCount,
          puntos_sin_cierre: puntosSinCierreCount,
          porcentaje_cumplimiento:
            totalPuntos > 0
              ? Math.round((puntosConCierreCount / totalPuntos) * 100)
              : 0,
        },
        monedas_disponibles: monedas,
        resumen_por_punto: resumen,
      },
    });
  } catch (error) {
    logger.error("Error al obtener resumen de cierres del día anterior", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/cierres-diarios/resumen-por-fecha
 * Obtiene el resumen de cierres de una fecha específica
 * Solo accesible para ADMIN y SUPER_USUARIO
 */
router.get("/resumen-por-fecha", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as { id: string; rol: string } | undefined;

    // Log para debug
    logger.info("Acceso a resumen-por-fecha", {
      usuario: usuario?.id,
      rol: usuario?.rol,
      fecha: req.query.fecha,
    });

    // Verificar permisos
    const isAdmin = ["ADMIN", "SUPER_USUARIO"].includes(usuario?.rol || "");
    if (!usuario || !isAdmin) {
      logger.warn("Acceso denegado a resumen-por-fecha", {
        usuario: usuario?.id,
        rol: usuario?.rol,
      });
      return res.status(403).json({
        success: false,
        error: "No tiene permisos para acceder a esta información",
      });
    }

    const { fecha } = req.query;

    if (!fecha || typeof fecha !== "string") {
      return res.status(400).json({
        success: false,
        error: "Debe proporcionar una fecha válida (formato: YYYY-MM-DD)",
      });
    }

    // Parsear la fecha
    const fechaConsulta = new Date(fecha);
    if (isNaN(fechaConsulta.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Formato de fecha inválido",
      });
    }

    const { gte: fechaGte, lt: fechaLt } =
      gyeDayRangeUtcFromDate(fechaConsulta);

    // Obtener todos los puntos activos
    const puntosActivos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
      },
      orderBy: { nombre: "asc" },
    });

    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        simbolo: true,
      },
      orderBy: { orden_display: "asc" },
    });

    // Obtener cierres de la fecha especificada
    const cierres = await prisma.cuadreCaja.findMany({
      where: {
        fecha: { gte: fechaGte, lt: fechaLt },
        estado: "CERRADO",
      },
      include: {
        puntoAtencion: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
          },
        },
        detalles: {
          include: {
            moneda: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                simbolo: true,
              },
            },
          },
        },
      },
      orderBy: { fecha_cierre: "desc" },
    });

    // Crear un mapa de puntos con cierre
    const puntosConCierre = new Map(
      cierres.map((cierre) => [cierre.punto_atencion_id, cierre])
    );

    // Construir el resumen
    const resumen = puntosActivos.map((punto) => {
      const cierre = puntosConCierre.get(punto.id);

      if (!cierre) {
        return {
          punto_id: punto.id,
          punto_nombre: punto.nombre,
          ciudad: punto.ciudad,
          tiene_cierre: false,
          fecha_cierre: null,
          hora_cierre: null,
          usuario_cierre: null,
          saldos_por_divisa: [],
          observaciones: null,
        };
      }

      const saldosPorDivisa = cierre.detalles.map((detalle) => ({
        moneda_id: detalle.moneda.id,
        moneda_codigo: detalle.moneda.codigo,
        moneda_nombre: detalle.moneda.nombre,
        moneda_simbolo: detalle.moneda.simbolo,
        saldo_apertura: Number(detalle.saldo_apertura),
        saldo_cierre: Number(detalle.saldo_cierre),
        conteo_fisico: Number(detalle.conteo_fisico),
        diferencia: Number(detalle.diferencia),
        billetes: detalle.billetes,
        monedas_fisicas: detalle.monedas_fisicas,
        movimientos_periodo: detalle.movimientos_periodo,
      }));

      return {
        punto_id: punto.id,
        punto_nombre: punto.nombre,
        ciudad: punto.ciudad,
        tiene_cierre: true,
        fecha_cierre: cierre.fecha_cierre,
        hora_cierre: cierre.fecha_cierre
          ? cierre.fecha_cierre.toISOString()
          : null,
        usuario_cierre: cierre.usuario.nombre,
        saldos_por_divisa: saldosPorDivisa,
        observaciones: cierre.observaciones,
        total_ingresos: Number(cierre.total_ingresos),
        total_egresos: Number(cierre.total_egresos),
      };
    });

    // Estadísticas generales
    const totalPuntos = puntosActivos.length;
    const puntosConCierreCount = resumen.filter((r) => r.tiene_cierre).length;
    const puntosSinCierreCount = totalPuntos - puntosConCierreCount;

    res.status(200).json({
      success: true,
      data: {
        fecha_consultada: fecha,
        estadisticas: {
          total_puntos: totalPuntos,
          puntos_con_cierre: puntosConCierreCount,
          puntos_sin_cierre: puntosSinCierreCount,
          porcentaje_cumplimiento:
            totalPuntos > 0
              ? Math.round((puntosConCierreCount / totalPuntos) * 100)
              : 0,
        },
        monedas_disponibles: monedas,
        resumen_por_punto: resumen,
      },
    });
  } catch (error) {
    logger.error("Error al obtener resumen de cierres por fecha", {
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
