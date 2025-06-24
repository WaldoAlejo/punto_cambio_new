
import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Schema para crear transferencias - más flexible
const createTransferSchema = z.object({
  origen_id: z.string().uuid().optional().nullable(),
  destino_id: z.string().uuid(),
  moneda_id: z.string().uuid(),
  monto: z.number().positive(),
  tipo_transferencia: z.enum(['ENTRE_PUNTOS', 'DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA']),
  descripcion: z.string().optional().nullable(),
  detalle_divisas: z.object({
    billetes: z.number().min(0),
    monedas: z.number().min(0),
    total: z.number().min(0)
  }).optional(),
  responsable_movilizacion: z.object({
    nombre: z.string().min(1),
    documento: z.string().min(1),
    cedula: z.string().min(1),
    telefono: z.string().optional()
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

    logger.info('=== CREAR TRANSFERENCIA EN SERVIDOR ===', {
      usuarioId: req.user?.id,
      datosRecibidos: req.body
    });

    // Validar que el usuario existe
    if (!req.user?.id) {
      logger.error('Usuario no autenticado intentando crear transferencia');
      res.status(401).json({ 
        error: 'Usuario no autenticado',
        success: false,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validar que el punto de destino existe
    const destinoExists = await prisma.puntoAtencion.findUnique({
      where: { id: destino_id }
    });

    if (!destinoExists) {
      logger.error('Punto de destino no encontrado', { destino_id });
      res.status(400).json({ 
        error: 'Punto de destino no válido',
        success: false,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validar que la moneda existe
    const monedaExists = await prisma.moneda.findUnique({
      where: { id: moneda_id }
    });

    if (!monedaExists) {
      logger.error('Moneda no encontrada', { moneda_id });
      res.status(400).json({ 
        error: 'Moneda no válida',
        success: false,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validar origen si está presente
    if (origen_id) {
      const origenExists = await prisma.puntoAtencion.findUnique({
        where: { id: origen_id }
      });

      if (!origenExists) {
        logger.error('Punto de origen no encontrado', { origen_id });
        res.status(400).json({ 
          error: 'Punto de origen no válido',
          success: false,
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    // Generar número de recibo único
    const numeroRecibo = `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Preparar datos para la base de datos
    const transferData = {
      origen_id: origen_id || null,
      destino_id,
      moneda_id,
      monto: parseFloat(monto.toString()),
      tipo_transferencia,
      solicitado_por: req.user.id,
      descripcion: descripcion || null,
      numero_recibo: numeroRecibo,
      estado: 'PENDIENTE' as const,
      fecha: new Date()
    };

    logger.info('Creando transferencia con datos:', transferData);

    // Crear la transferencia en la base de datos
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

    logger.info('Transferencia creada en BD:', newTransfer);

    // Crear registro adicional en tabla de movimientos si es necesario
    try {
      await prisma.movimiento.create({
        data: {
          punto_atencion_id: destino_id,
          usuario_id: req.user.id,
          moneda_id,
          monto: parseFloat(monto.toString()),
          tipo: 'ENTRADA', // Usar valor válido del enum TipoMovimiento
          descripcion: `Transferencia ${tipo_transferencia} - ${numeroRecibo}`,
          numero_recibo: numeroRecibo
        }
      });
      logger.info('Movimiento registrado exitosamente');
    } catch (movError) {
      logger.warn('Error registrando movimiento (no crítico)', { error: movError });
    }

    // Crear recibo en la tabla de recibos
    try {
      await prisma.recibo.create({
        data: {
          numero_recibo: numeroRecibo,
          tipo_operacion: 'TRANSFERENCIA',
          referencia_id: newTransfer.id,
          usuario_id: req.user.id,
          punto_atencion_id: destino_id,
          datos_operacion: {
            transferencia: newTransfer,
            detalle_divisas: detalle_divisas || null,
            responsable_movilizacion: responsable_movilizacion || null,
            tipo_transferencia,
            monto,
            fecha: new Date().toISOString()
          }
        }
      });
      logger.info('Recibo registrado exitosamente');
    } catch (reciboError) {
      logger.warn('Error registrando recibo (no crítico)', { error: reciboError });
    }

    const formattedTransfer = {
      ...newTransfer,
      monto: parseFloat(newTransfer.monto.toString()),
      fecha: newTransfer.fecha.toISOString(),
      fecha_aprobacion: newTransfer.fecha_aprobacion?.toISOString() || null,
      detalle_divisas: detalle_divisas || null,
      responsable_movilizacion: responsable_movilizacion || null
    };

    logger.info('Transferencia creada exitosamente', { 
      transferId: newTransfer.id,
      createdBy: req.user.id,
      amount: monto,
      type: tipo_transferencia,
      numeroRecibo,
      saved: true
    });

    res.status(201).json({ 
      transfer: formattedTransfer,
      success: true,
      message: 'Transferencia creada y guardada exitosamente',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error al crear transferencia', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
      body: req.body
    });
    
    logger.error('=== ERROR CREAR TRANSFERENCIA ===', {
      error: error,
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    res.status(500).json({ 
      error: 'Error interno del servidor al crear transferencia',
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

    logger.info('Obteniendo transferencias de la base de datos...');

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

    logger.info(`Transferencias encontradas en BD: ${transfers.length}`);

    const formattedTransfers = transfers.map(transfer => ({
      ...transfer,
      monto: parseFloat(transfer.monto.toString()),
      fecha: transfer.fecha.toISOString(),
      fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null
    }));

    logger.info('Transferencias obtenidas desde BD', { 
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
