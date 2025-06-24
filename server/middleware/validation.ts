
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
    console.log(`=== VALIDATION MIDDLEWARE START ===`);
    console.log(`Request method:`, req.method);
    console.log(`Request path:`, req.path);
    console.log(`Validating property: ${property}`);
    console.log(`Data to validate:`, req[property]);
    console.log(`Data JSON:`, JSON.stringify(req[property], null, 2));

    try {
      const data = req[property];
      console.log('🔍 Calling schema.parse...');
      const validatedData = schema.parse(data);
      
      console.log('✅ Validation successful!');
      console.log('Validated data:', validatedData);
      (req as unknown as Record<string, unknown>)[property] = validatedData;
      console.log('✅ Data set on request object');
      
      next();
    } catch (error) {
      console.error('=== VALIDATION ERROR ===');
      console.error('❌ Validation error details:', error);
      
      if (error instanceof z.ZodError) {
        console.error('❌ Zod validation errors:', error.errors);
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        console.log('❌ Formatted validation errors:', errors);

        logger.warn("Validación fallida", {
          errors,
          data: req[property],
          ip: req.ip,
        });

        const errorResponse = {
          error: "Datos de entrada inválidos",
          details: errors,
          success: false,
          timestamp: new Date().toISOString()
        };
        console.log('❌ Sending validation error response:', errorResponse);

        res.status(400).json(errorResponse);
        return;
      }

      console.error('❌ Non-Zod validation error:', error);
      logger.error("Error en validación", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      const errorResponse = { 
        error: "Error interno del servidor",
        success: false,
        timestamp: new Date().toISOString()
      };
      console.log('❌ Sending internal error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log(`=== VALIDATION MIDDLEWARE END ===`);
    }
  };
};

// Sanitizar datos de entrada
export const sanitizeInput: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log('=== SANITIZE INPUT MIDDLEWARE START ===');
  
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
    console.log('🔍 Sanitizing request body...');
    req.body = sanitizeObject(req.body);
    console.log('✅ Request body sanitized');
  }

  console.log('=== SANITIZE INPUT MIDDLEWARE END ===');
  next();
};
