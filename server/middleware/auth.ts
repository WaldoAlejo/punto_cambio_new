import jwt from "jsonwebtoken";
import { pool } from "../lib/database.js";
import { Request, Response, NextFunction, RequestHandler } from "express";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

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

// Usando conexión directa a PostgreSQL
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production";

// Middleware para validar JWT
export const authenticateToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

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

    const t0 = Date.now();
    const userQuery = await pool.query(
      'SELECT id, username, nombre, rol, activo, punto_atencion_id FROM "Usuario" WHERE id = $1',
      [decoded.userId]
    );
    const user = userQuery.rows[0];
    const t1 = Date.now();

    logger.info("Resultado de búsqueda de usuario en BD", {
      user,
      ms: t1 - t0,
    });

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
      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      const tJ0 = Date.now();
      const jornadaQuery = await pool.query(
        'SELECT id FROM "Jornada" WHERE usuario_id = $1 AND fecha_inicio >= $2 AND fecha_inicio < $3 AND (estado = $4 OR estado = $5) LIMIT 1',
        [user.id, hoy, manana, "ACTIVO", "ALMUERZO"]
      );
      const jornadaHoy = jornadaQuery.rows[0];
      const tJ1 = Date.now();
      logger.info("Chequeo jornada activa operador", {
        ms: tJ1 - tJ0,
        jornada: !!jornadaHoy,
      });

      if (!jornadaHoy) {
        // Limpiar en BD solo si está asignado
        if (user.punto_atencion_id) {
          await pool.query(
            'UPDATE "Usuario" SET punto_atencion_id = NULL WHERE id = $1',
            [user.id]
          );
        }
        user.punto_atencion_id = null;
      }
    }

    // --- VALIDACIÓN PARA ADMIN ---
    if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
      if (!user.punto_atencion_id) {
        logger.warn("Admin sin punto de atención asignado en middleware", {
          userId: user.id,
          rol: user.rol,
          ip: req.ip,
        });
        res.status(403).json({
          error:
            "Administrador debe estar asociado a un punto de atención principal",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verificar que el punto asignado sea el principal
      const principalQuery = await pool.query(
        'SELECT es_principal FROM "PuntoAtencion" WHERE id = $1',
        [user.punto_atencion_id]
      );
      const esPrincipal = principalQuery.rows[0]?.es_principal === true;
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

    // Nota: usuarios ADMINISTRATIVO pueden operar desde cualquier punto y no requieren punto_atencion_id fijo
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
