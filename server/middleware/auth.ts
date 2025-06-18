
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger.js';

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}

// Extender la interfaz Request para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// Middleware para validar JWT
export const authenticateToken: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Acceso sin token', { ip: req.ip, url: req.originalUrl });
      res.status(401).json({ error: 'Token de acceso requerido' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Verificar que el usuario aún existe y está activo
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        nombre: true,
        rol: true,
        activo: true,
        punto_atencion_id: true
      }
    });

    if (!user || !user.activo) {
      logger.warn('Token con usuario inválido', { 
        userId: decoded.userId, 
        ip: req.ip 
      });
      res.status(401).json({ error: 'Usuario no válido' });
      return;
    }

    req.user = user as AuthenticatedUser;
    next();
  } catch (error) {
    logger.error('Error en autenticación', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      ip: req.ip 
    });
    res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar roles
export const requireRole = (roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    if (!roles.includes(req.user.rol)) {
      logger.warn('Acceso denegado por rol', {
        userId: req.user.id,
        userRole: req.user.rol,
        requiredRoles: roles,
        ip: req.ip
      });
      res.status(403).json({ error: 'Permisos insuficientes' });
      return;
    }

    next();
  };
};

// Generar JWT
export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};
