
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createCurrencySchema, type CreateCurrencyRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todas las monedas
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  console.log('=== CURRENCIES ROUTE - GET / START ===');
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

    console.log('Querying database for active currencies...');
    const currencies = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { orden_display: 'asc' }
    });
    console.log('Database query result - currencies count:', currencies.length);
    console.log('Raw currencies from database:', currencies);

    const formattedCurrencies = currencies.map(currency => ({
      ...currency,
      created_at: currency.created_at.toISOString(),
      updated_at: currency.updated_at.toISOString()
    }));
    console.log('Formatted currencies:', formattedCurrencies);

    logger.info('Monedas obtenidas', { 
      count: formattedCurrencies.length, 
      requestedBy: req.user?.id 
    });

    const responseData = { 
      currencies: formattedCurrencies,
      success: true,
      timestamp: new Date().toISOString()
    };
    console.log('Sending response:', responseData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('=== CURRENCIES ROUTE GET ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    
    logger.error('Error al obtener monedas', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id 
    });
    
    const errorResponse = { 
      error: 'Error al obtener monedas',
      success: false,
      timestamp: new Date().toISOString()
    };
    console.log('Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  } finally {
    console.log('=== CURRENCIES ROUTE - GET / END ===');
  }
});

// Crear moneda (solo admins)
router.post('/',
  authenticateToken,
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createCurrencySchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.log('=== CURRENCIES ROUTE - POST / START ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('Request body received:', req.body);
    console.log('Request body JSON:', JSON.stringify(req.body, null, 2));

    try {
      const currencyData = req.body as CreateCurrencyRequest;
      
      console.log('Extracted currency data:', {
        nombre: currencyData.nombre,
        simbolo: currencyData.simbolo,
        codigo: currencyData.codigo,
        orden_display: currencyData.orden_display
      });

      // Verificar si el código ya existe
      console.log('Checking if currency code already exists...');
      const existingCurrency = await prisma.moneda.findFirst({
        where: { codigo: currencyData.codigo }
      });
      
      if (existingCurrency) {
        console.warn('Currency code already exists:', currencyData.codigo);
        const conflictResponse = {
          error: 'El código de moneda ya existe',
          success: false,
          timestamp: new Date().toISOString()
        };
        console.log('Sending conflict response:', conflictResponse);
        res.status(400).json(conflictResponse);
        return;
      }

      console.log('Creating currency in database with data:', { ...currencyData, activo: true });
      const newCurrency = await prisma.moneda.create({
        data: { 
          ...currencyData, 
          activo: true,
          orden_display: currencyData.orden_display || 0
        }
      });
      console.log('Database create result:', newCurrency);

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
      console.log('Sending success response:', responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error('=== CURRENCIES ROUTE POST ERROR ===');
      console.error('Error details:', error);
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
      console.log('Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.log('=== CURRENCIES ROUTE - POST / END ===');
    }
  }
);

export default router;
