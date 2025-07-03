import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los puntos LIBRES (activos y sin jornada ACTIVO o ALMUERZO hoy)
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      // Obtener fecha de hoy (00:00:00) y mañana (00:00:00)
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      // Buscar puntos activos que NO tengan jornada ACTIVO o ALMUERZO hoy
      const puntosLibres = await prisma.puntoAtencion.findMany({
        where: {
          activo: true,
          NOT: {
            jornadas: {
              some: {
                estado: { in: ["ACTIVO", "ALMUERZO"] },
                fecha_inicio: { gte: hoy, lt: manana },
              },
            },
          },
        },
        orderBy: { nombre: "asc" },
      });

      // Formatear respuesta
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

// Crear punto (solo admins/superusuario)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { nombre, direccion, ciudad, provincia, codigo_postal, telefono } =
        req.body;
      if (!nombre || !direccion || !ciudad) {
        res.status(400).json({
          error: "Los campos nombre, dirección y ciudad son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const createData = {
        nombre,
        direccion,
        ciudad,
        provincia: provincia || "",
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        activo: true,
      };

      const newPoint = await prisma.puntoAtencion.create({
        data: createData,
      });

      logger.info("Punto creado", {
        pointId: newPoint.id,
        nombre: newPoint.nombre,
        createdBy: req.user?.id,
      });

      res.status(201).json({
        point: newPoint,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al crear punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Cambiar el estado de un punto (activar/inactivar)
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const pointId = req.params.id;
      const existingPoint = await prisma.puntoAtencion.findUnique({
        where: { id: pointId },
      });

      if (!existingPoint) {
        res.status(404).json({
          error: "Punto de atención no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: { activo: !existingPoint.activo },
      });

      logger.info("Estado de punto cambiado", {
        pointId: updatedPoint.id,
        newStatus: updatedPoint.activo,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        point: updatedPoint,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cambiar el estado del punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al cambiar el estado del punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
