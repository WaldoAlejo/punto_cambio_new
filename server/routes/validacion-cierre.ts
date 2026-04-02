/**
 * Endpoint para validación de cierre de caja
 * Compara apertura vs cierre y genera reporte de inconsistencias
 */

import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();

/**
 * GET /api/validacion-cierre/comparacion
 * Compara el cierre de un día con la apertura del día siguiente
 */
router.get("/comparacion", authenticateToken, async (req, res) => {
  try {
    const { fecha, punto_id } = req.query;
    
    if (!fecha || typeof fecha !== "string") {
      return res.status(400).json({
        success: false,
        error: "Se requiere el parámetro fecha (YYYY-MM-DD)"
      });
    }

    const puntoId = punto_id as string | undefined;
    const usuario = req.user as any;
    
    // Si no es admin, solo puede ver su propio punto
    let puntoConsultaId = puntoId;
    if (!["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(usuario.rol)) {
      puntoConsultaId = usuario.punto_atencion_id;
    }

    if (!puntoConsultaId) {
      return res.status(400).json({
        success: false,
        error: "Se requiere un punto de atención"
      });
    }

    // Calcular fechas
    const fechaBase = new Date(`${fecha}T12:00:00`);
    const { gte: inicioDia, lt: finDia } = gyeDayRangeUtcFromDate(fechaBase);
    
    // Fecha del día siguiente
    const fechaSiguiente = new Date(fechaBase);
    fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
    const { gte: inicioDiaSiguiente, lt: finDiaSiguiente } = gyeDayRangeUtcFromDate(fechaSiguiente);

    // Obtener punto
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoConsultaId },
      select: { id: true, nombre: true }
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado"
      });
    }

    // Obtener cuadre del día (cierre)
    const cuadreCierre = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoConsultaId,
        fecha: { gte: inicioDia, lt: finDia },
      },
      include: {
        detalles: {
          include: { moneda: true }
        }
      }
    });

    // Obtener cuadre del día siguiente (apertura)
    const cuadreApertura = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: puntoConsultaId,
        fecha: { gte: inicioDiaSiguiente, lt: finDiaSiguiente },
      },
      include: {
        detalles: {
          include: { moneda: true }
        }
      }
    });

    // Obtener apertura de caja del día siguiente
    const aperturaCaja = await prisma.aperturaCaja.findFirst({
      where: {
        punto_atencion_id: puntoConsultaId,
        fecha: { gte: inicioDiaSiguiente, lt: finDiaSiguiente },
      }
    });

    // Construir comparación por moneda
    const monedas = new Map<string, {
      moneda_id: string;
      codigo: string;
      nombre: string;
      simbolo: string;
      cierre_dia_anterior: number | null;
      apertura_dia_actual: number | null;
      diferencia: number | null;
      consistente: boolean;
    }>();

    // Agregar monedas del cierre
    if (cuadreCierre) {
      for (const d of cuadreCierre.detalles) {
        monedas.set(d.moneda_id, {
          moneda_id: d.moneda_id,
          codigo: d.moneda.codigo,
          nombre: d.moneda.nombre,
          simbolo: d.moneda.simbolo,
          cierre_dia_anterior: Number(d.conteo_fisico),
          apertura_dia_actual: null,
          diferencia: null,
          consistente: false
        });
      }
    }

    // Agregar/actualizar con monedas de la apertura
    if (cuadreApertura) {
      for (const d of cuadreApertura.detalles) {
        const existente = monedas.get(d.moneda_id);
        if (existente) {
          existente.apertura_dia_actual = Number(d.saldo_apertura);
          existente.diferencia = Number(d.saldo_apertura) - (existente.cierre_dia_anterior || 0);
          existente.consistente = Math.abs(existente.diferencia) < 0.01;
        } else {
          monedas.set(d.moneda_id, {
            moneda_id: d.moneda_id,
            codigo: d.moneda.codigo,
            nombre: d.moneda.nombre,
            simbolo: d.moneda.simbolo,
            cierre_dia_anterior: null,
            apertura_dia_actual: Number(d.saldo_apertura),
            diferencia: null,
            consistente: false
          });
        }
      }
    }

    const comparacionMonedas = Array.from(monedas.values());
    const todasConsistentes = comparacionMonedas.every(m => m.consistente);
    const hayInconsistencias = comparacionMonedas.some(m => !m.consistente && m.cierre_dia_anterior !== null && m.apertura_dia_actual !== null);

    return res.json({
      success: true,
      data: {
        punto: {
          id: punto.id,
          nombre: punto.nombre
        },
        fecha_cierre: fecha,
        fecha_apertura: fechaSiguiente.toISOString().split("T")[0],
        cuadre_cierre_id: cuadreCierre?.id || null,
        cuadre_apertura_id: cuadreApertura?.id || null,
        apertura_caja_id: aperturaCaja?.id || null,
        estado: cuadreCierre?.estado || "NO_ENCONTRADO",
        comparacion_monedas: comparacionMonedas,
        resumen: {
          total_monedas: comparacionMonedas.length,
          consistentes: comparacionMonedas.filter(m => m.consistente).length,
          inconsistentes: comparacionMonedas.filter(m => !m.consistente && m.cierre_dia_anterior !== null && m.apertura_dia_actual !== null).length,
          faltantes: comparacionMonedas.filter(m => m.cierre_dia_anterior === null || m.apertura_dia_actual === null).length,
          todas_consistentes: todasConsistentes,
          hay_inconsistencias: hayInconsistencias
        }
      }
    });

  } catch (error) {
    logger.error("Error en validación de cierre", {
      error: error instanceof Error ? error.message : String(error),
      user_id: (req.user as any)?.id
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor"
    });
  }
});

