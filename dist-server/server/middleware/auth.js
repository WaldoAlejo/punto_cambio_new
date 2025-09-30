// server/middleware/auth.ts
import jwt from "jsonwebtoken";
import { pool } from "../lib/database.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
// Usando conexión directa a PostgreSQL
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
// Middleware para validar JWT
export const authenticateToken = async (req, res, next) => {
    logger.info("=== AUTHENTICATE TOKEN MIDDLEWARE START ===", {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });
    // DEBUG: Log adicional para reportes
    if (req.originalUrl.includes("/reports")) {
        logger.info("🚨 DEBUG - Procesando solicitud de reportes", {
            path: req.originalUrl,
            method: req.method,
            headers: {
                authorization: req.headers.authorization
                    ? "Bearer [PRESENTE]"
                    : "NO_PRESENTE",
                contentType: req.headers["content-type"],
            },
        });
    }
    try {
        const authHeader = req.headers["authorization"] ||
            req.headers.Authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        if (!token) {
            logger.warn("Acceso sin token", { ip: req.ip, url: req.originalUrl });
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
            logger.info("JWT decoded OK", {
                id: decoded.id,
                userId: decoded.userId,
                effectiveUserId,
            });
            if (!effectiveUserId) {
                res.status(401).json({
                    error: "Token inválido",
                    success: false,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        }
        catch (jwtError) {
            logger.error("JWT verification failed", { error: jwtError });
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
            const userQuery = await pool.query('SELECT id, username, nombre, rol, activo, punto_atencion_id FROM "Usuario" WHERE id = $1 LIMIT 1', [effectiveUserId]);
            user = (userQuery.rows && userQuery.rows[0]) || null;
            logger.info("Resultado de búsqueda de usuario en BD", {
                found: !!user,
                userId: effectiveUserId,
            });
        }
        catch (dbErr) {
            logger.error("Error consultando Usuario", { error: dbErr });
            res.status(500).json({
                error: "Error interno del servidor",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!user) {
            logger.warn("Token con usuario no encontrado", {
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
            logger.warn("Usuario inactivo", {
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
        // 3) Reglas adicionales por rol (sin provocar 500; todo controlado)
        try {
            // --- OPERADOR: requiere jornada ACTIVO/ALMUERZO hoy; si no, se “desasocia” en la request ---
            if (user.rol === "OPERADOR") {
                const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());
                const jornadaQuery = await pool.query('SELECT id FROM "Jornada" WHERE usuario_id = $1 AND fecha_inicio >= $2 AND fecha_inicio < $3 AND (estado = $4 OR estado = $5) LIMIT 1', [user.id, hoy, manana, "ACTIVO", "ALMUERZO"]);
                const jornadaHoy = (jornadaQuery.rows && jornadaQuery.rows[0]) || null;
                if (!jornadaHoy) {
                    // Importante: NO hacer UPDATE aquí para evitar fallos y side effects.
                    // Solo normaliza en la request para que los controladores lo sepan.
                    if (user.punto_atencion_id) {
                        logger.info("OPERADOR sin jornada hoy: punto_atencion_id se ignora en esta request", {
                            userId: user.id,
                            punto_atencion_id: user.punto_atencion_id,
                        });
                    }
                    user.punto_atencion_id = null;
                }
            }
            // --- ADMIN / SUPER_USUARIO: exigir punto principal si lo requieres estrictamente ---
            if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
                // DEBUG: Temporalmente más permisivo para reportes
                if (req.originalUrl.includes("/reports")) {
                    logger.info("🚨 DEBUG - SALTANDO verificación de punto principal para reportes", {
                        userId: user.id,
                        rol: user.rol,
                        punto_atencion_id: user.punto_atencion_id,
                        path: req.originalUrl,
                    });
                }
                else {
                    if (!user.punto_atencion_id) {
                        logger.warn("Admin sin punto de atención asignado en middleware", {
                            userId: user.id,
                            rol: user.rol,
                        });
                        res.status(403).json({
                            error: "Administrador debe estar asociado a un punto de atención principal",
                            success: false,
                            timestamp: new Date().toISOString(),
                        });
                        return;
                    }
                    // Verificar que el punto asignado sea el principal (sin provocar 500)
                    const principalQuery = await pool.query('SELECT es_principal FROM "PuntoAtencion" WHERE id = $1 LIMIT 1', [user.punto_atencion_id]);
                    const esPrincipalRow = (principalQuery.rows && principalQuery.rows[0]) || null;
                    const esPrincipal = esPrincipalRow?.es_principal === true;
                    if (!esPrincipal) {
                        logger.warn("Admin asignado a punto no principal", {
                            userId: user.id,
                            rol: user.rol,
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
            }
        }
        catch (roleErr) {
            // Cualquier problema en estas verificaciones debe responder limpio, no 500 opaco
            logger.error("Error en verificaciones de rol/punto_atencion en middleware", {
                error: roleErr instanceof Error ? roleErr.message : String(roleErr),
                stack: roleErr instanceof Error ? roleErr.stack : undefined,
                userId: user.id,
                rol: user.rol,
            });
            res.status(500).json({
                error: "Error interno del servidor",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // 4) Inyectar usuario y continuar
        req.user = user;
        logger.info("Usuario autenticado correctamente", {
            userId: user.id,
            rol: user.rol,
        });
        next();
    }
    catch (error) {
        logger.error("Error inesperado en autenticación", {
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
        logger.info("=== AUTHENTICATE TOKEN MIDDLEWARE END ===");
    }
};
// Middleware para verificar roles
export const requireRole = (roles) => {
    return (req, res, next) => {
        logger.info("=== ROLE CHECK START ===", {
            path: req.path,
            requiredRoles: roles,
            user: req.user,
        });
        if (!req.user) {
            res.status(401).json({
                error: "Usuario no autenticado",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!roles.includes(req.user.rol)) {
            logger.warn("Acceso denegado por rol", {
                userId: req.user.id,
                userRole: req.user.rol,
                requiredRoles: roles,
                ip: req.ip,
            });
            res.status(403).json({
                error: "Permisos insuficientes",
                success: false,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        logger.info("Verificación de rol aprobada", {
            userId: req.user.id,
            rol: req.user.rol,
        });
        next();
    };
};
// Generar JWT
export const generateToken = (userId) => {
    logger.info("Generando token JWT para usuario", { userId });
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
    logger.info("Token generado correctamente");
    return token;
};
