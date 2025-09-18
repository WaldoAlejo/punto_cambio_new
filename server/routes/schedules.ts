import express from "express";
import { Prisma, EstadoJornada } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import {
  gyeDayRangeUtcFromDate,
  gyeDayRangeUtcFromYMD,
  gyeParseDateOnly,
} from "../utils/timezone.js";

const router = express.Router();

// ========= Utilidades internas =========
const nocache = (res: express.Response) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
};

const safeNumber = (v: unknown, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const csvEscape = (val: unknown) => {
  const s = String(val ?? "");
  if (s.includes('"')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  if (s.includes(",") || s.includes("\n")) {
    return `"${s}"`;
  }
  return s;
};

// ========= Schemas =========
const locationSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
    direccion: z.string().optional(),
  })
  .strict();

const scheduleSchema = z
  .object({
    usuario_id: z.string().uuid(),
    punto_atencion_id: z.string().uuid(),
    fecha_inicio: z.string().datetime().optional(),
    fecha_almuerzo: z.string().datetime().optional(),
    fecha_regreso: z.string().datetime().optional(),
    fecha_salida: z.string().datetime().optional(),
    ubicacion_inicio: locationSchema.optional().nullable(),
    ubicacion_salida: locationSchema.optional().nullable(),
    /** Solo efecto para roles privilegiados */
    override: z.boolean().optional(),
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

const estadosValidos = Object.values(EstadoJornada) as string[];

const reassignSchema = z
  .object({
    usuario_id: z.string().uuid(),
    destino_punto_atencion_id: z.string().uuid().optional(),
    motivo: z.string().max(200).optional(),
    observaciones: z.string().max(500).optional(),
    finalizar: z.boolean().optional(),
  })
  .strict();

// ==============================
// GET /schedules (listado con filtros)
// ==============================
router.get("/", authenticateToken, async (req, res) => {
  try {
    nocache(res);

    const whereClause: Prisma.JornadaWhereInput = {};

    // Restricción por rol
    const rol = req.user?.rol;
    if (rol === "OPERADOR" || rol === "ADMINISTRATIVO") {
      whereClause.usuario_id = req.user!.id;
    }

    // Admin / Super pueden consultar por usuario específico
    if (
      req.query.usuario_id &&
      ["ADMIN", "SUPER_USUARIO"].includes(rol || "")
    ) {
      whereClause.usuario_id = String(req.query.usuario_id);
    }

    // Filtros de fecha
    const { fecha, from, to } = req.query as {
      fecha?: string;
      from?: string;
      to?: string;
    };

    if (fecha) {
      const { y, m, d } = gyeParseDateOnly(fecha);
      const { gte, lt } = gyeDayRangeUtcFromYMD(y, m, d);
      whereClause.fecha_inicio = { gte, lt };
    } else if (from || to) {
      let gte: Date | undefined;
      let lt: Date | undefined;
      if (from) {
        const { y, m, d } = gyeParseDateOnly(from);
        ({ gte } = gyeDayRangeUtcFromYMD(y, m, d));
      }
      if (to) {
        const { y, m, d } = gyeParseDateOnly(to);
        ({ lt } = gyeDayRangeUtcFromYMD(y, m, d));
      }
      whereClause.fecha_inicio = {
        ...(gte ? { gte } : {}),
        ...(lt ? { lt } : {}),
      } as Prisma.DateTimeFilter;
    }

    // Filtro por estados (coma-separado) — solo enum válidos
    if (req.query.estados) {
      const estados = String(req.query.estados)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => estadosValidos.includes(s));
      if (estados.length > 0) whereClause.estado = { in: estados as any };
    }

    // Paginación
    const take = Math.min(Math.max(safeNumber(req.query.limit, 50), 1), 500);
    const skip = Math.max(safeNumber(req.query.offset, 0), 0);

    const schedules = await prisma.jornada.findMany({
      where: whereClause,
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
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
      orderBy: { fecha_inicio: "desc" },
      skip,
      take,
    });

    const formatted = schedules.map((s) => ({
      ...s,
      fecha_inicio: s.fecha_inicio.toISOString(),
      fecha_almuerzo: s.fecha_almuerzo?.toISOString() || null,
      fecha_regreso: s.fecha_regreso?.toISOString() || null,
      fecha_salida: s.fecha_salida?.toISOString() || null,
    }));

    logger.info("Horarios obtenidos", {
      count: formatted.length,
      requestedBy: req.user?.id,
      filters: { fecha, from, to, estados: req.query.estados },
    });

    if (String(req.query.format || "").toLowerCase() === "csv") {
      const header = [
        "id",
        "usuario_id",
        "usuario_nombre",
        "usuario_username",
        "punto_atencion_id",
        "punto_nombre",
        "estado",
        "fecha_inicio",
        "fecha_almuerzo",
        "fecha_regreso",
        "fecha_salida",
      ];
      const rows = formatted.map((s) => [
        s.id,
        s.usuario_id,
        s.usuario?.nombre || "",
        s.usuario?.username || "",
        s.punto_atencion_id,
        s.puntoAtencion?.nombre || "",
        s.estado,
        s.fecha_inicio,
        s.fecha_almuerzo || "",
        s.fecha_regreso || "",
        s.fecha_salida || "",
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map(csvEscape).join(","))
        .join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="jornadas_${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`
      );
      res.status(200).send(csv);
      return;
    }

    res.status(200).json({
      schedules: formatted,
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

// ==============================
// POST /schedules (crear o actualizar jornada)
// ==============================
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
        override,
      } = req.body as z.infer<typeof scheduleSchema>;

      // Operadores/Administrativos/Concesión solo gestionan sus propias jornadas
      if (
        (req.user?.rol === "OPERADOR" ||
          req.user?.rol === "ADMINISTRATIVO" ||
          req.user?.rol === "CONCESION") &&
        usuario_id !== req.user.id
      ) {
        res.status(403).json({
          error:
            "Los operadores y administrativos solo pueden gestionar sus propias jornadas",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const rol = req.user?.rol;
      const esPrivilegiado =
        rol === "ADMINISTRATIVO" || rol === "ADMIN" || rol === "SUPER_USUARIO";

      // Ventana del día (zona Guayaquil)
      const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

      // Ejecutar todo dentro de transacción SERIALIZABLE para evitar carreras
      const schedule = await prisma.$transaction(
        async (tx) => {
          // Validar que OPERADOR/CONCESION NO puedan usar el punto principal
          if (rol === "OPERADOR" || rol === "CONCESION") {
            const puntoAtencion = await tx.puntoAtencion.findUnique({
              where: { id: punto_atencion_id },
              select: { es_principal: true },
            });
            if (puntoAtencion?.es_principal) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Este rol no puede iniciar jornada en el punto principal",
                { code: "P0001", clientVersion: "custom" } as any
              );
            }
          }

          // Ver si ya hay jornada ACTIVA/ALMUERZO del usuario (hoy)
          const existing = await tx.jornada.findFirst({
            where: {
              usuario_id,
              fecha_inicio: { gte: hoyGte, lt: hoyLt },
              OR: [
                { estado: EstadoJornada.ACTIVO },
                { estado: EstadoJornada.ALMUERZO },
              ],
            },
          });

          // Si vamos a CREAR y el rol no es privilegiado, verificar que el punto no esté ocupado
          if (!existing && !esPrivilegiado) {
            const puntoOcupado = await tx.jornada.findFirst({
              where: {
                punto_atencion_id,
                fecha_inicio: { gte: hoyGte, lt: hoyLt },
                OR: [
                  { estado: EstadoJornada.ACTIVO },
                  { estado: EstadoJornada.ALMUERZO },
                ],
              },
              select: { id: true },
            });
            if (puntoOcupado) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Este punto ya tiene una jornada activa. Selecciona otro punto o espera a que se libere.",
                { code: "P0002", clientVersion: "custom" } as any
              );
            }
          }

          if (existing) {
            // UPDATE de jornada existente del usuario hoy
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
            }
            if (ubicacion_salida) {
              updateData.ubicacion_salida =
                ubicacion_salida as Prisma.InputJsonValue;
            }

            const j = await tx.jornada.update({
              where: { id: existing.id },
              data: updateData,
              include: {
                usuario: { select: { id: true, nombre: true, username: true } },
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

            // Reflejar punto actual del usuario (si no cerró)
            await tx.usuario.update({
              where: { id: usuario_id },
              data: fecha_salida
                ? { punto_atencion_id: null }
                : { punto_atencion_id },
            });

            return j;
          } else {
            // CREATE nueva jornada
            const j = await tx.jornada.create({
              data: {
                usuario_id,
                punto_atencion_id,
                fecha_inicio: fecha_inicio
                  ? new Date(fecha_inicio)
                  : new Date(),
                ubicacion_inicio: (ubicacion_inicio as any) || null,
                estado: EstadoJornada.ACTIVO,
              },
              include: {
                usuario: { select: { id: true, nombre: true, username: true } },
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

            // Asociar punto al usuario
            await tx.usuario.update({
              where: { id: usuario_id },
              data: { punto_atencion_id },
            });

            return j;
          }
        },
        { isolationLevel: "Serializable" } // ⚡️ evita carreras
      );

      logger.info("Jornada procesada", {
        scheduleId: schedule.id,
        userId: usuario_id,
        requestedBy: req.user?.id,
        role: req.user?.rol,
        overrideUsed:
          !!override &&
          (req.user?.rol === "ADMIN" ||
            req.user?.rol === "SUPER_USUARIO" ||
            req.user?.rol === "ADMINISTRATIVO"),
      });

      res.status(200).json({
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
    } catch (error: any) {
      const msg =
        error?.message ||
        (error instanceof Error ? error.message : "Unknown error");

      // Errores “lógicos” que arrojamos arriba (P0001, P0002)
      if (error?.code === "P0001" || error?.code === "P0002") {
        return res.status(403).json({
          error: msg,
          success: false,
          timestamp: new Date().toISOString(),
        });
      }

      logger.error("Error al procesar jornada", {
        error: msg,
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

// ==============================
// GET /schedules/active (jornada activa del usuario autenticado)
// ==============================
router.get("/active", authenticateToken, async (req, res) => {
  try {
    nocache(res);

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: "Usuario no autenticado",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

    const activeSchedule = await prisma.jornada.findFirst({
      where: {
        usuario_id: userId,
        fecha_inicio: { gte: hoy, lt: manana },
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
      },
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
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

// ==============================
// GET /schedules/started-today (para admins)
// ==============================
router.get("/started-today", authenticateToken, async (req, res) => {
  try {
    nocache(res);

    if (
      !req.user ||
      !["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(req.user.rol)
    ) {
      res.status(403).json({ success: false, error: "Permisos insuficientes" });
      return;
    }

    const { gte: today, lt: tomorrow } = gyeDayRangeUtcFromDate(new Date());

    const schedules = await prisma.jornada.findMany({
      where: {
        fecha_inicio: { gte: today, lt: tomorrow },
        OR: [
          { estado: EstadoJornada.ACTIVO },
          { estado: EstadoJornada.ALMUERZO },
        ],
      },
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
        puntoAtencion: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_inicio: "desc" },
    });

    res.json({
      success: true,
      schedules: schedules.map((s) => ({
        ...s,
        fecha_inicio: s.fecha_inicio.toISOString(),
        fecha_almuerzo: s.fecha_almuerzo?.toISOString() || null,
        fecha_regreso: s.fecha_regreso?.toISOString() || null,
        fecha_salida: s.fecha_salida?.toISOString() || null,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// GET /schedules/user/:id (historial de un usuario)
// ==============================
router.get("/user/:id", authenticateToken, async (req, res) => {
  try {
    nocache(res);

    const userId = req.params.id;
    const isSelf = req.user?.id === userId;
    const isAdmin = ["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "");
    const isAdminist = req.user?.rol === "ADMINISTRATIVO";

    if (!(isSelf || isAdmin || isAdminist)) {
      res.status(403).json({ success: false, error: "Permisos insuficientes" });
      return;
    }

    const { from, to, estados } = req.query as {
      from?: string;
      to?: string;
      estados?: string;
    };

    const where: Prisma.JornadaWhereInput = { usuario_id: userId };

    if (from || to) {
      let gte: Date | undefined;
      let lt: Date | undefined;
      if (from) {
        const { y, m, d } = gyeParseDateOnly(from);
        ({ gte } = gyeDayRangeUtcFromYMD(y, m, d));
      }
      if (to) {
        const { y, m, d } = gyeParseDateOnly(to);
        ({ lt } = gyeDayRangeUtcFromYMD(y, m, d));
      }
      where.fecha_inicio = {
        ...(gte ? { gte } : {}),
        ...(lt ? { lt } : {}),
      } as Prisma.DateTimeFilter;
    }

    if (estados) {
      const list = estados
        .split(",")
        .map((s) => s.trim())
        .filter((s) => estadosValidos.includes(s));
      if (list.length) where.estado = { in: list as any };
    }

    const schedules = await prisma.jornada.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
        puntoAtencion: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_inicio: "desc" },
    });

    res.json({
      success: true,
      schedules: schedules.map((s) => ({
        ...s,
        fecha_inicio: s.fecha_inicio.toISOString(),
        fecha_almuerzo: s.fecha_almuerzo?.toISOString() || null,
        fecha_regreso: s.fecha_regreso?.toISOString() || null,
        fecha_salida: s.fecha_salida?.toISOString() || null,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// =============================================
// POST /schedules/reassign-point (solo ADMIN/SUPER_USUARIO)
// =============================================
router.post(
  "/reassign-point",
  authenticateToken,
  validate(reassignSchema),
  async (req, res) => {
    try {
      if (!req.user || !["ADMIN", "SUPER_USUARIO"].includes(req.user.rol)) {
        res
          .status(403)
          .json({ success: false, error: "Permisos insuficientes" });
        return;
      }

      const adminId = req.user.id;
      const {
        usuario_id,
        destino_punto_atencion_id,
        motivo,
        observaciones,
        finalizar,
      } = req.body as z.infer<typeof reassignSchema>;

      const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

      const updatedSchedule = await prisma.$transaction(
        async (tx) => {
          // Jornada ACTIVA/ALMUERZO de hoy
          const schedule = await tx.jornada.findFirst({
            where: {
              usuario_id,
              fecha_inicio: { gte: hoyGte, lt: hoyLt },
              OR: [
                { estado: EstadoJornada.ACTIVO },
                { estado: EstadoJornada.ALMUERZO },
              ],
            },
          });

          if (!schedule) {
            throw new Prisma.PrismaClientKnownRequestError(
              "No se encontró jornada activa de hoy para el usuario",
              { code: "P0003", clientVersion: "custom" } as any
            );
          }

          // Punto destino
          let newPointId = destino_punto_atencion_id || null;
          if (!newPointId) {
            const principal = await tx.puntoAtencion.findFirst({
              where: { es_principal: true },
              select: { id: true },
            });
            if (!principal) {
              throw new Prisma.PrismaClientKnownRequestError(
                "No se encontró punto principal. Especifique destino_punto_atencion_id",
                { code: "P0004", clientVersion: "custom" } as any
              );
            }
            newPointId = principal.id;
          } else {
            const exists = await tx.puntoAtencion.findUnique({
              where: { id: newPointId },
              select: { id: true },
            });
            if (!exists) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Punto destino no existe",
                { code: "P0005", clientVersion: "custom" } as any
              );
            }
          }

          if (!finalizar && newPointId === schedule.punto_atencion_id) {
            throw new Prisma.PrismaClientKnownRequestError(
              "La jornada ya está asignada a ese punto",
              { code: "P0006", clientVersion: "custom" } as any
            );
          }

          // Historial de asignación
          await tx.historialAsignacionPunto.create({
            data: {
              usuario_id,
              punto_atencion_anterior_id: schedule.punto_atencion_id,
              punto_atencion_nuevo_id: finalizar
                ? schedule.punto_atencion_id
                : newPointId!,
              motivo_cambio:
                motivo ||
                (finalizar ? "CANCELACION_ADMIN" : "REASIGNACION_ADMIN"),
              autorizado_por: adminId,
              tipo_asignacion: "MANUAL",
              observaciones: observaciones || null,
            },
          });

          // Actualizar jornada
          const j = await tx.jornada.update({
            where: { id: schedule.id },
            data: finalizar
              ? {
                  fecha_salida: new Date(),
                  estado: EstadoJornada.CANCELADO,
                  motivo_cambio: motivo || "CANCELACION_ADMIN",
                  usuario_autorizo: adminId,
                }
              : {
                  punto_atencion_id: newPointId!,
                  motivo_cambio: motivo || "REASIGNACION_ADMIN",
                  usuario_autorizo: adminId,
                },
            include: {
              usuario: { select: { id: true, nombre: true, username: true } },
              puntoAtencion: { select: { id: true, nombre: true } },
            },
          });

          // Reflejar usuario
          await tx.usuario.update({
            where: { id: usuario_id },
            data: finalizar
              ? { punto_atencion_id: null }
              : { punto_atencion_id: newPointId! },
          });

          return j;
        },
        { isolationLevel: "Serializable" }
      );

      logger.info("Jornada reasignada por admin", {
        scheduleId: updatedSchedule.id,
        usuarioId: updatedSchedule.usuario_id,
        autorizadoPor: req.user?.id,
      });

      res.status(200).json({
        success: true,
        schedule: {
          ...updatedSchedule,
          fecha_inicio: updatedSchedule.fecha_inicio.toISOString(),
          fecha_almuerzo: updatedSchedule.fecha_almuerzo?.toISOString() || null,
          fecha_regreso: updatedSchedule.fecha_regreso?.toISOString() || null,
          fecha_salida: updatedSchedule.fecha_salida?.toISOString() || null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const code = error?.code;
      const msg =
        error?.message ||
        (error instanceof Error ? error.message : "Error interno");

      if (["P0003", "P0004", "P0005", "P0006"].includes(code)) {
        return res.status(400).json({ success: false, error: msg });
      }

      logger.error("Error en reasignación de jornada", {
        error: msg,
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({ success: false, error: "Error interno" });
    }
  }
);

export default router;
