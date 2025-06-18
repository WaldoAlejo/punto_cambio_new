
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener transferencias
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const transfers = await prisma.transferencia.findMany({
      include: {
        origen: true,
        destino: true,
        moneda: true,
        usuarioSolicitante: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        },
        usuarioAprobador: {
          select: {
            id: true,
            nombre: true,
            username: true
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    res.json({ 
      transfers: transfers.map(transfer => ({
        ...transfer,
        monto: parseFloat(transfer.monto.toString()),
        fecha: transfer.fecha.toISOString(),
        fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null
      }))
    });
  } catch (error) {
    logger.error('Error al obtener transferencias', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ error: 'Error al obtener transferencias' });
  }
});

export default router;
