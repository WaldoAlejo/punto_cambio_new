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
    try {
      console.log(`=== VALIDATION MIDDLEWARE DEBUG ===`);
      console.log(`Validating ${property}:`, req[property]);
      console.log(`Validation data JSON:`, JSON.stringify(req[property], null, 2));
      
      const data = req[property];
      const validatedData = schema.parse(data);
      
      console.log('Validation successful, validated data:', validatedData);
      (req as unknown as Record<string, unknown>)[property] = validatedData;
      next();
    } catch (error) {
      console.error('=== VALIDATION ERROR ===');
      console.error('Validation error details:', error);
      
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', error.errors);
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        logger.warn("Validación fallida", {
          errors,
          data: req[property],
          ip: req.ip,
        });

        res.status(400).json({
          error: "Datos de entrada inválidos",
          details: errors,
        });
        return;
      }

      logger.error("Error en validación", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      res.status(500).json({ error: "Error interno del servidor" });
    }
  };
};

// Sanitizar datos de entrada
export const sanitizeInput: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
    req.body = sanitizeObject(req.body);
  }

  next();
};
