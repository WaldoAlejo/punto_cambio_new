
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener jornadas/horarios
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

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

    const formattedSchedules = schedules.map(schedule => ({
      ...schedule,
      fecha_inicio: schedule.fecha_inicio.toISOString(),
      fecha_almuerzo: schedule.fecha_almuerzo?.toISOString() || null,
      fecha_regreso: schedule.fecha_regreso?.toISOString() || null,
      fecha_salida: schedule.fecha_salida?.toISOString() || null
    }));

    logger.info('Horarios obtenidos', { 
      count: formattedSchedules.length, 
      requestedBy: req.user?.id 
    });

    res.status(200).json({ 
      schedules: formattedSchedules,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener horarios', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Error al obtener horarios',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
