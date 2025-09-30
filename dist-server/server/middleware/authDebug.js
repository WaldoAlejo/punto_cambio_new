// server/middleware/authDebug.ts - Versión de debug del middleware de autenticación
import jwt from "jsonwebtoken";
import { pool } from "../lib/database.js";
import logger from "../utils/logger.js";
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
// Middleware de autenticación más permisivo para debugging
export const authenticateTokenDebug = async (req, res, next) => {
    logger.info("=== DEBUG AUTHENTICATE TOKEN MIDDLEWARE START ===", {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });
    try {
        const authHeader = req.headers["authorization"] ||
            req.headers.Authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        logger.info("🔐 DEBUG - Token info:", {
            hasAuthHeader: !!authHeader,
            hasToken: !!token,
            tokenStart: token?.substring(0, 20) + "...",
        });
        if (!token) {
            logger.warn("DEBUG - Acceso sin token", {
                ip: req.ip,
                url: req.originalUrl,
            });
            res.status(401).json({
                error: "Token de acceso requerido",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            const effectiveUserId = decoded.id || decoded.userId;
            logger.info("🔐 DEBUG - JWT decoded OK", {
                id: decoded.id,
                userId: decoded.userId,
                effectiveUserId,
                iat: decoded.iat,
                exp: decoded.exp,
            });
            if (!effectiveUserId) {
                logger.error("DEBUG - No effective user ID found in token");
                res.status(401).json({
                    error: "Token inválido - no user ID",
                    success: false,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        }
        catch (jwtError) {
            logger.error("DEBUG - JWT verification failed", {
                error: jwtError instanceof Error ? jwtError.message : jwtError,
            });
            res.status(403).json({
                error: "Token inválido",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const effectiveUserId = decoded.id || decoded.userId;
        // 2) Cargar usuario desde BD
        let user = null;
        try {
            logger.info("🔍 DEBUG - Buscando usuario en BD:", { effectiveUserId });
            const userQuery = await pool.query('SELECT id, username, nombre, rol, activo, punto_atencion_id FROM "Usuario" WHERE id = $1 LIMIT 1', [effectiveUserId]);
            user = (userQuery.rows && userQuery.rows[0]) || null;
            logger.info("🔍 DEBUG - Resultado de búsqueda de usuario:", {
                found: !!user,
                userId: effectiveUserId,
                user: user
                    ? {
                        id: user.id,
                        username: user.username,
                        nombre: user.nombre,
                        rol: user.rol,
                        activo: user.activo,
                        punto_atencion_id: user.punto_atencion_id,
                    }
                    : null,
            });
        }
        catch (dbErr) {
            logger.error("DEBUG - Error consultando Usuario", {
                error: dbErr instanceof Error ? dbErr.message : dbErr,
            });
            res.status(500).json({
                error: "Error interno del servidor",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!user) {
            logger.warn("DEBUG - Token con usuario no encontrado", {
                userId: effectiveUserId,
                ip: req.ip,
            });
            res.status(401).json({
                error: "Usuario no encontrado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!user.activo) {
            logger.warn("DEBUG - Usuario inactivo", {
                userId: user.id,
                ip: req.ip,
            });
            res.status(401).json({
                error: "Usuario inactivo",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // 3) VERSIÓN DEBUG: Saltamos las verificaciones estrictas de punto de atención
        logger.info("🚨 DEBUG - SALTANDO verificaciones de punto de atención para debugging", {
            userId: user.id,
            rol: user.rol,
            punto_atencion_id: user.punto_atencion_id,
        });
        // 4) Inyectar usuario y continuar
        req.user = user;
        logger.info("✅ DEBUG - Usuario autenticado correctamente", {
            userId: user.id,
            rol: user.rol,
            punto_atencion_id: user.punto_atencion_id,
        });
        next();
    }
    catch (error) {
        logger.error("DEBUG - Error inesperado en autenticación", {
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
    finally {
        logger.info("=== DEBUG AUTHENTICATE TOKEN MIDDLEWARE END ===");
    }
};
