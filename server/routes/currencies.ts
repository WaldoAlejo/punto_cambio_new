
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createCurrencySchema, type CreateCurrencyRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

interface UpdateData {
  nombre?: string;
  simbolo?: string;
  codigo?: string;
  orden_display?: number;
}

// Obtener todas las monedas (sin autenticación requerida para GET)
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  console.warn('=== CURRENCIES ROUTE - GET / START ===');
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

    console.warn('🔍 Querying database for active currencies...');
    const currencies = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { orden_display: 'asc' }
    });
    console.warn('✅ Database query result - currencies count:', currencies.length);
    console.warn('Raw currencies from database:', currencies);

    const formattedCurrencies = currencies.map(currency => ({
      ...currency,
      created_at: currency.created_at.toISOString(),
      updated_at: currency.updated_at.toISOString()
    }));
    console.warn('✅ Formatted currencies:', formattedCurrencies);

    logger.info('Monedas obtenidas', { 
      count: formattedCurrencies.length, 
      requestedBy: req.user?.id || 'anonymous'
    });

    const responseData = { 
      currencies: formattedCurrencies,
      success: true,
      timestamp: new Date().toISOString()
    };
    console.warn('✅ Sending response:', responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('=== CURRENCIES ROUTE GET ERROR ===');
    console.error('❌ Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    
    logger.error('Error al obtener monedas', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id || 'anonymous'
    });
    
    const errorResponse = { 
      error: 'Error al obtener monedas',
      success: false,
      timestamp: new Date().toISOString()
    };
    console.warn('❌ Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    console.warn('=== CURRENCIES ROUTE - GET / END ===');
  }
});

// Crear moneda (requiere autenticación y rol de admin)
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createCurrencySchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== CURRENCIES ROUTE - POST / START ===');
    console.warn('Request method:', req.method);
    console.warn('Request path:', req.path);
    console.warn('Request headers authorization:', req.headers.authorization);
    console.warn('Request user:', req.user);
    console.warn('Request body received:', req.body);
    console.warn('Request body JSON:', JSON.stringify(req.body, null, 2));

    try {
      const currencyData = req.body as CreateCurrencyRequest;
      
      console.warn('✅ Extracted currency data:', {
        nombre: currencyData.nombre,
        simbolo: currencyData.simbolo,
        codigo: currencyData.codigo,
        orden_display: currencyData.orden_display
      });

      // Verificar si el código ya existe
      console.warn('🔍 Checking if currency code already exists...');
      const existingCurrency = await prisma.moneda.findFirst({
        where: { codigo: currencyData.codigo }
      });
      
      if (existingCurrency) {
        console.warn('❌ Currency code already exists:', currencyData.codigo);
        const conflictResponse = {
          error: 'El código de moneda ya existe',
          success: false,
          timestamp: new Date().toISOString()
        };
        console.warn('❌ Sending conflict response:', conflictResponse);
        res.status(400).json(conflictResponse);
        return;
      }

      console.warn('🔍 Creating currency in database with data:', { ...currencyData, activo: true });
      const newCurrency = await prisma.moneda.create({
        data: { 
          ...currencyData, 
          activo: true,
          orden_display: currencyData.orden_display || 0
        }
      });
      console.warn('✅ Database create result:', newCurrency);

      logger.info('Moneda creada', { 
        currencyId: newCurrency.id, 
        createdBy: req.user?.id 
      });

      const responseData = {
        currency: {
          ...newCurrency,
          created_at: newCurrency.created_at.toISOString(),
          updated_at: newCurrency.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };
      console.warn('✅ Sending success response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== CURRENCIES ROUTE POST ERROR ===');
      console.error('❌ Error details:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
      
      logger.error('Error al crear moneda', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id 
      });
      
      const errorResponse = { 
        error: 'Error al crear moneda',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.warn('❌ Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== CURRENCIES ROUTE - POST / END ===');
    }
  }
);

// Editar moneda (requiere autenticación y rol de admin)
router.put('/:id',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn('=== CURRENCIES ROUTE - PUT /:id START ===');
    console.warn('Request headers:', req.headers);
    console.warn('Request user:', req.user);
    console.warn('Currency ID to edit:', req.params.id);
    console.warn('Update data received:', req.body);

    try {
      const currencyId = req.params.id;
      const { nombre, simbolo, codigo, orden_display } = req.body;

      console.warn('Checking if currency exists...');
      const existingCurrency = await prisma.moneda.findUnique({
        where: { id: currencyId }
      });

      if (!existingCurrency) {
        console.warn('Currency not found:', currencyId);
        const notFoundResponse = {
          error: 'Moneda no encontrada',
          success: false,
          timestamp: new Date().toISOString()
        };
        console.warn('Sending not found response:', notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      // Verificar si el código ya existe en otra moneda
      if (codigo && codigo !== existingCurrency.codigo) {
        console.warn('Checking if new currency code already exists...');
        const duplicateCurrency = await prisma.moneda.findFirst({
          where: { 
            codigo: codigo,
            id: { not: currencyId }
          }
        });
        
        if (duplicateCurrency) {
          console.warn('Currency code already exists:', codigo);
          const conflictResponse = {
            error: 'El código de moneda ya existe',
            success: false,
            timestamp: new Date().toISOString()
          };
          console.warn('Sending conflict response:', conflictResponse);
          res.status(400).json(conflictResponse);
          return;
        }
      }

      const updateData: UpdateData = {};
      if (nombre) updateData.nombre = nombre;
      if (simbolo) updateData.simbolo = simbolo;
      if (codigo) updateData.codigo = codigo;
      if (orden_display !== undefined) updateData.orden_display = orden_display;

      console.warn('Updating currency with data:', updateData);
      const updatedCurrency = await prisma.moneda.update({
        where: { id: currencyId },
        data: updateData
      });
      console.warn('Currency updated successfully:', updatedCurrency);

      logger.info('Moneda actualizada', { 
        currencyId: updatedCurrency.id, 
        updatedBy: req.user?.id 
      });

      const responseData = {
        currency: {
          ...updatedCurrency,
          created_at: updatedCurrency.created_at.toISOString(),
          updated_at: updatedCurrency.updated_at.toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending success response:', responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error('=== CURRENCIES ROUTE PUT ERROR ===');
      console.error('Error details:', error);
      
      logger.error('Error al actualizar moneda', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id 
      });
      
      const errorResponse = {
        error: 'Error al actualizar moneda',
        success: false,
        timestamp: new Date().toISOString()
      };
      console.warn('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn('=== CURRENCIES ROUTE - PUT /:id END ===');
    }
  }
);

export default router;
