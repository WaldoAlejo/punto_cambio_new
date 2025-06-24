
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
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    const formattedPoints = points.map(point => ({
      ...point,
      created_at: point.created_at.toISOString(),
      updated_at: point.updated_at.toISOString()
    }));

    logger.info('Puntos obtenidos', { 
      count: formattedPoints.length, 
      requestedBy: req.user?.id 
    });

    res.status(200).json({ 
      points: formattedPoints,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener puntos', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Error al obtener puntos de atención',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Crear punto de atención (solo admins)
router.post('/',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      console.log('=== CREATE POINT ENDPOINT DEBUG ===');
      console.log('Request body received:', req.body);
      console.log('Request body JSON:', JSON.stringify(req.body, null, 2));
      console.log('User making request:', req.user);

      const pointData = req.body as CreatePointRequest;
      
      console.log('Point data extracted:', {
        nombre: pointData.nombre,
        direccion: pointData.direccion,
        ciudad: pointData.ciudad,
        provincia: pointData.provincia,
        codigo_postal: pointData.codigo_postal,
        telefono: pointData.telefono
      });

      console.log('About to create point in database...');
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...pointData, activo: true }
      });

      console.log('Point created successfully in database:', newPoint.id);

      logger.info('Punto creado', { 
        pointId: newPoint.id, 
        createdBy: req.user?.id 
      });

      const responseData = {
        point: {
          ...newPoint,
          created_at: newPoint.created_at.toISOString(),
          updated_at: newPoint.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log('Sending response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== CREATE POINT ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
      
      logger.error('Error al crear punto', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      res.status(500).json({ 
        error: 'Error al crear punto de atención',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
