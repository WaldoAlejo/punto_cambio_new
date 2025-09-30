import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { loginSchema } from "../schemas/validation.js";
const router = express.Router();
// Rate limiting estricto para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: "Demasiados intentos de login, intente más tarde" },
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});
router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
    try {
        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
        });
        const { username, password } = req.body;
        logger.info("Intento de login", { username, ip: req.ip });
        // Buscar usuario con case-insensitive (username ya viene en minúsculas del schema)
        const user = await prisma.usuario.findFirst({
            where: {
                username: {
                    equals: username,
                    mode: "insensitive", // Búsqueda case-insensitive
                },
                activo: true,
            },
        });
        if (!user) {
            logger.warn("Usuario no encontrado", { username, ip: req.ip });
            res.status(401).json({
                error: "Credenciales inválidas",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            logger.warn("Contraseña incorrecta", { username, ip: req.ip });
            res.status(401).json({
                error: "Credenciales inválidas",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Validar permisos según rol
        if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
            // ADMIN debe tener punto_atencion_id asignado y ser el punto principal
            if (!user.punto_atencion_id) {
                logger.warn("Admin sin punto de atención asignado", {
                    username,
                    ip: req.ip,
                });
                res.status(403).json({
                    error: "Administrador debe estar asociado a un punto de atención principal",
                    success: false,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const principal = await prisma.puntoAtencion.findUnique({
                where: { id: user.punto_atencion_id },
                select: { es_principal: true },
            });
            if (!principal?.es_principal) {
                logger.warn("Admin en punto no principal", {
                    username,
                    punto_atencion_id: user.punto_atencion_id,
                });
                res.status(403).json({
                    error: "Administrador debe usar el punto de atención principal",
                    success: false,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        }
        // Buscar si tiene jornada activa (solo para OPERADOR)
        let jornadaActiva = null;
        if (user.rol === "OPERADOR") {
            jornadaActiva = await prisma.jornada.findFirst({
                where: {
                    usuario_id: user.id,
                    fecha_salida: null,
                },
                select: {
                    id: true,
                    punto_atencion_id: true,
                },
            });
        }
        const token = generateToken(user.id);
        const { password: _, ...userWithoutPassword } = user;
        logger.info("Login exitoso", {
            userId: user.id,
            username,
            rol: user.rol,
            ip: req.ip,
        });
        res.status(200).json({
            user: {
                ...userWithoutPassword,
                created_at: user.created_at.toISOString(),
                updated_at: user.updated_at.toISOString(),
                jornada_id: jornadaActiva?.id || null,
                punto_atencion_id: user.rol === "ADMIN" || user.rol === "SUPER_USUARIO"
                    ? user.punto_atencion_id
                    : jornadaActiva?.punto_atencion_id || null,
            },
            token,
            success: true,
            hasActiveJornada: !!jornadaActiva,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error en login", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            ip: req.ip,
        });
        res.status(500).json({
            error: "Error interno del servidor",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
});
// Verificación de token
router.get("/verify", authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({
                error: "Usuario no válido",
                valid: false,
            });
            return;
        }
        logger.info("Token verificado exitosamente", {
            userId: req.user.id,
            username: req.user.username,
        });
        res.status(200).json({
            user: {
                id: req.user.id,
                username: req.user.username,
                nombre: req.user.nombre,
                rol: req.user.rol,
                activo: req.user.activo,
                punto_atencion_id: req.user.punto_atencion_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            valid: true,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error("Error en verificación de token", {
            error: error instanceof Error ? error.message : "Unknown error",
            ip: req.ip,
        });
        res.status(500).json({
            error: "Error interno del servidor",
            valid: false,
        });
    }
});
export default router;
