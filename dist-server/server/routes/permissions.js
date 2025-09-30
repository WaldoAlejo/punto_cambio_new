import express from "express";
import prisma from "../lib/prisma.js";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import logger from "../utils/logger.js";
const router = express.Router();
const createPermissionSchema = z.object({
    tipo: z.enum(["PERSONAL", "SALUD", "OFICIAL", "OTRO"]),
    fecha_inicio: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "fecha_inicio inválida",
    }),
    fecha_fin: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "fecha_fin inválida",
    }),
    descripcion: z.string().optional(),
    archivo_url: z.string().url().optional(),
    archivo_nombre: z.string().optional(),
    punto_atencion_id: z.string().uuid().optional(),
});
// Listar permisos
router.get("/", authenticateToken, async (req, res) => {
    try {
        const where = {};
        // Operador y Administrativo solo ven los suyos
        if (req.user?.rol === "OPERADOR" || req.user?.rol === "ADMINISTRATIVO") {
            where.usuario_id = req.user.id;
        }
        // Admins pueden filtrar
        if (["ADMIN", "SUPER_USUARIO"].includes(req.user?.rol || "")) {
            if (req.query.usuario_id)
                where.usuario_id = String(req.query.usuario_id);
            if (req.query.estado)
                where.estado = String(req.query.estado);
        }
        const permisos = await prisma.permiso.findMany({
            where,
            include: {
                usuario: {
                    select: { id: true, nombre: true, username: true, rol: true },
                },
                puntoAtencion: { select: { id: true, nombre: true } },
                aprobador: { select: { id: true, nombre: true, username: true } },
            },
            orderBy: { created_at: "desc" },
        });
        // Deja que Express serialice Dates a ISO; evita toISOString en valores inesperados/null
        res.status(200).json({
            success: true,
            permisos,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error listando permisos", {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack,
        });
        res
            .status(500)
            .json({ success: false, error: "Error listando permisos" });
    }
});
// Crear permiso
router.post("/", authenticateToken, validate(createPermissionSchema), async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "No autenticado" });
            return;
        }
        if (!["OPERADOR", "ADMINISTRATIVO"].includes(req.user.rol)) {
            res
                .status(403)
                .json({ success: false, error: "Sin permisos para crear" });
            return;
        }
        const { tipo, fecha_inicio, fecha_fin, descripcion, archivo_url, archivo_nombre, punto_atencion_id, } = req.body;
        const permiso = await prisma.permiso.create({
            data: {
                usuario_id: req.user.id,
                punto_atencion_id: punto_atencion_id || req.user.punto_atencion_id || null,
                tipo,
                fecha_inicio: new Date(fecha_inicio),
                fecha_fin: new Date(fecha_fin),
                descripcion: descripcion || null,
                archivo_url: archivo_url || null,
                archivo_nombre: archivo_nombre || null,
            },
            include: {
                usuario: {
                    select: { id: true, nombre: true, username: true, rol: true },
                },
                puntoAtencion: { select: { id: true, nombre: true } },
            },
        });
        res.status(201).json({
            success: true,
            permiso: {
                ...permiso,
                fecha_inicio: permiso.fecha_inicio.toISOString(),
                fecha_fin: permiso.fecha_fin.toISOString(),
                created_at: permiso.created_at.toISOString(),
                updated_at: permiso.updated_at.toISOString(),
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error creando permiso", { error });
        res.status(500).json({ success: false, error: "Error creando permiso" });
    }
});
// Aprobar permiso
router.patch("/:id/approve", authenticateToken, async (req, res) => {
    try {
        if (!req.user || !["ADMIN", "SUPER_USUARIO"].includes(req.user.rol)) {
            res.status(403).json({ success: false, error: "Sin permisos" });
            return;
        }
        const { id } = req.params;
        const updated = await prisma.permiso.update({
            where: { id },
            data: {
                estado: "APROBADO",
                aprobado_por: req.user.id,
                fecha_aprobacion: new Date(),
            },
        });
        res.status(200).json({
            success: true,
            permiso: {
                ...updated,
                fecha_inicio: updated.fecha_inicio.toISOString(),
                fecha_fin: updated.fecha_fin.toISOString(),
                created_at: updated.created_at.toISOString(),
                updated_at: updated.updated_at.toISOString(),
                fecha_aprobacion: updated.fecha_aprobacion?.toISOString() || null,
            },
        });
    }
    catch (error) {
        logger.error("Error aprobando permiso", { error });
        res
            .status(500)
            .json({ success: false, error: "Error aprobando permiso" });
    }
});
// Rechazar permiso
router.patch("/:id/reject", authenticateToken, async (req, res) => {
    try {
        if (!req.user || !["ADMIN", "SUPER_USUARIO"].includes(req.user.rol)) {
            res.status(403).json({ success: false, error: "Sin permisos" });
            return;
        }
        const { id } = req.params;
        const updated = await prisma.permiso.update({
            where: { id },
            data: {
                estado: "RECHAZADO",
                aprobado_por: req.user.id,
                fecha_aprobacion: new Date(),
            },
        });
        res.status(200).json({
            success: true,
            permiso: {
                ...updated,
                fecha_inicio: updated.fecha_inicio.toISOString(),
                fecha_fin: updated.fecha_fin.toISOString(),
                created_at: updated.created_at.toISOString(),
                updated_at: updated.updated_at.toISOString(),
                fecha_aprobacion: updated.fecha_aprobacion?.toISOString() || null,
            },
        });
    }
    catch (error) {
        logger.error("Error rechazando permiso", { error });
        res
            .status(500)
            .json({ success: false, error: "Error rechazando permiso" });
    }
});
export default router;
