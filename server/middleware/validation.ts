import { z } from "zod";
import { Request, Response, NextFunction, RequestHandler } from "express";
import logger from "../utils/logger.js";

type RequestProperty = "body" | "params" | "query";

// Middleware genérico para validar con esquemas Zod
export const validate = (
  schema: z.ZodSchema,
  property: RequestProperty = "body"
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.info("=== VALIDATION MIDDLEWARE START ===", {
      method: req.method,
      path: req.path,
      property,
      data: req[property],
    });

    try {
      const data = req[property];
      const validatedData = schema.parse(data);

      logger.info("✅ Validación exitosa", { validatedData });
      (req as unknown as Record<string, unknown>)[property] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        logger.warn("❌ Validación fallida", {
          errors,
          data: req[property],
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

      logger.error("❌ Error inesperado durante validación", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });

      res.status(500).json({
        error: "Error interno del servidor",
        success: false,
        timestamp: new Date().toISOString(),
      });
    } finally {
      logger.info("=== VALIDATION MIDDLEWARE END ===");
    }
  };
};

// Middleware para sanitizar entrada
export const sanitizeInput: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.info("=== SANITIZE INPUT MIDDLEWARE START ===");

  const sanitizeString = (str: unknown): unknown => {
    if (typeof str !== "string") return str;
    return str.trim().replace(/[<>"']/g, "");
  };

  const sanitizeObject = (obj: unknown): unknown => {
    if (typeof obj !== "object" || obj === null) return obj;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeObject(value);
      } else {
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
