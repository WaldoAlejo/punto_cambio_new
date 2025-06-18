
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener saldos por punto
router.get('/:pointId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { pointId } = req.params;
    
    // Validar que pointId es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pointId)) {
      res.status(400).json({ error: 'ID de punto de atención inválido' });
      return;
    }
    
    const balances = await prisma.saldo.findMany({
      where: {
        punto_atencion_id: pointId
      },
      include: {
        moneda: true
      }
    });

    res.json({ 
      balances: balances.map(balance => ({
        ...balance,
        cantidad: parseFloat(balance.cantidad.toString()),
        updated_at: balance.updated_at.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error al obtener saldos', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener saldos' });
  }
});

export default router;
