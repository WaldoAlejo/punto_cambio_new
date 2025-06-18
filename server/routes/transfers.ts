
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint para obtener transferencias
router.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Headers para evitar caché
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    const transfers = await prisma.transferencia.findMany({
      include: {
        origen: {
          select: {
            id: true,
            nombre: true
          }
        },
        destino: {
          select: {
            id: true,
            nombre: true
          }
        },
        moneda: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            simbolo: true
          }
        },
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

    const formattedTransfers = transfers.map(transfer => ({
      ...transfer,
      monto: parseFloat(transfer.monto.toString()),
      fecha: transfer.fecha.toISOString(),
      fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null
    }));

    logger.info('Transferencias obtenidas', { 
      count: formattedTransfers.length, 
      requestedBy: req.user?.id 
    });

    res.status(200).json({ 
      transfers: formattedTransfers,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener transferencias', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Error al obtener transferencias',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
