
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createCurrencySchema, type CreateCurrencyRequest } from '../schemas/validation.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener monedas
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const currencies = await prisma.moneda.findMany({
      where: {
        activo: true
      },
      orderBy: {
        orden_display: 'asc'
      }
    });

    res.json({ 
      currencies: currencies.map(currency => ({
        ...currency,
        created_at: currency.created_at.toISOString(),
        updated_at: currency.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener monedas', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener monedas' });
  }
});

// Crear moneda (solo admins)
router.post('/',
  requireRole(['ADMIN', 'SUPER_USUARIO']),
  validate(createCurrencySchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { nombre, simbolo, codigo, orden_display } = req.body as CreateCurrencyRequest;
      
      // Verificar si el código ya existe
      const existingCurrency = await prisma.moneda.findUnique({
        where: { codigo }
      });

      if (existingCurrency) {
        res.status(400).json({ error: 'El código de moneda ya existe' });
        return;
      }

      const newCurrency = await prisma.moneda.create({
        data: {
          nombre,
          simbolo,
          codigo,
          orden_display: orden_display || 0,
          activo: true
        }
      });

      logger.info('Moneda creada', { 
        newCurrencyId: newCurrency.id, 
        nombre: newCurrency.nombre,
        createdBy: req.user?.id 
      });

      res.status(201).json({ 
        currency: {
          ...newCurrency,
          created_at: newCurrency.created_at.toISOString(),
          updated_at: newCurrency.updated_at.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error al crear moneda', { error: error instanceof Error ? error.message : 'Unknown error', requestedBy: req.user?.id });
      res.status(500).json({ error: 'Error al crear moneda' });
    }
  }
);

export default router;
