import express from "express";
import { PrismaClient, Prisma, EstadoJornada } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

const scheduleSchema = z
  .object({
    usuario_id: z.string().uuid(),
    punto_atencion_id: z.string().uuid(),
    fecha_inicio: z.string().datetime().optional(),
    fecha_almuerzo: z.string().datetime().optional(),
    fecha_regreso: z.string().datetime().optional(),
    fecha_salida: z.string().datetime().optional(),
    ubicacion_inicio: z
      .object({
        lat: z.number(),
        lng: z.number(),
        direccion: z.string().optional(),
      })
      .optional(),
    ubicacion_salida: z
      .object({
        lat: z.number(),
        lng: z.number(),
        direccion: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.fecha_inicio ||
      data.fecha_almuerzo ||
      data.fecha_regreso ||
      data.fecha_salida,
    {
      message:
        "Se requiere al menos una fecha (inicio, almuerzo, regreso o salida)",
    }
  );

// Obtener jornadas
router.get("/", authenticateToken, async (req, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    const whereClause: Record<string, unknown> = {};

    if (req.user?.rol === "OPERADOR") {
      whereClause.usuario_id = req.user.id;
    }

    if (
      req.query.usuario_id &&
      ["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")
    ) {
      whereClause.usuario_id = req.query.usuario_id as string;
    }

    if (req.query.fecha) {
      const fecha = new Date(req.query.fecha as string);
      const siguienteDia = new Date(fecha);
      siguienteDia.setDate(siguienteDia.getDate() + 1);
      whereClause.fecha_inicio = {
        gte: fecha,
        lt: siguienteDia,
      };
    }

    const schedules = await prisma.jornada.findMany({
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
            direccion: true,
            ciudad: true,
            provincia: true,
            codigo_postal: true,
            activo: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: {
        fecha_inicio: "desc",
      },
    });

    const formattedSchedules = schedules.map((s) => ({
      ...s,
      fecha_inicio: s.fecha_inicio.toISOString(),
      fecha_almuerzo: s.fecha_almuerzo?.toISOString() || null,
      fecha_regreso: s.fecha_regreso?.toISOString() || null,
      fecha_salida: s.fecha_salida?.toISOString() || null,
    }));

    logger.info("Horarios obtenidos", {
      count: formattedSchedules.length,
      requestedBy: req.user?.id,
    });

    res.status(200).json({
      schedules: formattedSchedules,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al obtener horarios", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
    });

    res.status(500).json({
      error: "Error al obtener horarios",
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// Crear o actualizar jornada
router.post(
  "/",
  authenticateToken,
  validate(scheduleSchema),
  async (req, res) => {
    try {
      const {
        usuario_id,
        punto_atencion_id,
        fecha_inicio,
        fecha_almuerzo,
        fecha_regreso,
        fecha_salida,
        ubicacion_inicio,
        ubicacion_salida,
      } = req.body;

      if (req.user?.rol === "OPERADOR" && usuario_id !== req.user.id) {
        res.status(403).json({
          error: "Los operadores solo pueden gestionar sus propias jornadas",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validar que los operadores no puedan usar el punto principal
      if (req.user?.rol === "OPERADOR") {
        const puntoAtencion = await prisma.puntoAtencion.findUnique({
          where: { id: punto_atencion_id },
          select: { es_principal: true, nombre: true },
        });

        if (puntoAtencion?.es_principal) {
          res.status(403).json({
            error:
              "Los operadores no pueden iniciar jornada en el punto principal",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const existingSchedule = await prisma.jornada.findFirst({
        where: {
          usuario_id,
          fecha_inicio: {
            gte: hoy,
            lt: manana,
          },
          OR: [
            { estado: EstadoJornada.ACTIVO },
            { estado: EstadoJornada.ALMUERZO },
          ],
        },
      });

      let schedule;

      if (existingSchedule) {
        const updateData: Prisma.JornadaUpdateInput = {};

        if (fecha_almuerzo) {
          updateData.fecha_almuerzo = new Date(fecha_almuerzo);
          updateData.estado = EstadoJornada.ALMUERZO;
        }
        if (fecha_regreso) {
          updateData.fecha_regreso = new Date(fecha_regreso);
          updateData.estado = EstadoJornada.ACTIVO;
        }
        if (fecha_salida) {
          updateData.fecha_salida = new Date(fecha_salida);
          updateData.estado = EstadoJornada.COMPLETADO;
          await prisma.usuario.update({
            where: { id: usuario_id },
            data: { punto_atencion_id: null },
          });
        }
        if (ubicacion_salida) {
          updateData.ubicacion_salida =
            ubicacion_salida as Prisma.InputJsonValue;
        }

        schedule = await prisma.jornada.update({
          where: { id: existingSchedule.id },
          data: updateData,
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
                direccion: true,
                ciudad: true,
                provincia: true,
                codigo_postal: true,
                activo: true,
                created_at: true,
                updated_at: true,
              },
            },
          },
        });
      } else {
        schedule = await prisma.jornada.create({
          data: {
            usuario_id,
            punto_atencion_id,
            fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
            ubicacion_inicio: ubicacion_inicio || null,
            estado: EstadoJornada.ACTIVO,
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
                direccion: true,
                ciudad: true,
                provincia: true,
                codigo_postal: true,
                activo: true,
                created_at: true,
                updated_at: true,
              },
            },
          },
        });
      }

      if (!fecha_salida) {
        await prisma.usuario.update({
          where: { id: usuario_id },
          data: { punto_atencion_id },
        });
      }

      logger.info("Jornada procesada", {
        scheduleId: schedule.id,
        userId: usuario_id,
        action: existingSchedule ? "updated" : "created",
        requestedBy: req.user?.id,
      });

      res.status(existingSchedule ? 200 : 201).json({
        schedule: {
          ...schedule,
          fecha_inicio: schedule.fecha_inicio.toISOString(),
          fecha_almuerzo: schedule.fecha_almuerzo?.toISOString() || null,
          fecha_regreso: schedule.fecha_regreso?.toISOString() || null,
          fecha_salida: schedule.fecha_salida?.toISOString() || null,
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al procesar jornada", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al procesar jornada",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Obtener jornada activa
router.get("/active", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: "Usuario no autenticado",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const activeSchedule = await prisma.jornada.findFirst({
      where: {
        usuario_id: userId,
        fecha_inicio: {
          gte: hoy,
          lt: manana,
        },
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
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
            direccion: true,
            ciudad: true,
            provincia: true,
            codigo_postal: true,
            activo: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!activeSchedule) {
      res.status(200).json({
        schedule: null,
        success: true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      schedule: {
        ...activeSchedule,
        fecha_inicio: activeSchedule.fecha_inicio.toISOString(),
        fecha_almuerzo: activeSchedule.fecha_almuerzo?.toISOString() || null,
        fecha_regreso: activeSchedule.fecha_regreso?.toISOString() || null,
        fecha_salida: activeSchedule.fecha_salida?.toISOString() || null,
      },
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al obtener jornada activa", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
    });

    res.status(500).json({
      error: "Error al obtener jornada activa",
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
