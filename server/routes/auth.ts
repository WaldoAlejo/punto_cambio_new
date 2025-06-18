import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { generateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { loginSchema, type LoginRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting estricto para login - Updated configuration
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // máximo 5 intentos de login por IP (updated from 'max' to 'limit')
  message: { error: 'Demasiados intentos de login, intente más tarde' },
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Endpoint para login con validación y rate limiting
router.post('/login', 
  loginLimiter,
  validate(loginSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { username, password } = req.body as LoginRequest;
      
      logger.info('Intento de login', { username, ip: req.ip });
      
      const user = await prisma.usuario.findFirst({
        where: {
          username: username,
          activo: true
        }
      });

      if (!user) {
        logger.warn('Usuario no encontrado', { username, ip: req.ip });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        logger.warn('Contraseña incorrecta', { username, ip: req.ip });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      const token = generateToken(user.id);
      const { password: _, ...userWithoutPassword } = user;
      
      logger.info('Login exitoso', { userId: user.id, username, ip: req.ip });
      
      res.json({ 
        user: {
          ...userWithoutPassword,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        },
        token
      });
    } catch (error) {
      logger.error('Error en login', { error: error instanceof Error ? error.message : 'Unknown error', ip: req.ip });
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

export default router;
