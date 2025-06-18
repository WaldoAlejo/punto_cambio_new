
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener jornadas/horarios
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const schedules = await prisma.jornada.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        },
        puntoAtencion: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: {
        fecha_inicio: 'desc'
      }
    });

    res.json({ 
      schedules: schedules.map(schedule => ({
        ...schedule,
        fecha_inicio: schedule.fecha_inicio.toISOString(),
        fecha_almuerzo: schedule.fecha_almuerzo?.toISOString() || null,
        fecha_regreso: schedule.fecha_regreso?.toISOString() || null,
        fecha_salida: schedule.fecha_salida?.toISOString() || null
      }))
    });
  } catch (error) {
    logger.error('Error al obtener horarios', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

export default router;
