
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createPointSchema, type CreatePointRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

interface UpdateData {
  nombre?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  codigo_postal?: string | null;
  telefono?: string | null;
}

// Endpoint para obtener puntos de atención (sin autenticación requerida para GET)
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  console.warn('=== POINTS ROUTE - GET / START ===');
  console.warn('Request method:', req.method);
  console.warn('Request path:', req.path);
  console.warn('Request headers authorization:', req.headers.authorization);
  console.warn('Request user:', req.user);
  
  try {
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    console.warn('🔍 Querying database for active points...');
    const points = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    console.warn('✅ Database query result - points count:', points.length);
    console.warn('Raw points from database:', points);

    const formattedPoints = points.map(point => ({
      ...point,
      created_at: point.created_at.toISOString(),
      updated_at: point.updated_at.toISOString()
    }));
    console.warn('✅ Formatted points:', formattedPoints);

    logger.info('Puntos obtenidos', { 
      count: formattedPoints.length, 
      requestedBy: req.user?.id || 'anonymous'
    });

    const responseData = { 
      points: formattedPoints,
      success: true,
      timestamp: new Date().toISOString()
    };
    console.warn('✅ Sending response:', responseData);

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
    console.warn('❌ Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    console.warn('=== POINTS ROUTE - GET / END ===');
  }
});

// Crear punto de atención (requiere autenticación y rol de admin)
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createPointSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== POINTS ROUTE - POST / START ===');
    console.warn('Request method:', req.method);
    console.warn('Request path:', req.path);
    console.warn('Request headers authorization:', req.headers.authorization);
    console.warn('Request user:', req.user);
    console.warn('Request body received:', req.body);
    console.warn('Request body JSON:', JSON.stringify(req.body, null, 2));

    try {
      const pointData = req.body as CreatePointRequest;
      
      console.warn('✅ Extracted point data:', {
        nombre: pointData.nombre,
        direccion: pointData.direccion,
        ciudad: pointData.ciudad,
        provincia: pointData.provincia,
        codigo_postal: pointData.codigo_postal,
        telefono: pointData.telefono
      });

      console.warn('🔍 Creating point in database with data:', { ...pointData, activo: true });
      const newPoint = await prisma.puntoAtencion.create({
        data: { ...pointData, activo: true }
      });
      console.warn('✅ Database create result:', newPoint);

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
      console.warn('✅ Sending success response:', responseData);

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
      console.warn('❌ Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== POINTS ROUTE - POST / END ===');
    }
  }
);

// Editar punto de atención (requiere autenticación y rol de admin)
router.put('/:id',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== POINTS ROUTE - PUT /:id START ===');
    console.warn('Request headers:', req.headers);
    console.warn('Request user:', req.user);
    console.warn('Point ID to edit:', req.params.id);
    console.warn('Update data received:', req.body);

    try {
      const pointId = req.params.id;
      const { nombre, direccion, ciudad, provincia, codigo_postal, telefono } = req.body;

      console.warn('Checking if point exists...');
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

      const updateData: UpdateData = {};
      if (nombre) updateData.nombre = nombre;
      if (direccion) updateData.direccion = direccion;
      if (ciudad) updateData.ciudad = ciudad;
      if (provincia) updateData.provincia = provincia;
      if (codigo_postal !== undefined) updateData.codigo_postal = codigo_postal || null;
      if (telefono !== undefined) updateData.telefono = telefono || null;

      console.warn('Updating point with data:', updateData);
      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: updateData
      });
      console.warn('Point updated successfully:', updatedPoint);

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
      console.warn('Sending success response:', responseData);

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
      console.warn('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== POINTS ROUTE - PUT /:id END ===');
    }
  }
);

// Activar/desactivar punto de atención (requiere autenticación y rol de admin)
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
        point: {
          ...updatedPoint,
          created_at: updatedPoint.created_at.toISOString(),
          updated_at: updatedPoint.updated_at.toISOString()
        },
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
