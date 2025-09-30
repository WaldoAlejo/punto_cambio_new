import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
/**
 * Middleware para validar que el usuario existe y está activo
 */
export const validateUserExists = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.body.usuario_id || req.params.userId;
        if (!userId) {
            res.status(400).json({
                error: "ID de usuario requerido",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const user = await prisma.usuario.findUnique({
            where: { id: userId },
            select: { id: true, activo: true, rol: true, nombre: true },
        });
        if (!user) {
            res.status(404).json({
                error: "Usuario no encontrado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!user.activo) {
            res.status(403).json({
                error: "Usuario inactivo",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Agregar información del usuario a la request
        req.validatedUser = user;
        next();
    }
    catch (error) {
        logger.error("Error validando usuario:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
};
/**
 * Middleware para validar que el punto de atención existe y está activo
 */
export const validatePuntoAtencionExists = async (req, res, next) => {
    try {
        const puntoId = req.body.punto_atencion_id || req.params.puntoId;
        if (!puntoId) {
            res.status(400).json({
                error: "ID de punto de atención requerido",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const punto = await prisma.puntoAtencion.findUnique({
            where: { id: puntoId },
            select: { id: true, activo: true, nombre: true },
        });
        if (!punto) {
            res.status(404).json({
                error: "Punto de atención no encontrado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!punto.activo) {
            res.status(403).json({
                error: "Punto de atención inactivo",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        req.validatedPunto = punto;
        next();
    }
    catch (error) {
        logger.error("Error validando punto de atención:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
};
/**
 * Middleware para validar que la moneda existe y está activa
 */
export const validateMonedaExists = async (req, res, next) => {
    try {
        const monedaId = req.body.moneda_id || req.params.monedaId;
        if (!monedaId) {
            res.status(400).json({
                error: "ID de moneda requerido",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const moneda = await prisma.moneda.findUnique({
            where: { id: monedaId },
            select: { id: true, activo: true, codigo: true, nombre: true },
        });
        if (!moneda) {
            res.status(404).json({
                error: "Moneda no encontrada",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!moneda.activo) {
            res.status(403).json({
                error: "Moneda inactiva",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        req.validatedMoneda = moneda;
        next();
    }
    catch (error) {
        logger.error("Error validando moneda:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            success: false,
            timestamp: new Date().toISOString(),
        });
    }
};
/**
 * Middleware para validar permisos de rol
 */
export const validateRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.rol || req.validatedUser?.rol;
        if (!userRole) {
            res.status(401).json({
                error: "Rol de usuario no encontrado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                error: "No tiene permisos para realizar esta acción",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        next();
    };
};
/**
 * Middleware para validar formato de UUID
 */
export const validateUUID = (paramName) => {
    return (req, res, next) => {
        const uuid = req.params[paramName] || req.body[paramName];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuid || !uuidRegex.test(uuid)) {
            res.status(400).json({
                error: `${paramName} debe ser un UUID válido`,
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        next();
    };
};
