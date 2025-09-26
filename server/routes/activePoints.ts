import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import { EstadoJornada } from "@prisma/client";

const router = express.Router();

// Estados que bloquean el punto (ocupado)
const ESTADOS_OCUPADOS: EstadoJornada[] = [
  EstadoJornada.ACTIVO,
  EstadoJornada.ALMUERZO,
];

/** Util: setea cabeceras no-cache */
function setNoCache(res: express.Response) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
}

/** Serialización segura de fechas */
function toISO(d: Date | null | undefined) {
  return d instanceof Date ? d.toISOString() : null;
}

/**
 * GET /api/points
 * Puntos libres (sin jornada en estado ACTIVO/ALMUERZO en el día GYE)
 * Reglas por rol:
 *  - OPERADOR: ver solo puntos activos que NO estén ocupados hoy.
 *  - ADMINISTRATIVO / ADMIN / SUPER_USUARIO: por defecto ver puntos activos (diagnóstico).
 */
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      setNoCache(res);

      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      const rol = req.user?.rol || "";
      const isOperador = rol === "OPERADOR";
      const isAdminLike =
        rol === "ADMIN" || rol === "SUPER_USUARIO" || rol === "ADMINISTRATIVO";

      // Base: puntos activos
      const whereOperador = {
        activo: true,
        NOT: {
          jornadas: {
            some: {
              estado: { in: ESTADOS_OCUPADOS },
              fecha_inicio: { gte: hoy, lt: manana },
            },
          },
        },
      };

      const whereAdminLike = { activo: true };

      const puntos = await prisma.puntoAtencion.findMany({
        where: isOperador ? whereOperador : whereAdminLike,
        select: {
          id: true,
          nombre: true,
          direccion: true,
          ciudad: true,
          provincia: true,
          codigo_postal: true,
          telefono: true,
          activo: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { nombre: "asc" },
      });

      const formatted = puntos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        direccion: p.direccion,
        ciudad: p.ciudad,
        provincia: p.provincia,
        codigo_postal: p.codigo_postal,
        telefono: p.telefono,
        activo: p.activo,
        created_at: toISO(p.created_at),
        updated_at: toISO(p.updated_at),
      }));

      logger.info("Puntos libres obtenidos", {
        count: formatted.length,
        role: rol,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos libres", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos libres",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * GET /api/points/occupied
 * Lista IDs de puntos ocupados hoy (ACTIVO o ALMUERZO en el día GYE)
 */
router.get(
  "/occupied",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      setNoCache(res);

      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      // Distinct por punto para evitar duplicados si hay más de una jornada sobre el mismo punto
      const jornadas = await prisma.jornada.findMany({
        where: {
          estado: { in: ESTADOS_OCUPADOS },
          fecha_inicio: { gte: hoy, lt: manana },
        },
        select: {
          punto_atencion_id: true,
        },
      });

      // De-dup en memoria (por si la versión de Prisma no soporta distinct en este modelo)
      const ocupadosSet = new Set<string>();
      for (const j of jornadas) {
        if (j.punto_atencion_id) ocupadosSet.add(j.punto_atencion_id);
      }
      const puntosIds = Array.from(ocupadosSet).map((id) => ({ id }));

      logger.info("Puntos ocupados obtenidos", {
        count: puntosIds.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        puntos: puntosIds,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos ocupados", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos ocupados",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
