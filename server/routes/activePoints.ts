import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos libres (sin jornada activa)
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      // Obtener puntos activos que NO tienen jornada activa hoy (día GYE)
      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      // Reglas por rol para listar puntos disponibles:
      // - OPERADOR: no ver puntos que estén ocupados por OTROS operadores hoy
      // - ADMINISTRATIVO: puede ver todos los puntos activos
      // - ADMIN/SUPER_USUARIO: listado completo para diagnóstico
      const isAdminLike = ["ADMIN", "SUPER_USUARIO"].includes(
        req.user?.rol || ""
      );
      const isOperador = req.user?.rol === "OPERADOR";

      const puntosLibres = await prisma.puntoAtencion.findMany({
        where: isOperador
          ? {
              activo: true,
              NOT: {
                jornadas: {
                  some: {
                    estado: { in: ["ACTIVO", "ALMUERZO"] },
                    fecha_inicio: { gte: hoy, lt: manana },
                  },
                },
              },
            }
          : { activo: true },
        orderBy: { nombre: "asc" },
      });

      const formatted = puntosLibres.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        activo: punto.activo,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      logger.info("Puntos libres obtenidos", {
        count: formatted.length,
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

// Endpoint para obtener puntos ocupados
router.get(
  "/occupied",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      const puntosOcupados = await prisma.jornada.findMany({
        where: {
          estado: "ACTIVO",
          fecha_inicio: {
            gte: hoy,
            lt: manana,
          },
        },
        select: {
          punto_atencion_id: true,
        },
      });

      const puntosIds = puntosOcupados.map((j) => ({
        id: j.punto_atencion_id,
      }));

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
