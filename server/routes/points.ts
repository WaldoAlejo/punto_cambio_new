
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createPointSchema, type CreatePointRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener puntos de atención (sin autenticación requerida para GET)
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  console.log('=== POINTS ROUTE - GET / START ===');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request headers authorization:', req.headers.authorization);
  console.log('Request user:', req.user);
  
  try {
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    console.log('🔍 Querying database for active points...');
    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    console.log('✅ Database query result - points count:', points.length);
    console.log('Raw points from database:', points);

    const formattedPoints = points.map(point => ({
      ...point,
      created_at: point.created_at.toISOString(),
      updated_at: point.updated_at.toISOString()
    }));
    console.log('✅ Formatted points:', formattedPoints);

    logger.info('Puntos obtenidos', { 
      count: formattedPoints.length, 
      requestedBy: req.user?.id || 'anonymous'
    });

    const responseData = { 
      points: formattedPoints,
      success: true,
      timestamp: new Date().toISOString()
    };
    console.log('✅ Sending response:', responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('=== POINTS ROUTE GET ERROR ===');
    console.error('❌ Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    
    logger.error('Error al obtener puntos', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id || 'anonymous'
    });
    
    const errorResponse = { 
      error: 'Error al obtener puntos de atención',
      success: false,
      timestamp: new Date().toISOString()
    };
    console.log('❌ Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    console.log('=== POINTS ROUTE - GET / END ===');
  }
});

// Crear punto de atención (requiere autenticación y rol de admin)
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('=== POINTS ROUTE - POST / START ===');
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request headers authorization:', req.headers.authorization);
    console.log('Request user:', req.user);
    console.log('Request body received:', req.body);
    console.log('Request body JSON:', JSON.stringify(req.body, null, 2));

    try {
      const pointData = req.body as CreatePointRequest;
      
      console.log('✅ Extracted point data:', {
        nombre: pointData.nombre,
        direccion: pointData.direccion,
        ciudad: pointData.ciudad,
        provincia: pointData.provincia,
        codigo_postal: pointData.codigo_postal,
        telefono: pointData.telefono
      });

      console.log('🔍 Creating point in database with data:', { ...pointData, activo: true });
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...pointData, activo: true }
      });
      console.log('✅ Database create result:', newPoint);

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
      console.log('✅ Sending success response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE POST ERROR ===');
      console.error('❌ Error details:', error);
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
      console.log('❌ Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log('=== POINTS ROUTE - POST / END ===');
    }
  }
);

// Editar punto de atención (requiere autenticación y rol de admin)
router.put('/:id',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('=== POINTS ROUTE - PUT /:id START ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('Point ID to edit:', req.params.id);
    console.log('Update data received:', req.body);

    try {
      const pointId = req.params.id;
      const { nombre, direccion, ciudad, provincia, codigo_postal, telefono } = req.body;

      console.log('Checking if point exists...');
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
        console.log('Sending not found response:', notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      const updateData: any = {};
      if (nombre) updateData.nombre = nombre;
      if (direccion) updateData.direccion = direccion;
      if (ciudad) updateData.ciudad = ciudad;
      if (provincia) updateData.provincia = provincia;
      if (codigo_postal !== undefined) updateData.codigo_postal = codigo_postal || null;
      if (telefono !== undefined) updateData.telefono = telefono || null;

      console.log('Updating point with data:', updateData);
      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: updateData
      });
      console.log('Point updated successfully:', updatedPoint);

      logger.info('Punto actualizado', { 
        pointId: updatedPoint.id, 
        updatedBy: req.user?.id 
      });

      const responseData = {
        point: {
          ...updatedPoint,
          created_at: updatedPoint.created_at.toISOString(),
          updated_at: updatedPoint.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };
      console.log('Sending success response:', responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE PUT ERROR ===');
      console.error('Error details:', error);
      
      logger.error('Error al actualizar punto', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id 
      });
      
      const errorResponse = {
        error: 'Error al actualizar punto de atención',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.log('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log('=== POINTS ROUTE - PUT /:id END ===');
    }
  }
);

// Activar/desactivar punto de atención (requiere autenticación y rol de admin)
router.patch('/:id/toggle',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('=== POINTS ROUTE - PATCH /:id/toggle START ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('Point ID to toggle:', req.params.id);

    try {
      const pointId = req.params.id;

      console.log('Fetching point from database...');
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
        console.log('Sending not found response:', notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      console.log('Toggling point status...');
      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: { activo: !existingPoint.activo }
      });
      console.log('Point status toggled successfully:', updatedPoint);

      logger.info('Estado de punto cambiado', { 
        pointId: updatedPoint.id, 
        newStatus: updatedPoint.activo,
        requestedBy: req.user?.id 
      });

      const responseData = {
        point: {
          ...updatedPoint,
          created_at: updatedPoint.created_at.toISOString(),
          updated_at: updatedPoint.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };
      console.log('Sending success response:', responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error('=== POINTS ROUTE TOGGLE ERROR ===');
      console.error('Error details:', error);
      
      logger.error('Error al cambiar el estado del punto', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id 
      });
      
      const errorResponse = {
        error: 'Error al cambiar el estado del punto de atención',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.log('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log('=== POINTS ROUTE - PATCH /:id/toggle END ===');
    }
  }
);

export default router;
