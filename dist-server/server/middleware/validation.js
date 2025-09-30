import { z } from "zod";
import logger from "../utils/logger.js";
// Middleware genérico para validar con esquemas Zod
export const validate = (schema, property = "body") => {
    return (req, res, next) => {
        try {
            const data = req[property];
            const validatedData = schema.parse(data);
            req[property] = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                }));
                logger.warn("Validación fallida", {
                    method: req.method,
                    path: req.path,
                    errors,
                    ip: req.ip,
                });
                res.status(400).json({
                    error: "Datos de entrada inválidos",
                    details: errors,
                    success: false,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            logger.error("Error inesperado durante validación", {
                error: error instanceof Error ? error.message : "Unknown error",
                method: req.method,
                path: req.path,
                ip: req.ip,
            });
            res.status(500).json({
                error: "Error interno del servidor",
                success: false,
                timestamp: new Date().toISOString(),
            });
        }
    };
};
// Middleware para sanitizar entrada
export const sanitizeInput = (req, res, next) => {
    logger.info("=== SANITIZE INPUT MIDDLEWARE START ===");
    const sanitizeString = (str) => {
        if (typeof str !== "string")
            return str;
        return str.trim().replace(/[<>"']/g, "");
    };
    const sanitizeObject = (obj) => {
        if (typeof obj !== "object" || obj === null)
            return obj;
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string") {
                sanitized[key] = sanitizeString(value);
            }
            else if (typeof value === "object") {
                sanitized[key] = sanitizeObject(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };
    if (req.body) {
        logger.info("🔍 Sanitizing request body...");
        req.body = sanitizeObject(req.body);
        logger.info("✅ Request body sanitized");
    }
    logger.info("=== SANITIZE INPUT MIDDLEWARE END ===");
    next();
};
