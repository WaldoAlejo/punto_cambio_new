
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createPointSchema, type CreatePointRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos de atención
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    logger.info('Puntos obtenidos', { count: points.length, requestedBy: req.user?.id });

    res.json({ 
      points: points.map(point => ({
        ...point,
        created_at: point.created_at.toISOString(),
        updated_at: point.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener puntos', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
    res.status(500).json({ error: 'Error al obtener puntos de atención' });
  }
});

// Crear punto de atención (solo admins)
router.post('/',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...req.body as CreatePointRequest, activo: true }
      });

      logger.info('Punto creado', { pointId: newPoint.id, createdBy: req.user?.id });

      res.status(201).json({ 
        point: {
          ...newPoint,
          created_at: newPoint.created_at.toISOString(),
          updated_at: newPoint.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al crear punto', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al crear punto de atención' });
    }
  }
);

export default router;
