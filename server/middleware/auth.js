
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// Middleware para validar JWT
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Acceso sin token', { ip: req.ip, url: req.originalUrl });
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
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
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en autenticación', { 
      error: error.message, 
      ip: req.ip 
    });
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar roles
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (!roles.includes(req.user.rol)) {
      logger.warn('Acceso denegado por rol', {
        userId: req.user.id,
        userRole: req.user.rol,
        requiredRoles: roles,
        ip: req.ip
      });
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

// Generar JWT
export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};
