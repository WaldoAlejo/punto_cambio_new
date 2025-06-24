
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los puntos (acceso para todos los usuarios autenticados)
router.get('/', 
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== POINTS ROUTE - GET / START ===');
    console.warn('Request headers:', req.headers);
    console.warn('Request user:', req.user);

    try {
      console.warn('Querying database for points...');
      const points = await prisma.puntoAtencion.findMany({
        orderBy: { nombre: 'asc' }
      });
      console.warn('Database query result - points count:', points.length);
      console.warn('Points data:', points);

      logger.info('Puntos obtenidos', { 
        count: points.length, 
        requestedBy: req.user?.id 
      });

      const responseData = {
        points,
        success: true,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending response:', responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE GET ERROR ===');
      console.error('Error details:', error);
      
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
      console.warn('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== POINTS ROUTE - GET / END ===');
    }
  }
);

// Crear punto (solo admins)
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== POINTS ROUTE - POST / START ===');
    console.warn('Request headers:', req.headers);
    console.warn('Request user:', req.user);
    console.warn('Request body received:', req.body);

    try {
      const { nombre, direccion, ciudad, provincia, codigo_postal, telefono } = req.body;
      console.warn('Extracted point data:', { nombre, direccion, ciudad, provincia, codigo_postal, telefono });
      
      if (!nombre || !direccion || !ciudad) {
        console.warn('Missing required fields');
        const badRequestResponse = {
          error: 'Los campos nombre, dirección y ciudad son obligatorios',
          success: false,
          timestamp: new Date().toISOString()
        };
        console.warn('Sending bad request response:', badRequestResponse);
        res.status(400).json(badRequestResponse);
        return;
      }

      const createData = {
        nombre,
        direccion,
        ciudad,
        provincia: provincia || '',
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        activo: true
      };
      console.warn('Data to create point:', createData);

      console.warn('Creating point in database...');
      const newPoint = await prisma.puntoAtencion.create({
        data: createData
      });
      console.warn('Point created successfully:', newPoint);

      logger.info('Punto creado', { 
        pointId: newPoint.id, 
        nombre: newPoint.nombre,
        createdBy: req.user?.id 
      });

      const responseData = {
        point: newPoint,
        success: true,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending success response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE POST ERROR ===');
      console.error('Error details:', error);
      
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
      console.warn('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== POINTS ROUTE - POST / END ===');
    }
  }
);

// Cambiar el estado de un punto (solo admins)
router.patch('/:id/toggle', 
  authenticateToken, 
  requireRole(['ADMIN', 'SUPER_USUARIO']), 
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== POINTS ROUTE - PATCH /:id/toggle START ===');
    console.warn('Request headers:', req.headers);
    console.warn('Request user:', req.user);
    console.warn('Point ID to toggle:', req.params.id);

    try {
      const pointId = req.params.id;

      console.warn('Fetching point from database...');
      const existingPoint = await prisma.puntoAtencion.findUnique({
        where: { id: pointId }
      });

      if (!existingPoint) {
        console.warn('Point not found:', pointId);
        const notFoundResponse = {
          error: 'Punto de atención no encontrado',
          success: false,
          timestamp: new Date().toISOString()
        };
        console.warn('Sending not found response:', notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      console.warn('Toggling point status...');
      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: { activo: !existingPoint.activo }
      });
      console.warn('Point status toggled successfully:', updatedPoint);

      logger.info('Estado de punto cambiado', { 
        pointId: updatedPoint.id, 
        newStatus: updatedPoint.activo,
        requestedBy: req.user?.id 
      });

      const responseData = {
        point: updatedPoint,
        success: true,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending success response:', responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE TOGGLE ERROR ===');
      console.error('Error details:', error);
      
      logger.error('Error al cambiar el estado del punto', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      const errorResponse = {
        error: 'Error al cambiar el estado del punto de atención',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== POINTS ROUTE - PATCH /:id/toggle END ===');
    }
  }
);

export default router;
