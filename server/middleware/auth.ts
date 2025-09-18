import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { pool } from "../lib/database.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

// ------------------------------
// Tipos y augmentations
// ------------------------------
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

// ------------------------------
// Config JWT
// ------------------------------
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_SECRET_KEY ||
  "your-super-secret-key-change-in-production";

if (!process.env.JWT_SECRET && !process.env.JWT_SECRET_KEY) {
  logger.warn(
    "[AUTH] JWT secret no configurado por variable de entorno. Usando valor por defecto (INSEGURO)."
  );
}

// ------------------------------
// Utilidades
// ------------------------------
/** Extrae Bearer token del header Authorization o de una cookie `authToken` si la usas */
export function extractToken(req: Request): string | null {
  const h = req.get("authorization") || req.get("Authorization");
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  // Si manejas token por cookie, descomenta:
  // // @ts-ignore
  // if (req.cookies?.authToken) return String(req.cookies.authToken);
  return null;
}

// ------------------------------
// Middleware principal
// ------------------------------
/**
 * Autentica al usuario mediante JWT, carga datos mínimos desde la BD
 * y aplica reglas de negocio básicas:
 *  - OPERADOR: si hoy no tiene jornada ACTIVA/ALMUERZO, limpia punto_atencion_id
 *  - ADMIN / SUPER_USUARIO: requiere tener punto principal (puedes mover esta validación a rutas críticas si prefieres)
 */
export const authenticateToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      logger.warn("Acceso sin token", { ip: req.ip, url: req.originalUrl });
      res.status(401).json({
        error: "Token de acceso requerido",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      logger.info("JWT decodificado", { userId: decoded.userId });
    } catch (jwtError) {
      logger.warn("Fallo verificación JWT", {
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
      });
      // Token inválido o expirado => 401
      res.status(401).json({
        error: "Token inválido",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Buscar usuario
    const t0 = Date.now();
    const userQuery = await pool.query(
      'SELECT id, username, nombre, rol, activo, punto_atencion_id FROM "Usuario" WHERE id = $1',
      [decoded.userId]
    );
    const user: AuthenticatedUser | undefined = userQuery.rows[0];
    const t1 = Date.now();

    logger.info("Consulta de usuario", {
      userId: decoded.userId,
      encontrado: !!user,
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
      logger.warn("Usuario inactivo", { userId: user.id, ip: req.ip });
      res.status(401).json({
        error: "Usuario inactivo",
        success: false,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // --------- Regla para OPERADOR: mantener punto sano contra jornadas ----------
    if (user.rol === "OPERADOR") {
      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      const tJ0 = Date.now();
      const jornadaQuery = await pool.query(
        'SELECT id FROM "Jornada" WHERE usuario_id = $1 AND fecha_inicio >= $2 AND fecha_inicio < $3 AND (estado = $4 OR estado = $5) LIMIT 1',
        [user.id, hoy, manana, "ACTIVO", "ALMUERZO"]
      );
      const jornadaHoy = jornadaQuery.rows[0];
      const tJ1 = Date.now();

      logger.info("Chequeo jornada ACTIVA/ALMUERZO (OPERADOR)", {
        userId: user.id,
        tieneJornada: !!jornadaHoy,
        ms: tJ1 - tJ0,
      });

      if (!jornadaHoy) {
        // Si estaba apuntado a un punto, limpiar (consistencia)
        if (user.punto_atencion_id) {
          await pool.query(
            'UPDATE "Usuario" SET punto_atencion_id = NULL WHERE id = $1',
            [user.id]
          );
        }
        user.punto_atencion_id = null;
      }
    }

    // --------- Regla para ADMIN / SUPER_USUARIO ----------
    // Si prefieres no bloquear todo en middleware, mueve estas validaciones a endpoints críticos (ej. abrir/cerrar caja).
    if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
      if (!user.punto_atencion_id) {
        logger.warn("Admin sin punto de atención asignado", {
          userId: user.id,
          rol: user.rol,
        });
        res.status(403).json({
          error:
            "Administrador debe estar asociado a un punto de atención principal",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const principalQuery = await pool.query(
        'SELECT es_principal FROM "PuntoAtencion" WHERE id = $1',
        [user.punto_atencion_id]
      );
      const esPrincipal = principalQuery.rows[0]?.es_principal === true;

      if (!esPrincipal) {
        logger.warn("Admin asignado a punto NO principal", {
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

    // OK
    req.user = user;
    logger.info("Usuario autenticado", { userId: user.id, rol: user.rol });
    next();
  } catch (error) {
    // Cualquier error inesperado aquí => 500
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

// ------------------------------
// Middleware de autorización por rol
// ------------------------------
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

// ------------------------------
// Utilidad para emitir JWT
// ------------------------------
export const generateToken = (userId: string): string => {
  logger.info("Generando token JWT", { userId });
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
  return token;
};
