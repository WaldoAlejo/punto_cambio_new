import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { generateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { loginSchema, type LoginRequest } from "../schemas/validation.js";

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_SECRET_KEY ||
  "your-super-secret-key-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "12h";

// ---------- Utils ----------
function extractToken(req: express.Request): string | null {
  const h = req.get("authorization") || req.get("Authorization");
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  // Si manejas cookie:
  // // @ts-ignore
  // if (req.cookies?.authToken) return String(req.cookies.authToken);
  return null;
}

function toAuthUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    punto_atencion_id: u.punto_atencion_id,
  };
}

// ---------- Rate limiting estricto para /login ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "Demasiados intentos de login, intente más tarde" },
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// ---------- POST /api/auth/login ----------
router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const { username, password } = req.body as LoginRequest;
      logger.info("Intento de login", { username, ip: req.ip });

      // username case-insensitive
      const user = await prisma.usuario.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          activo: true,
        },
      });

      if (!user) {
        logger.warn("Usuario no encontrado", { username, ip: req.ip });
        res.status(401).json({
          error: "Credenciales inválidas",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        logger.warn("Contraseña incorrecta", { username, ip: req.ip });
        res.status(401).json({
          error: "Credenciales inválidas",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Reglas para ADMIN / SUPER_USUARIO: debe estar en punto principal
      if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
        if (!user.punto_atencion_id) {
          logger.warn("Admin sin punto asignado", { username, ip: req.ip });
          res.status(403).json({
            error:
              "Administrador debe estar asociado a un punto de atención principal",
            success: false,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        const principal = await prisma.puntoAtencion.findUnique({
          where: { id: user.punto_atencion_id },
          select: { es_principal: true },
        });
        if (!principal?.es_principal) {
          logger.warn("Admin en punto NO principal", {
            username,
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

      // Jornada activa solo aplica a OPERADOR
      let jornadaActiva: {
        id: string;
        punto_atencion_id: string | null;
      } | null = null;

      if (user.rol === "OPERADOR") {
        jornadaActiva = await prisma.jornada.findFirst({
          where: {
            usuario_id: user.id,
            fecha_salida: null,
            // (opcional) estado in ["ACTIVO","ALMUERZO"]
          },
          select: { id: true, punto_atencion_id: true },
        });
      }

      // Firma token (usa generateToken para mantener compatibilidad { userId })
      const token = generateToken(user.id);

      const { password: _pwd, ...userWithoutPassword } = user;
      logger.info("Login exitoso", {
        userId: user.id,
        username,
        rol: user.rol,
        ip: req.ip,
      });

      res.status(200).json({
        user: {
          ...userWithoutPassword,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
          jornada_id: jornadaActiva?.id || null,
          punto_atencion_id:
            user.rol === "ADMIN" || user.rol === "SUPER_USUARIO"
              ? user.punto_atencion_id
              : jornadaActiva?.punto_atencion_id || null,
        },
        token,
        success: true,
        hasActiveJornada: !!jornadaActiva,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en login", {
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
  }
);

// ---------- GET /api/auth/verify (no usa authenticateToken; NUNCA 500) ----------
router.get(
  "/verify",
  async (req: express.Request, res: express.Response): Promise<void> => {
    const start = Date.now();
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      if (!JWT_SECRET) {
        // Config mala: repórtalo como inválido para no romper UI
        res.status(200).json({
          valid: false,
          user: null,
          error: "Token inválido o expirado",
        });
        return;
      }

      const token = extractToken(req);
      if (!token) {
        res.status(200).json({
          valid: false,
          user: null,
          error: "Token inválido o expirado",
        });
        return;
      }

      let payload: any;
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch {
        res.status(200).json({
          valid: false,
          user: null,
          error: "Token inválido o expirado",
        });
        return;
      }

      const user = await prisma.usuario.findUnique({
        where: { id: payload.userId as string },
        select: {
          id: true,
          username: true,
          nombre: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user || !user.activo) {
        res.status(200).json({
          valid: false,
          user: null,
          error: "Token inválido o expirado",
        });
        return;
      }

      logger.info("Token verificado exitosamente", {
        userId: user.id,
        username: user.username,
      });

      res.status(200).json({
        user: {
          ...toAuthUser(user),
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString(),
        },
        valid: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en verificación de token", {
        error: error instanceof Error ? error.message : "Unknown error",
        ip: req.ip,
      });

      // JAMÁS 500: evita romper el arranque del frontend
      res.status(200).json({
        error: "Error de verificación (servidor)",
        valid: false,
        user: null,
      });
    } finally {
      const ms = Date.now() - start;
      logger.info("/auth/verify tiempo de respuesta", { ms });
    }
  }
);

export default router;
