
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

// ✅ Corrección ESLint: Extender Request usando module augmentation en lugar de namespace
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
  console.log('=== AUTHENTICATE TOKEN MIDDLEWARE START ===');
  console.log('Request headers:', req.headers);
  console.log('Authorization header:', req.headers.authorization);
  
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'No token');

    if (!token) {
      console.log('No token provided');
      logger.warn("Acceso sin token", { ip: req.ip, url: req.originalUrl });
      res.status(401).json({ error: "Token de acceso requerido" });
      return;
    }

    console.log('Verifying JWT token...');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    console.log('JWT decoded successfully. User ID:', decoded.userId);

    console.log('Fetching user from database...');
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
    console.log('Database user query result:', user);

    if (!user || !user.activo) {
      console.log('User not found or inactive:', { user: user ? 'found but inactive' : 'not found' });
      logger.warn("Token con usuario inválido", {
        userId: decoded.userId,
        ip: req.ip,
      });
      res.status(401).json({ error: "Usuario no válido" });
      return;
    }

    console.log('Setting user on request object:', user);
    req.user = user as AuthenticatedUser;
    console.log('User successfully set on request. Calling next()...');
    next();
  } catch (error) {
    console.error('=== AUTHENTICATE TOKEN ERROR ===');
    console.error('Authentication error:', error);
    logger.error("Error en autenticación", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: req.ip,
    });
    res.status(403).json({ error: "Token inválido" });
  } finally {
    console.log('=== AUTHENTICATE TOKEN MIDDLEWARE END ===');
  }
};

// Middleware para verificar roles
export const requireRole = (roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('=== ROLE CHECK MIDDLEWARE START ===');
    console.log('Required roles:', roles);
    console.log('User object from request:', req.user);
    console.log('User role:', req.user?.rol);
    
    if (!req.user) {
      console.log('No user found in request object');
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!roles.includes(req.user.rol)) {
      console.log('Role not allowed. User has:', req.user.rol, 'Required:', roles);
      logger.warn("Acceso denegado por rol", {
        userId: req.user.id,
        userRole: req.user.rol,
        requiredRoles: roles,
        ip: req.ip,
      });
      res.status(403).json({ error: "Permisos insuficientes" });
      return;
    }

    console.log('Role check passed, proceeding to endpoint');
    console.log('=== ROLE CHECK MIDDLEWARE END ===');
    next();
  };
};

// Generar JWT
export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
};