/**
 * GET /api/validacion-cierre/reporte-inconsistencias
 * Reporte de todas las inconsistencias entre cierres y aperturas
 */
router.get("/reporte-inconsistencias", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    
    const fechaDesde = desde && typeof desde === "string" 
      ? new Date(`${desde}T00:00:00.000Z`)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás
      
    const fechaHasta = hasta && typeof hasta === "string"
      ? new Date(`${hasta}T23:59:59.999Z`)
      : new Date();

    // Obtener todos los puntos
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true }
    });

    const inconsistencias = [];

    for (const punto of puntos) {
      // Obtener cuadres cerrados en el rango
      const cuadres = await prisma.cuadreCaja.findMany({
        where: {
          punto_atencion_id: punto.id,
          estado: "CERRADO",
          fecha: { gte: fechaDesde, lte: fechaHasta }
        },
        include: {
          detalles: {
            include: { moneda: true }
          }
        },
        orderBy: { fecha: "asc" }
      });

      for (const cuadre of cuadres) {
        // Buscar cuadre del día siguiente
        const fechaCuadre = new Date(cuadre.fecha);
        const fechaSiguiente = new Date(fechaCuadre);
        fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
        
        const inicioDiaSiguiente = new Date(fechaSiguiente.toISOString().split("T")[0] + "T00:00:00.000Z");
        const finDiaSiguiente = new Date(fechaSiguiente.toISOString().split("T")[0] + "T23:59:59.999Z");

        const cuadreSiguiente = await prisma.cuadreCaja.findFirst({
          where: {
            punto_atencion_id: punto.id,
            fecha: { gte: inicioDiaSiguiente, lt: finDiaSiguiente }
          },
          include: {
            detalles: {
              include: { moneda: true }
            }
          }
        });

        if (cuadreSiguiente) {
          // Comparar cada moneda
          for (const detalle of cuadre.detalles) {
            const detalleSiguiente = cuadreSiguiente.detalles.find(
              d => d.moneda_id === detalle.moneda_id
            );

            if (detalleSiguiente) {
              const cierre = Number(detalle.conteo_fisico);
              const apertura = Number(detalleSiguiente.saldo_apertura);
              const diferencia = apertura - cierre;

              if (Math.abs(diferencia) >= 0.01) {
                inconsistencias.push({
                  punto_id: punto.id,
                  punto_nombre: punto.nombre,
                  fecha_cierre: cuadre.fecha.toISOString().split("T")[0],
                  fecha_apertura: cuadreSiguiente.fecha.toISOString().split("T")[0],
                  moneda_codigo: detalle.moneda.codigo,
                  moneda_nombre: detalle.moneda.nombre,
                  cierre_dia_anterior: cierre,
                  apertura_dia_actual: apertura,
                  diferencia: diferencia,
                  cuadre_cierre_id: cuadre.id,
                  cuadre_apertura_id: cuadreSiguiente.id
                });
              }
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      data: {
        total_inconsistencias: inconsistencias.length,
        inconsistencias: inconsistencias.sort((a, b) => 
          new Date(b.fecha_cierre).getTime() - new Date(a.fecha_cierre).getTime()
        )
      }
    });

  } catch (error) {
    logger.error("Error generando reporte de inconsistencias", {
      error: error instanceof Error ? error.message : String(error),
      user_id: (req.user as any)?.id
    });
    return res.status(500).json({
      success: false,
      error: "Error interno del servidor"
    });
  }
});

export default router;
