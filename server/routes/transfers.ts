
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';
import { transferController } from '../controllers/transferController.js';

const router = express.Router();

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
router.post('/', authenticateToken, validate(createTransferSchema), transferController.createTransfer);

// Endpoint para obtener transferencias
router.get('/', transferController.getAllTransfers);

export default router;
