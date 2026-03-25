/**
 * cierreReporte.ts
 * 
 * Endpoints para reportes de cierre de caja
 * - Reporte para operadores (su propio cierre)
 * - Reporte para administradores (todos los puntos)
 * - Validaciones de cierre
 * - Historial de cierres
 */

import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate, todayGyeDateOnly, gyeParseDateOnly } from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /api/cierre-reporte/operador
 * Obtiene el reporte de cierre para el operador actual
 * Requiere: estar autenticado y tener punto de atención asignado
 */
router.get("/operador", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as { 
      id: string; 
      rol: string;
      punto_atencion_id: string | null;
      nombre: string;
      username: string;
    } | undefined;

    if (!usuario?.punto_atencion_id) {
      return res.status(400).json({
        success: false,
        error: "No tienes un punto de atención asignado",
      });
    }

    const { fecha } = req.query;
    let fechaConsulta: Date;

    if (fecha && typeof fecha === "string") {
      try {
        const [year, month, day] = fecha.split('-').map(Number);
        fechaConsulta = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      } catch {
        return res.status(400).json({
          success: false,
          error: "Formato de fecha inválido. Use YYYY-MM-DD",
        });
      }
    } else {
      // Usar fecha actual en Ecuador
      const hoyStr = todayGyeDateOnly();
      const [year, month, day] = hoyStr.split('-').map(Number);
      fechaConsulta = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    const { gte: fechaGte, lt: fechaLt } = gyeDayRangeUtcFromDate(fechaConsulta);

    // Obtener información del punto
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: usuario.punto_atencion_id },
      select: { id: true, nombre: true, ciudad: true },
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Obtener el cuadre del día
    const cuadre = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: { gte: fechaGte, lt: fechaLt },
      },
      include: {
        detalles: {
          include: {
            moneda: {
              select: { id: true, codigo: true, nombre: true, simbolo: true },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    if (!cuadre) {
      return res.status(404).json({
        success: false,
        error: "No se encontró cuadre de caja para la fecha indicada",
      });
    }

    // Calcular totales
    // NOTA: ingresos_periodo y egresos_periodo no están en el modelo,
    // se calculan desde los movimientos si es necesario
    const totalMovimientos = cuadre.detalles.reduce(
      (sum, d) => sum + Number(d.movimientos_periodo || 0),
      0
    );

    const reporte = {
      cuadre_id: cuadre.id,
      fecha: fechaConsulta.toISOString().split("T")[0],
      punto_atencion: punto,
      operador: {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
      },
      detalles: cuadre.detalles.map((d) => ({
        moneda_id: d.moneda_id,
        codigo: d.moneda.codigo,
        nombre: d.moneda.nombre,
        simbolo: d.moneda.simbolo,
        saldo_apertura: Number(d.saldo_apertura),
        saldo_cierre: Number(d.saldo_cierre),
        conteo_fisico: Number(d.conteo_fisico),
        billetes: Number(d.billetes || 0),
        monedas: Number(d.monedas_fisicas || 0),
        bancos_teorico: Number(d.bancos_teorico || 0),
        conteo_bancos: Number(d.conteo_bancos || 0),
        diferencia: Number(d.diferencia || 0),
        diferencia_bancos: Number(d.diferencia_bancos || 0),
        movimientos_periodo: Number(d.movimientos_periodo || 0),
      })),
      totales: {
        movimientos: totalMovimientos,
      },
      observaciones: cuadre.observaciones,
      estado: cuadre.estado,
      fecha_cierre: cuadre.fecha_cierre?.toISOString() || null,
      created_at: cuadre.fecha.toISOString(),
    };

    res.json({
      success: true,
      data: reporte,
    });
  } catch (error) {
    logger.error("Error obteniendo reporte de operador", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/cierre-reporte/admin
 * Obtiene el reporte completo de cierres para administradores
 * Solo accesible para ADMIN y SUPER_USUARIO
 */
router.get("/admin", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as { id: string; rol: string } | undefined;

    if (!["ADMIN", "SUPER_USUARIO"].includes(usuario?.rol || "")) {
      return res.status(403).json({
        success: false,
        error: "No tiene permisos para acceder a esta información",
      });
    }

    const { fecha } = req.query;
    let fechaConsulta: Date;

    if (fecha && typeof fecha === "string") {
      try {
        const [year, month, day] = fecha.split('-').map(Number);
        fechaConsulta = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      } catch {
        return res.status(400).json({
          success: false,
          error: "Formato de fecha inválido. Use YYYY-MM-DD",
        });
      }
    } else {
      // Por defecto, mostrar el día anterior
      const hoyStr = todayGyeDateOnly();
      const [year, month, day] = hoyStr.split('-').map(Number);
      fechaConsulta = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0));
    }

    const { gte: fechaGte, lt: fechaLt } = gyeDayRangeUtcFromDate(fechaConsulta);
    const fechaStr = fechaConsulta.toISOString().split("T")[0];

    // Obtener todos los puntos activos
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, ciudad: true },
      orderBy: { nombre: "asc" },
    });

    // Obtener cierres de la fecha
    const cierres = await prisma.cuadreCaja.findMany({
      where: {
        fecha: { gte: fechaGte, lt: fechaLt },
        estado: "CERRADO",
      },
      include: {
        puntoAtencion: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true } },
        detalles: {
          include: {
            moneda: { select: { codigo: true, nombre: true } },
          },
        },
      },
    });

    // Obtener jornadas de la fecha
    const jornadas = await prisma.jornada.findMany({
      where: {
        fecha_inicio: { gte: fechaGte, lt: fechaLt },
      },
      select: {
        usuario_id: true,
        punto_atencion_id: true,
        fecha_inicio: true,
        fecha_salida: true,
        estado: true,
      },
    });

    // Crear mapa de cierres y jornadas por punto
    const cierresPorPunto = new Map(cierres.map((c) => [c.punto_atencion_id, c]));
    const jornadasPorPunto = new Map(
      jornadas.map((j) => [j.punto_atencion_id, j])
    );

    // Construir reporte
    const puntosReporte = puntos.map((punto) => {
      const cierre = cierresPorPunto.get(punto.id);
      const jornada = jornadasPorPunto.get(punto.id);

      return {
        punto_id: punto.id,
        punto_nombre: punto.nombre,
        ciudad: punto.ciudad,
        tiene_cierre: !!cierre,
        cierre: cierre
          ? {
              cuadre_id: cierre.id,
              usuario_id: cierre.usuario_id,
              usuario_nombre: cierre.usuario.nombre,
              fecha_cierre: cierre.fecha_cierre?.toISOString() || "",
              estado: cierre.estado,
              observaciones: cierre.observaciones,
              detalles: cierre.detalles.map((d) => ({
                moneda_codigo: d.moneda.codigo,
                moneda_nombre: d.moneda.nombre,
                saldo_apertura: Number(d.saldo_apertura),
                saldo_cierre: Number(d.saldo_cierre),
                conteo_fisico: Number(d.conteo_fisico),
                diferencia: Number(d.diferencia || 0),
                billetes: Number(d.billetes || 0),
                monedas: Number(d.monedas_fisicas || 0),
              })),
              totales: {
                ingresos: Number(cierre.total_ingresos || 0),
                egresos: Number(cierre.total_egresos || 0),
              },
            }
          : undefined,
        jornada: jornada
          ? {
              hora_inicio: jornada.fecha_inicio.toISOString(),
              hora_salida: jornada.fecha_salida?.toISOString() || null,
              estado: jornada.estado,
            }
          : undefined,
      };
    });

    const puntosConCierre = puntosReporte.filter((p) => p.tiene_cierre).length;

    res.json({
      success: true,
      data: {
        fecha_consultada: fechaStr,
        estadisticas: {
          total_puntos: puntos.length,
          puntos_con_cierre: puntosConCierre,
          puntos_sin_cierre: puntos.length - puntosConCierre,
          porcentaje_cumplimiento:
            puntos.length > 0
              ? Math.round((puntosConCierre / puntos.length) * 100)
              : 0,
        },
        puntos: puntosReporte,
      },
    });
  } catch (error) {
    logger.error("Error obteniendo reporte de admin", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/cierre-reporte/validar
 * Valida si un cierre puede realizarse
 * Verifica: conteos completos, diferencias dentro de tolerancia, desglose correcto
 */
router.get("/validar", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as {
      id: string;
      rol: string;
      punto_atencion_id: string | null;
    } | undefined;

    const { puntoId, fecha } = req.query;
    const puntoIdReal = (puntoId as string) || usuario?.punto_atencion_id;

    if (!puntoIdReal) {
      return res.status(400).json({
        success: false,
        error: "Debe especificar un punto de atención",
      });
    }

    // Verificar permisos
    if (
      usuario?.rol === "OPERADOR" &&
      usuario?.punto_atencion_id !== puntoIdReal
    ) {
      return res.status(403).json({
        success: false,
        error: "No tiene permisos para validar este punto",
      });
    }

    let fechaConsulta: Date;
    if (fecha && typeof fecha === "string") {
      const [year, month, day] = fecha.split('-').map(Number);
      fechaConsulta = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      const hoyStr = todayGyeDateOnly();
      const [year, month, day] = hoyStr.split('-').map(Number);
      fechaConsulta = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    const { gte: fechaGte, lt: fechaLt } = gyeDayRangeUtcFromDate(fechaConsulta);

    // Obtener monedas activas
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true },
    });

    // Obtener cuadre
    const cuadre = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoIdReal,
        fecha: { gte: fechaGte, lt: fechaLt },
      },
      include: {
        detalles: true,
      },
    });

    const errores: Array<{
      tipo: "INCOMPLETO" | "DIFERENCIA" | "DESGLOSE" | "SIN_JORNADA";
      moneda_codigo?: string;
      mensaje: string;
      severidad: "ERROR" | "ADVERTENCIA";
    }> = [];

    const advertencias: Array<{ tipo: string; mensaje: string }> = [];

    // Validar jornada activa (solo para operadores)
    if (usuario?.rol === "OPERADOR") {
      const jornada = await prisma.jornada.findFirst({
        where: {
          usuario_id: usuario.id,
          punto_atencion_id: puntoIdReal,
          fecha_salida: null,
          estado: { in: ["ACTIVO", "ALMUERZO"] },
        },
      });

      if (!jornada) {
        errores.push({
          tipo: "SIN_JORNADA",
          mensaje: "No tiene una jornada activa. Debe iniciar jornada antes de cerrar caja.",
          severidad: "ERROR",
        });
      }
    }

    // Validar que no esté ya cerrado
    if (cuadre?.estado === "CERRADO") {
      errores.push({
        tipo: "INCOMPLETO",
        mensaje: "El cuadre de caja ya está cerrado para este día",
        severidad: "ERROR",
      });
    }

    if (!cuadre || cuadre.detalles.length === 0) {
      // No hay cuadre, validar que no haya movimientos pendientes
      const { gte, lt } = gyeDayRangeUtcFromDate(fechaConsulta);
      
      const movimientos = await prisma.movimientoSaldo.count({
        where: {
          punto_atencion_id: puntoIdReal,
          fecha: { gte, lt },
        },
      });

      if (movimientos > 0) {
        advertencias.push({
          tipo: "SIN_CUADRE",
          mensaje: `Hay ${movimientos} movimientos sin cuadre. Se creará automáticamente.`,
        });
      }
    } else {
      // Validar cada detalle
      for (const detalle of cuadre.detalles) {
        const moneda = monedas.find((m) => m.id === detalle.moneda_id);
        const codigo = moneda?.codigo || "???";
        const tolerancia = codigo === "USD" ? 1.0 : 0.01;

        // Validar conteo completado
        if (detalle.conteo_fisico === null || detalle.conteo_fisico === undefined) {
          errores.push({
            tipo: "INCOMPLETO",
            moneda_codigo: codigo,
            mensaje: `${codigo}: No se ha registrado el conteo físico`,
            severidad: "ERROR",
          });
          continue;
        }

        const conteoFisico = Number(detalle.conteo_fisico);
        const saldoCierre = Number(detalle.saldo_cierre);
        const diferencia = Math.abs(conteoFisico - saldoCierre);

        // Validar diferencia dentro de tolerancia
        if (diferencia > tolerancia) {
          errores.push({
            tipo: "DIFERENCIA",
            moneda_codigo: codigo,
            mensaje: `${codigo}: Diferencia de $${diferencia.toFixed(2)} (tolerancia: $${tolerancia})`,
            severidad: "ERROR",
          });
        } else if (diferencia > 0) {
          advertencias.push({
            tipo: "DIFERENCIA_MENOR",
            mensaje: `${codigo}: Diferencia menor a la tolerancia ($${diferencia.toFixed(2)})`,
          });
        }

        // Validar desglose
        const billetes = Number(detalle.billetes || 0);
        const monedasFisicas = Number(detalle.monedas_fisicas || 0);
        const sumaDesglose = billetes + monedasFisicas;

        if (Math.abs(sumaDesglose - conteoFisico) > 0.01) {
          errores.push({
            tipo: "DESGLOSE",
            moneda_codigo: codigo,
            mensaje: `${codigo}: Billetes (${billetes}) + Monedas (${monedasFisicas}) ≠ Conteo (${conteoFisico})`,
            severidad: "ERROR",
          });
        }
      }

      // Validar monedas con movimientos pero sin detalle en cuadre
      const monedasEnCuadre = new Set(cuadre.detalles.map((d) => d.moneda_id));
      const { gte, lt } = gyeDayRangeUtcFromDate(fechaConsulta);
      
      const movimientosOtrasMonedas = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoIdReal,
          fecha: { gte, lt },
          moneda_id: { notIn: Array.from(monedasEnCuadre) },
        },
        include: { moneda: true },
      });

      if (movimientosOtrasMonedas.length > 0) {
        advertencias.push({
          tipo: "MONEDAS_ADICIONALES",
          mensaje: `Hay movimientos en monedas no incluidas en el cuadre`,
        });
      }
    }

    res.json({
      success: true,
      data: {
        valido: errores.filter((e) => e.severidad === "ERROR").length === 0,
        errores,
        advertencias,
      },
    });
  } catch (error) {
    logger.error("Error validando cierre", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * GET /api/cierre-reporte/historial/:puntoId
 * Obtiene el historial de cierres de un punto específico
 */
router.get("/historial/:puntoId", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user as { id: string; rol: string } | undefined;
    const { puntoId } = req.params;
    const { dias = "30" } = req.query;

    // Verificar permisos
    if (usuario?.rol === "OPERADOR") {
      const user = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: { punto_atencion_id: true },
      });
      if (user?.punto_atencion_id !== puntoId) {
        return res.status(403).json({
          success: false,
          error: "No tiene permisos para ver este historial",
        });
      }
    }

    const diasNum = parseInt(dias as string) || 30;
    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - diasNum);

    const cierres = await prisma.cuadreCaja.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha: { gte: fechaDesde },
        estado: "CERRADO",
      },
      include: {
        usuario: { select: { nombre: true } },
        detalles: {
          include: {
            moneda: { select: { codigo: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const historial = cierres.map((c) => ({
      cuadre_id: c.id,
      fecha: c.fecha.toISOString().split("T")[0],
      estado: c.estado,
      usuario_nombre: c.usuario.nombre,
      total_diferencias: c.detalles.reduce(
        (sum, d) => sum + Math.abs(Number(d.diferencia || 0)),
        0
      ),
      diferencias: c.detalles
        .filter((d) => Math.abs(Number(d.diferencia || 0)) > 0.01)
        .map((d) => ({
          moneda_codigo: d.moneda.codigo,
          diferencia: Number(d.diferencia),
        })),
    }));

    res.json({
      success: true,
      data: historial,
    });
  } catch (error) {
    logger.error("Error obteniendo historial", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
