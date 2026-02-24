/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RUTAS DE CONFIGURACIÓN DE HORARIOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Administra las configuraciones de horario para validaciones de jornadas.
 */

import express from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();

// Schema para crear/actualizar configuración
const configSchema = z.object({
  nombre: z.string().min(3).max(100),
  descripcion: z.string().max(500).optional(),
  hora_entrada_minima: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  hora_entrada_maxima: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  hora_salida_minima: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  hora_salida_maxima: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  min_almuerzo_maximo: z.number().int().min(15).max(180).default(60),
  min_jornada_minima: z.number().int().min(60).max(720).default(480),
  min_jornada_maxima: z.number().int().min(60).max(900).default(600),
  min_tolerancia_llegada: z.number().int().min(0).max(60).default(10),
  min_tolerancia_salida: z.number().int().min(0).max(60).default(10),
  requiere_ubicacion: z.boolean().default(false),
  radio_permitido_metros: z.number().int().min(50).max(2000).default(500),
  punto_atencion_id: z.string().uuid().optional().nullable(),
  es_default: z.boolean().default(false),
  activo: z.boolean().default(true),
});

// Middleware para verificar admin
const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")) {
    res.status(403).json({ success: false, error: "Se requiere rol ADMIN" });
    return;
  }
  next();
};

// ==============================
// GET /schedule-config (listar configuraciones)
// ==============================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const where: Prisma.ConfiguracionHorarioWhereInput = {};

    if (req.query.activo !== undefined) {
      where.activo = req.query.activo === "true";
    }

    if (req.query.punto_atencion_id) {
      where.punto_atencion_id = req.query.punto_atencion_id as string;
    }

    if (req.query.es_default === "true") {
      where.es_default = true;
    }

    const configs = await prisma.configuracionHorario.findMany({
      where,
      orderBy: [{ es_default: "desc" }, { created_at: "desc" }],
    });

    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    logger.error("Error listando configuraciones", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// GET /schedule-config/:id (detalle)
// ==============================
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const config = await prisma.configuracionHorario.findUnique({
      where: { id: req.params.id },
    });

    if (!config) {
      res.status(404).json({ success: false, error: "Configuración no encontrada" });
      return;
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Error obteniendo configuración", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// POST /schedule-config (crear)
// ==============================
router.post("/", authenticateToken, requireAdmin, validate(configSchema), async (req, res) => {
  try {
    const data = req.body as Prisma.ConfiguracionHorarioCreateInput;

    // Si se marca como default, desmarcar otras
    if (data.es_default) {
      await prisma.configuracionHorario.updateMany({
        where: { es_default: true },
        data: { es_default: false },
      });
    }

    const config = await prisma.configuracionHorario.create({
      data: {
        ...data,
        created_by: req.user?.id,
      },
    });

    logger.info("Configuración de horario creada", {
      configId: config.id,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Error creando configuración", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// PUT /schedule-config/:id (actualizar)
// ==============================
router.put("/:id", authenticateToken, requireAdmin, validate(configSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body as Prisma.ConfiguracionHorarioUpdateInput;

    const existing = await prisma.configuracionHorario.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Configuración no encontrada" });
      return;
    }

    // Si se marca como default, desmarcar otras
    if (data.es_default === true) {
      await prisma.configuracionHorario.updateMany({
        where: { es_default: true, id: { not: id } },
        data: { es_default: false },
      });
    }

    const config = await prisma.configuracionHorario.update({
      where: { id },
      data,
    });

    logger.info("Configuración de horario actualizada", {
      configId: config.id,
      updatedBy: req.user?.id,
    });

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Error actualizando configuración", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// DELETE /schedule-config/:id (eliminar)
// ==============================
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.configuracionHorario.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Configuración no encontrada" });
      return;
    }

    await prisma.configuracionHorario.delete({
      where: { id },
    });

    logger.info("Configuración de horario eliminada", {
      configId: id,
      deletedBy: req.user?.id,
    });

    res.json({
      success: true,
      message: "Configuración eliminada",
    });
  } catch (error) {
    logger.error("Error eliminando configuración", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// ==============================
// GET /schedule-config/current (config aplicable al usuario/punto actual)
// ==============================
router.get("/current/applicable", authenticateToken, async (req, res) => {
  try {
    const puntoAtencionId = req.user?.punto_atencion_id;

    // Buscar configuración específica del punto o la default
    const config = await prisma.configuracionHorario.findFirst({
      where: {
        activo: true,
        OR: [
          { punto_atencion_id: puntoAtencionId || null },
          { es_default: true },
        ],
      },
      orderBy: [
        { punto_atencion_id: "desc" },
        { created_at: "desc" },
      ],
    });

    if (!config) {
      res.status(404).json({
        success: false,
        error: "No hay configuración de horario activa",
      });
      return;
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Error obteniendo configuración aplicable", { error });
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

export default router;
