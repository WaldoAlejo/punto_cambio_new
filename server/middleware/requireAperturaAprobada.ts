/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MIDDLEWARE: REQUERIR APERTURA DE CAJA APROBADA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este middleware verifica que el operador tenga una apertura de caja
 * aprobada antes de permitir realizar operaciones.
 * 
 * Uso: Agregar a rutas que requieran apertura previa (exchanges, transfers, etc.)
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";
import { obtenerEstadoAperturaOperativa } from "../utils/aperturaCajaRequirements.js";

// Usar el tipo Request estándar sin extender user
// El user viene del middleware auth.ts

/**
 * Middleware que verifica si el usuario tiene una apertura de caja aprobada
 */
export async function requireAperturaAprobada(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const estado = await obtenerEstadoAperturaOperativa(req.user);

    if (!estado.puede_operar) {
      const statusCode = estado.code === "NO_AUTH" ? 401 : estado.code === "NO_PUNTO" ? 400 : 403;

      res.status(statusCode).json({
        success: false,
        error: estado.error || "Apertura de caja no aprobada.",
        code: estado.code,
        requiere_inicio_jornada: estado.requiere_inicio_jornada,
        requiere_apertura: estado.requiere_apertura,
        requiere_confirmacion: estado.requiere_confirmacion,
        requiere_cuadre_obligatorio: estado.requiere_cuadre_obligatorio,
        monedas_obligatorias: estado.monedas_obligatorias,
        monedas_obligatorias_guardadas: estado.monedas_obligatorias_guardadas,
        monedas_obligatorias_pendientes: estado.monedas_obligatorias_pendientes,
        jornada_id: estado.jornada?.id,
        apertura_id: estado.apertura?.id,
        apertura_estado: estado.apertura?.estado,
      });
      return;
    }

    (req as any).jornada = estado.jornada;
    (req as any).apertura = estado.apertura;

    next();
  } catch (error) {
    logger.error("Error en middleware requireAperturaAprobada", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      code: "INTERNAL_ERROR",
    });
  }
}

/**
 * Middleware opcional que solo verifica y agrega info al request,
 * pero no bloquea la operación
 */
export async function checkApertura(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const estado = await obtenerEstadoAperturaOperativa(req.user);

    (req as any).jornada = estado.jornada;
    (req as any).apertura = estado.apertura;

    next();
  } catch (error) {
    // No bloquear, solo continuar
    next();
  }
}
