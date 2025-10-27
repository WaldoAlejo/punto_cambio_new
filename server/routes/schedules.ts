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

/** =========================
 * Utilidades de roles exentos de caja
 * ========================= */
const ROLES_EXENTOS_CIERRE = new Set([
  "OPERADOR",
  "ADMINISTRATIVO",
  "ADMIN",
  "SUPER_USUARIO",
  "SUPER USUARIO",
]);

function normalizaRol(rol?: string) {
  return (rol || "")
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
function esExentoDeCaja(rol?: string) {
  return ROLES_EXENTOS_CIERRE.has(normalizaRol(rol));
}

/** Schema de entrada para crear/actualizar jornada */
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
      .optional()
      .nullable(),
    ubicacion_salida: z
      .object({
        lat: z.number(),
        lng: z.number(),
        direccion: z.string().optional(),
      })
      .optional()
      .nullable(),
    /** Solo tendrá efecto para roles privilegiados; opcional */
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

// ==============================
// GET /schedules (listado con filtros)
// ==============================
router.get("/", authenticateToken, async (req, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    const whereClause: Record<string, unknown> = {};

    // Restricción por rol: OPERADOR y ADMINISTRATIVO solo ven sus propias jornadas
    if (req.user?.rol === "OPERADOR" || req.user?.rol === "ADMINISTRATIVO") {
      whereClause.usuario_id = req.user.id;
    }

    // Admin y Super Usuario pueden consultar por usuario específico
    if (
      req.query.usuario_id &&
      ["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")
    ) {
      whereClause.usuario_id = req.query.usuario_id as string;
    }

    // Filtros de fecha: "fecha" (YYYY-MM-DD) o rango "from"/"to"
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

    // Filtro por estados (coma-separado), ej: estados=ACTIVO,ALMUERZO
    if (req.query.estados) {
      const estados = String(req.query.estados)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (estados.length > 0) {
        (whereClause as any).estado = { in: estados };
      }
    }

    // Paginación
    const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
    const rawOffset = parseInt(String(req.query.offset ?? "0"), 10);
    const take = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 500);
    const skip = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

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
      filters: { fecha, from, to, estados: req.query.estados },
    });

    // Exportación CSV opcional
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
      const rows = formattedSchedules.map((s) => [
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
        .map((cols) =>
          cols
            .map((c) =>
              typeof c === "string" && (c.includes(",") || c.includes("\n"))
                ? `"${c.replaceAll('"', '""')}"`
                : String(c)
            )
            .join(",")
        )
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
      } = req.body as {
        usuario_id: string;
        punto_atencion_id: string;
        fecha_inicio?: string;
        fecha_almuerzo?: string;
        fecha_regreso?: string;
        fecha_salida?: string;
        ubicacion_inicio?: {
          lat: number;
          lng: number;
          direccion?: string;
        } | null;
        ubicacion_salida?: {
          lat: number;
          lng: number;
          direccion?: string;
        } | null;
        override?: boolean;
      };

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

      // Validar que OPERADOR/CONCESION NO puedan usar el punto principal
      if (rol === "OPERADOR" || rol === "CONCESION") {
        const puntoAtencion = await prisma.puntoAtencion.findUnique({
          where: { id: punto_atencion_id },
          select: { es_principal: true, nombre: true },
        });

        if (puntoAtencion?.es_principal) {
          res.status(403).json({
            error: "Este rol no puede iniciar jornada en el punto principal",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Ventana del día (zona Guayaquil)
      const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());

      // 1) Ver si el usuario ya tiene una jornada ACTIVA/ALMUERZO hoy (para update en lugar de create)
      const existingSchedule = await prisma.jornada.findFirst({
        where: {
          usuario_id,
          fecha_inicio: { gte: hoyGte, lt: hoyLt },
          OR: [
            { estado: EstadoJornada.ACTIVO },
            { estado: EstadoJornada.ALMUERZO },
          ],
        },
      });

      // 2) Si NO hay jornada previa del usuario (vamos a CREAR) y el rol NO es privilegiado,
      // validar que el punto NO esté ocupado por otra jornada ACTIVO/ALMUERZO hoy.
      if (!existingSchedule && !esPrivilegiado) {
        const puntoOcupado = await prisma.jornada.findFirst({
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
          res.status(409).json({
            success: false,
            error:
              "Este punto ya tiene una jornada activa. Selecciona otro punto o espera a que se libere.",
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // === Crear o actualizar jornada del usuario ===
      let schedule;

      if (existingSchedule) {
        // UPDATE estado/fechas de la jornada ya existente del mismo usuario
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
          // === AJUSTE: exentos cierran jornada sin exigir cierres ===
          console.log(
            `🚀 FINALIZACION_JORNADA_INICIADA - Usuario: ${req.user?.rol}, Punto: ${punto_atencion_id}`
          );
          if (!esExentoDeCaja(req.user?.rol)) {
            // Para roles que sí manejan caja, verificar Cierre de Caja (divisas)
            const { gte } = gyeDayRangeUtcFromDate(new Date());
            console.log(
              `🔍 BUSCANDO_CIERRE - Punto: ${punto_atencion_id}, Fecha: ${gte.toISOString()}`
            );
            const cierreHoy = await prisma.cuadreCaja.findFirst({
              where: {
                punto_atencion_id,
                fecha: { gte },
                estado: "CERRADO",
              },
            });
            console.log(
              `📊 RESULTADO_CIERRE - Encontrado: ${!!cierreHoy}, ID: ${
                cierreHoy?.id || "N/A"
              }`
            );
            if (!cierreHoy) {
              console.log(
                `❌ ERROR_CIERRE_REQUERIDO - Enviando respuesta de error`
              );
              res.status(400).json({
                success: false,
                error: "Cierre de caja requerido",
                details:
                  "Debe realizar el cierre de caja diario (cuadre de divisas) antes de finalizar su jornada.",
              });
              return;
            }

            // NOTA: La validación de cierre de servicios externos fue eliminada.
            // Los servicios externos ahora se incluyen automáticamente en el cierre diario
            // a través del endpoint /cuadre-caja que consolida todos los movimientos.
          }
          // Finalizar jornada (para exentos y para quienes ya cerraron cierres requeridos)
          updateData.fecha_salida = new Date(fecha_salida);
          updateData.estado = EstadoJornada.COMPLETADO;
          // Al cerrar jornada, limpiar punto del usuario
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
      } else {
        // CREATE nueva jornada
        schedule = await prisma.jornada.create({
          data: {
            usuario_id,
            punto_atencion_id,
            fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
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
      }

      // Si no es cierre, asociar el punto actual al usuario
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
        role: rol,
        overrideUsed: !!override && esPrivilegiado,
        exentoCaja: esExentoDeCaja(rol),
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

// ==============================
// GET /schedules/active (jornada activa del usuario autenticado)
// ==============================
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
      const gte = from ? new Date(from) : undefined;
      let lt: Date | undefined;
      if (to) {
        const d = new Date(to);
        lt = new Date(d);
        lt.setDate(lt.getDate() + 1);
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
        .filter(Boolean);
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
// Reasigna la jornada ACTIVA/ALMUERZO de hoy de un usuario a otro punto
// para liberar el punto originalmente ocupado por error.
// - Si no se envía destino_punto_atencion_id, se usa el punto principal.
// - Registra historial y marca motivo/autoridad en la jornada.
// =============================================
const reassignSchema = z.object({
  usuario_id: z.string().uuid(),
  destino_punto_atencion_id: z.string().uuid().optional(),
  motivo: z.string().max(200).optional(),
  observaciones: z.string().max(500).optional(),
  finalizar: z.boolean().optional(), // si true: cierra/cancela la jornada y limpia punto del usuario
});

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
      } = req.body as {
        usuario_id: string;
        destino_punto_atencion_id?: string;
        motivo?: string;
        observaciones?: string;
        finalizar?: boolean;
      };

      // Buscar jornada ACTIVA/ALMUERZO de HOY del usuario
      const { gte: hoyGte, lt: hoyLt } = gyeDayRangeUtcFromDate(new Date());
      const schedule = await prisma.jornada.findFirst({
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
        res.status(404).json({
          success: false,
          error: "No se encontró jornada activa de hoy para el usuario",
        });
        return;
      }

      // Determinar punto destino
      let newPointId = destino_punto_atencion_id || null;
      if (!newPointId) {
        const principal = await prisma.puntoAtencion.findFirst({
          where: { es_principal: true },
          select: { id: true },
        });
        if (!principal) {
          res.status(400).json({
            success: false,
            error:
              "No se encontró punto principal. Especifique destino_punto_atencion_id",
          });
          return;
        }
        newPointId = principal.id;
      } else {
        const exists = await prisma.puntoAtencion.findUnique({
          where: { id: newPointId },
          select: { id: true },
        });
        if (!exists) {
          res
            .status(404)
            .json({ success: false, error: "Punto destino no existe" });
          return;
        }
      }

      if (newPointId === schedule.punto_atencion_id) {
        res.status(400).json({
          success: false,
          error: "La jornada ya está asignada a ese punto",
        });
        return;
      }

      // Transacción: actualizar jornada y usuario + historial
      const updatedSchedule = await prisma.$transaction(async (tx) => {
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

        // Actualizar jornada del día
        const j = await tx.jornada.update({
          where: { id: schedule.id },
          data: finalizar
            ? {
                // Cancelar/cerrar la jornada equivocada y dejar libre el punto (usuario sin punto)
                fecha_salida: new Date(),
                estado: EstadoJornada.CANCELADO,
                motivo_cambio: motivo || "CANCELACION_ADMIN",
                usuario_autorizo: adminId,
              }
            : {
                // Reasignación a otro punto
                punto_atencion_id: newPointId!,
                motivo_cambio: motivo || "REASIGNACION_ADMIN",
                usuario_autorizo: adminId,
              },
          include: {
            usuario: { select: { id: true, nombre: true, username: true } },
            puntoAtencion: { select: { id: true, nombre: true } },
          },
        });

        // Reflejar asignación actual del usuario
        await tx.usuario.update({
          where: { id: usuario_id },
          data: finalizar
            ? { punto_atencion_id: null }
            : { punto_atencion_id: newPointId! },
        });

        return j;
      });

      logger.info("Jornada reasignada por admin", {
        scheduleId: schedule.id,
        usuarioId: usuario_id,
        fromPoint: schedule.punto_atencion_id,
        toPoint: newPointId,
        autorizadoPor: adminId,
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
    } catch (e) {
      logger.error("Error en reasignación de jornada", {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({ success: false, error: "Error interno" });
    }
  }
);

export default router;
