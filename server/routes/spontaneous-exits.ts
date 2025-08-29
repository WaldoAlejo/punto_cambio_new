import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

// Schema para crear salida espontánea
const createExitSchema = z.object({
  motivo: z.enum([
    "BANCO",
    "DILIGENCIA_PERSONAL",
    "TRAMITE_GOBIERNO",
    "EMERGENCIA_MEDICA",
    "OTRO",
  ]),
  descripcion: z.string().optional(),
  ubicacion_salida: z
    .object({
      lat: z.number(),
      lng: z.number(),
      direccion: z.string().optional(),
    })
    .optional(),
});

// Schema para marcar regreso
const returnExitSchema = z.object({
  ubicacion_regreso: z
    .object({
      lat: z.number(),
      lng: z.number(),
      direccion: z.string().optional(),
    })
    .optional(),
});

// Obtener salidas espontáneas
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

      const whereClause: Record<string, unknown> = {};

      // Si es operador o administrativo, solo ver sus propias salidas
      if (req.user?.rol === "OPERADOR" || req.user?.rol === "ADMINISTRATIVO") {
        whereClause.usuario_id = req.user.id;
      }

      // Si se especifica un usuario, filtrar por él (solo admins)
      if (
        req.query.usuario_id &&
        ["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")
      ) {
        whereClause.usuario_id = req.query.usuario_id as string;
      }

      const exits = await prisma.salidaEspontanea.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          usuarioAprobador: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
        orderBy: {
          fecha_salida: "desc",
        },
      });

      const formattedExits = exits.map((exit) => ({
        ...exit,
        fecha_salida: exit.fecha_salida.toISOString(),
        fecha_regreso: exit.fecha_regreso?.toISOString() || null,
        created_at: exit.created_at.toISOString(),
        updated_at: exit.updated_at.toISOString(),
      }));

      logger.info("Salidas espontáneas obtenidas", {
        count: formattedExits.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        exits: formattedExits,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener salidas espontáneas", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener salidas espontáneas",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Crear nueva salida espontánea
router.post(
  "/",
  authenticateToken,
  validate(createExitSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { motivo, descripcion, ubicacion_salida } = req.body;

      if (!req.user?.punto_atencion_id) {
        res.status(400).json({
          error: "Usuario debe tener un punto de atención asignado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const newExit = await prisma.salidaEspontanea.create({
        data: {
          usuario_id: req.user.id,
          punto_atencion_id: req.user.punto_atencion_id,
          motivo,
          descripcion,
          ubicacion_salida: ubicacion_salida || null,
          estado: "ACTIVO",
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      logger.info("Salida espontánea creada", {
        exitId: newExit.id,
        userId: req.user.id,
        motivo,
      });

      res.status(201).json({
        exit: {
          ...newExit,
          fecha_salida: newExit.fecha_salida.toISOString(),
          fecha_regreso: newExit.fecha_regreso?.toISOString() || null,
          created_at: newExit.created_at.toISOString(),
          updated_at: newExit.updated_at.toISOString(),
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear salida espontánea", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al crear salida espontánea",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Marcar regreso de salida espontánea
router.patch(
  "/:exitId/return",
  authenticateToken,
  validate(returnExitSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { exitId } = req.params;
      const { ubicacion_regreso } = req.body;

      const exit = await prisma.salidaEspontanea.findUnique({
        where: { id: exitId },
      });

      if (!exit) {
        res.status(404).json({
          error: "Salida espontánea no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verificar que el usuario puede marcar el regreso
      if (
        exit.usuario_id !== req.user?.id &&
        !["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")
      ) {
        res.status(403).json({
          error: "No tienes permisos para marcar el regreso de esta salida",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (exit.fecha_regreso) {
        res.status(400).json({
          error: "El regreso ya ha sido marcado para esta salida",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const fechaRegreso = new Date();
      const duracionMinutos = Math.round(
        (fechaRegreso.getTime() - exit.fecha_salida.getTime()) / (1000 * 60)
      );

      const updatedExit = await prisma.salidaEspontanea.update({
        where: { id: exitId },
        data: {
          fecha_regreso: fechaRegreso,
          ubicacion_regreso: ubicacion_regreso || null,
          duracion_minutos: duracionMinutos,
          estado: "COMPLETADO",
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      logger.info("Regreso de salida espontánea marcado", {
        exitId,
        duracionMinutos,
        updatedBy: req.user?.id,
      });

      res.status(200).json({
        exit: {
          ...updatedExit,
          fecha_salida: updatedExit.fecha_salida.toISOString(),
          fecha_regreso: updatedExit.fecha_regreso?.toISOString() || null,
          created_at: updatedExit.created_at.toISOString(),
          updated_at: updatedExit.updated_at.toISOString(),
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al marcar regreso de salida espontánea", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al marcar regreso de salida espontánea",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
