import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { Request, Response, NextFunction, RequestHandler } from "express";
import logger from "../utils/logger.js";

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

// Extender Request usando module augmentation
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

const prisma = new PrismaClient();
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production";

// Middleware para validar JWT
export const authenticateToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger.info("=== AUTHENTICATE TOKEN MIDDLEWARE START ===", {
    method: req.method,
    path: req.path,
    authorization: req.headers.authorization,
  });

  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    logger.info("Extracted token:", {
      token: token ? `${token.substring(0, 20)}...` : "No token",
    });

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
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      logger.info("JWT decoded", { userId: decoded.userId });
    } catch (jwtError) {
      logger.error("JWT verification failed", { error: jwtError });
      res.status(403).json({
        error: "Token inválido",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        nombre: true,
        rol: true,
        activo: true,
        punto_atencion_id: true,
      },
    });

    logger.info("Resultado de búsqueda de usuario en BD", { user });

    if (!user) {
      logger.warn("Token con usuario no encontrado", {
        userId: decoded.userId,
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
        userId: decoded.userId,
        ip: req.ip,
      });
      res.status(401).json({
        error: "Usuario inactivo",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // --- CORRECCIÓN IMPORTANTE PARA OPERADOR ---
    if (user.rol === "OPERADOR") {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const jornadaHoy = await prisma.jornada.findFirst({
        where: {
          usuario_id: user.id,
          fecha_inicio: { gte: hoy, lt: manana },
          OR: [{ estado: "ACTIVO" }, { estado: "ALMUERZO" }],
        },
      });

      if (!jornadaHoy) {
        // Limpiar en BD solo si está asignado
        if (user.punto_atencion_id) {
          await prisma.usuario.update({
            where: { id: user.id },
            data: { punto_atencion_id: null },
          });
        }
        user.punto_atencion_id = null;
      }
    }
    // --- FIN CORRECCIÓN ---

    req.user = user;
    logger.info("Usuario autenticado correctamente", { userId: user.id });
    next();
  } catch (error) {
    logger.error("Error en autenticación", {
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
    logger.info("=== AUTHENTICATE TOKEN MIDDLEWARE END ===");
  }
};

// Middleware para verificar roles
export const requireRole = (roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
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
export const generateToken = (userId: string): string => {
  logger.info("Generando token JWT para usuario", { userId });
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
  logger.info("Token generado correctamente");
  return token;
};
