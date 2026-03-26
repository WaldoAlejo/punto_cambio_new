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
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { EstadoApertura, EstadoJornada } from "@prisma/client";

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
    const usuarioId = req.user?.id;
    const puntoAtencionId = req.user?.punto_atencion_id;
    const rol = req.user?.rol;

    // Administradores y roles privilegiados no necesitan apertura
    if (rol === "ADMIN" || rol === "SUPER_USUARIO" || rol === "ADMINISTRATIVO") {
      return next();
    }

    if (!usuarioId) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
        code: "NO_AUTH",
      });
      return;
    }

    if (!puntoAtencionId) {
      res.status(400).json({
        success: false,
        error: "Usuario no tiene punto de atención asignado",
        code: "NO_PUNTO",
      });
      return;
    }

    // Buscar jornada activa del usuario
    const jornada = await prisma.jornada.findFirst({
      where: {
        usuario_id: usuarioId,
        punto_atencion_id: puntoAtencionId,
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
      },
      orderBy: { fecha_inicio: "desc" },
    });

    if (!jornada) {
      res.status(403).json({
        success: false,
        error: "No tiene una jornada activa. Debe iniciar jornada primero.",
        code: "NO_JORNADA",
        requiere_inicio_jornada: true,
      });
      return;
    }

    // Buscar apertura de caja asociada a la jornada
    const apertura = await prisma.aperturaCaja.findUnique({
      where: { jornada_id: jornada.id },
    });

    if (!apertura) {
      res.status(403).json({
        success: false,
        error: "Debe completar la apertura de caja antes de operar.",
        code: "NO_APERTURA",
        requiere_apertura: true,
        jornada_id: jornada.id,
      });
      return;
    }

    // Verificar estado de la apertura
    if (apertura.estado !== EstadoApertura.ABIERTA) {
      // Si está en conteo o con diferencia, no puede operar
      const mensajes: Record<string, string> = {
        [EstadoApertura.EN_CONTEO]: "Debe completar el conteo de apertura de caja.",
        [EstadoApertura.CON_DIFERENCIA]: "Su apertura tiene diferencias pendientes de aprobación por el administrador.",
        [EstadoApertura.CUADRADO]: "Su apertura está siendo procesada, espere un momento.",
      };

      res.status(403).json({
        success: false,
        error: mensajes[apertura.estado] || "Apertura de caja no aprobada.",
        code: "APERTURA_NO_APROBADA",
        apertura_estado: apertura.estado,
        requiere_apertura: apertura.estado === EstadoApertura.EN_CONTEO,
        requiere_aprobacion: apertura.estado === EstadoApertura.CON_DIFERENCIA,
        jornada_id: jornada.id,
        apertura_id: apertura.id,
      });
      return;
    }

    // Si la apertura requiere aprobación (campo booleano adicional)
    if (apertura.requiere_aprobacion) {
      res.status(403).json({
        success: false,
        error: "Su apertura de caja está pendiente de aprobación por el administrador.",
        code: "APERTURA_PENDIENTE_APROBACION",
        apertura_estado: apertura.estado,
        requiere_aprobacion: true,
        jornada_id: jornada.id,
        apertura_id: apertura.id,
      });
      return;
    }

    // Todo OK, agregar info al request para uso posterior
    (req as any).jornada = jornada;
    (req as any).apertura = apertura;

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
    const usuarioId = req.user?.id;
    const puntoAtencionId = req.user?.punto_atencion_id;

    if (!usuarioId || !puntoAtencionId) {
      return next();
    }

    const jornada = await prisma.jornada.findFirst({
      where: {
        usuario_id: usuarioId,
        punto_atencion_id: puntoAtencionId,
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
      },
      orderBy: { fecha_inicio: "desc" },
    });

    if (jornada) {
      const apertura = await prisma.aperturaCaja.findUnique({
        where: { jornada_id: jornada.id },
      });

      (req as any).jornada = jornada;
      (req as any).apertura = apertura;
    }

    next();
  } catch (error) {
    // No bloquear, solo continuar
    next();
  }
}
