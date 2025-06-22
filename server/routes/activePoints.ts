import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js"; // ✅ IMPORTAR middleware

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos activos con jornada activa más reciente
router.get(
  "/",
  authenticateToken, // ✅ Middleware agregado
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const puntos = await prisma.puntoAtencion.findMany({
        where: {
          activo: true,
          jornadas: {
            some: {
              estado: "ACTIVO",
            },
          },
        },
        include: {
          jornadas: {
            where: {
              estado: "ACTIVO",
            },
            orderBy: {
              fecha_inicio: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          nombre: "asc",
        },
      });

      const formatted = puntos.map((punto) => {
        const jornada = punto.jornadas[0];
        return {
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
          jornada: jornada
            ? {
                id: jornada.id,
                fecha_inicio: jornada.fecha_inicio.toISOString(),
                fecha_almuerzo: jornada.fecha_almuerzo?.toISOString() || null,
                fecha_regreso: jornada.fecha_regreso?.toISOString() || null,
                fecha_salida: jornada.fecha_salida?.toISOString() || null,
                estado: jornada.estado,
              }
            : null,
        };
      });

      logger.info("Puntos activos con jornada obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id, // ✅ Ahora sí está tipado correctamente
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos activos con jornada", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos activos con jornada",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
