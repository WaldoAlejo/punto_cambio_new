
import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createUserSchema, type CreateUserRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Obtener usuarios (solo admins)
router.get('/', 
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      // Headers para evitar caché
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      const users = await prisma.usuario.findMany({
        orderBy: { created_at: 'desc' },
        include: {
          puntoAtencion: {
            select: {
              id: true,
              nombre: true
            }
          }
        },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
          puntoAtencion: true
        }
      });

      const formattedUsers = users.map(user => ({
        ...user,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString()
      }));

      logger.info('Usuarios obtenidos', { 
        count: formattedUsers.length, 
        requestedBy: req.user?.id 
      });

      res.status(200).json({ 
        users: formattedUsers,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error al obtener usuarios', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      res.status(500).json({ 
        error: 'Error al obtener usuarios',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Crear usuario (solo admins)
router.post('/',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createUserSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { username, password, nombre, correo, rol, punto_atencion_id } = req.body as CreateUserRequest;
      
      // Verificar duplicados
      const [existingUser, existingEmail] = await Promise.all([
        prisma.usuario.findFirst({ where: { username } }),
        correo ? prisma.usuario.findFirst({ where: { correo } }) : null
      ]);

      if (existingUser) {
        res.status(400).json({ 
          error: 'El nombre de usuario ya existe',
          success: false,
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (existingEmail) {
        res.status(400).json({ 
          error: 'El correo electrónico ya existe',
          success: false,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.usuario.create({
        data: {
          username,
          password: hashedPassword,
          nombre,
          correo,
          rol,
          punto_atencion_id,
          activo: true
        },
        include: {
          puntoAtencion: {
            select: {
              id: true,
              nombre: true
            }
          }
        },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
          puntoAtencion: true
        }
      });

      logger.info('Usuario creado', { 
        newUserId: newUser.id, 
        username: newUser.username,
        createdBy: req.user?.id 
      });

      res.status(201).json({ 
        user: {
          ...newUser,
          created_at: newUser.created_at.toISOString(),
          updated_at: newUser.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error al crear usuario', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      res.status(500).json({ 
        error: 'Error al crear usuario',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Activar/desactivar usuario (solo admins)
router.patch('/:userId/toggle',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { userId } = req.params;
      
      // Validar que userId es un UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        res.status(400).json({ 
          error: 'ID de usuario inválido',
          success: false,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const currentUser = await prisma.usuario.findUnique({
        where: { id: userId }
      });

      if (!currentUser) {
        res.status(404).json({ 
          error: 'Usuario no encontrado',
          success: false,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const updatedUser = await prisma.usuario.update({
        where: { id: userId },
        data: { activo: !currentUser.activo },
        include: {
          puntoAtencion: {
            select: {
              id: true,
              nombre: true
            }
          }
        },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
          puntoAtencion: true
        }
      });

      logger.info('Usuario actualizado', { 
        userId, 
        newStatus: updatedUser.activo,
        updatedBy: req.user?.id 
      });

      res.status(200).json({ 
        user: {
          ...updatedUser,
          created_at: updatedUser.created_at.toISOString(),
          updated_at: updatedUser.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error al actualizar usuario', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      res.status(500).json({ 
        error: 'Error al actualizar usuario',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
