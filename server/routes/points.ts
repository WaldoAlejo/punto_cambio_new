
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createPointSchema, type CreatePointRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos de atención
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  console.log('=== POINTS ROUTE - GET / START ===');
  console.log('Request headers:', req.headers);
  console.log('Request user:', req.user);
  
  try {
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    console.log('Querying database for active points...');
    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    console.log('Database query result - points count:', points.length);
    console.log('Raw points from database:', points);

    const formattedPoints = points.map(point => ({
      ...point,
      created_at: point.created_at.toISOString(),
      updated_at: point.updated_at.toISOString()
    }));
    console.log('Formatted points:', formattedPoints);

    logger.info('Puntos obtenidos', { 
      count: formattedPoints.length, 
      requestedBy: req.user?.id 
    });

    const responseData = { 
      points: formattedPoints,
      success: true,
      timestamp: new Date().toISOString()
    };
    console.log('Sending response:', responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('=== POINTS ROUTE GET ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    
    logger.error('Error al obtener puntos', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id 
    });
    
    const errorResponse = { 
      error: 'Error al obtener puntos de atención',
      success: false,
      timestamp: new Date().toISOString()
    };
    console.log('Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    console.log('=== POINTS ROUTE - GET / END ===');
  }
});

// Crear punto de atención (solo admins) - CORREGIDO: agregar authenticateToken
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('=== POINTS ROUTE - POST / START ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('Request body received:', req.body);
    console.log('Request body JSON:', JSON.stringify(req.body, null, 2));

    try {
      const pointData = req.body as CreatePointRequest;
      
      console.log('Extracted point data:', {
        nombre: pointData.nombre,
        direccion: pointData.direccion,
        ciudad: pointData.ciudad,
        provincia: pointData.provincia,
        codigo_postal: pointData.codigo_postal,
        telefono: pointData.telefono
      });

      console.log('Creating point in database with data:', { ...pointData, activo: true });
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...pointData, activo: true }
      });
      console.log('Database create result:', newPoint);

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
      console.log('Sending success response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE POST ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
      
      logger.error('Error al crear punto', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      const errorResponse = { 
        error: 'Error al crear punto de atención',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.log('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log('=== POINTS ROUTE - POST / END ===');
    }
  }
);

export default router;
