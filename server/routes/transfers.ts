import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Schema para crear transferencias
const createTransferSchema = z.object({
  origen_id: z.string().uuid().optional(),
  destino_id: z.string().uuid(),
  moneda_id: z.string().uuid(),
  monto: z.number().positive(),
  tipo_transferencia: z.enum(['ENTRE_PUNTOS', 'DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA']),
  descripcion: z.string().optional(),
  detalle_divisas: z.object({
    billetes: z.number(),
    monedas: z.number(),
    total: z.number()
  }).optional(),
  responsable_movilizacion: z.object({
    nombre: z.string(),
    documento: z.string(),
    cedula: z.string(),
    telefono: z.string()
  }).optional()
});

// Endpoint para crear transferencia
router.post('/', authenticateToken, validate(createTransferSchema), async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const {
      origen_id,
      destino_id,
      moneda_id,
      monto,
      tipo_transferencia,
      descripcion,
      detalle_divisas,
      responsable_movilizacion
    } = req.body;

    console.log('Creando transferencia con datos:', req.body);

    // Generar número de recibo único
    const numeroRecibo = `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const transferData: any = {
      origen_id: origen_id || null,
      destino_id,
      moneda_id,
      monto,
      tipo_transferencia,
      solicitado_por: req.user?.id,
      descripcion: descripcion || null,
      numero_recibo: numeroRecibo,
      estado: 'PENDIENTE'
    };

    console.log('Datos para Prisma:', transferData);

    const newTransfer = await prisma.transferencia.create({
      data: transferData,
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
        }
      }
    });

    const formattedTransfer = {
      ...newTransfer,
      monto: parseFloat(newTransfer.monto.toString()),
      fecha: newTransfer.fecha.toISOString(),
      fecha_aprobacion: newTransfer.fecha_aprobacion?.toISOString() || null,
      detalle_divisas,
      responsable_movilizacion
    };

    logger.info('Transferencia creada', { 
      transferId: newTransfer.id,
      createdBy: req.user?.id,
      amount: monto,
      type: tipo_transferencia
    });

    res.status(201).json({ 
      transfer: formattedTransfer,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al crear transferencia', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Error al crear transferencia',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

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
