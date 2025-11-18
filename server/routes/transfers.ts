import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { transferAutoReconciliation } from "../middleware/autoReconciliation.js";
import { validarSaldoTransferencia } from "../middleware/saldoValidation.js";
import { z } from "zod";
import transferController from "../controllers/transferController.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
// TRANSFERENCIAS ENTRE PUNTOS - LÓGICA DE NEGOCIO
// ═══════════════════════════════════════════════════════════════════════
// IMPORTANTE: Las transferencias son MOVIMIENTOS FÍSICOS DE EFECTIVO
// NO son transferencias bancarias.
//
// PROCESO REAL:
// 1. Punto A necesita enviar $500 USD a Punto B
// 2. Sistema resta $500 del saldo físico de Punto A
// 3. Operador de Punto A toma el efectivo de la caja
// 4. Operador se traslada físicamente (taxi, caminando, moto) al Punto B
// 5. Entrega el efectivo al operador de Punto B
// 6. Sistema suma $500 al saldo físico de Punto B
// 7. Ambos puntos registran el movimiento en su cuadre de caja
//
// NOTA: El campo "via" puede ser:
// - EFECTIVO: Movimiento físico normal (99% de los casos)
// - BANCO: Solo para casos excepcionales de control administrativo
// - MIXTO: Combinación de ambos
// ═══════════════════════════════════════════════════════════════════════

// Schema para crear transferencias
const createTransferSchema = z.object({
  origen_id: z.string().uuid().optional().nullable(),
  destino_id: z.string().uuid(),
  moneda_id: z.string().uuid(),
  monto: z.number().positive(),

  tipo_transferencia: z.enum([
    "ENTRE_PUNTOS",
    "DEPOSITO_MATRIZ",
    "RETIRO_GERENCIA",
    "DEPOSITO_GERENCIA",
  ]),

  // NUEVO: vía de la transferencia
  via: z.enum(["EFECTIVO", "BANCO", "MIXTO"]).optional().default("EFECTIVO"),

  // Desglose opcional para MIXTO (si no viene, se reparte 50/50)
  monto_efectivo: z.number().min(0).optional(),
  monto_banco: z.number().min(0).optional(),

  descripcion: z.string().optional().nullable(),

  // opcional: detalle físico para soporte de remisión (no afecta lógica)
  detalle_divisas: z
    .object({
      billetes: z.number().min(0),
      monedas: z.number().min(0),
      total: z.number().min(0),
    })
    .optional(),
  responsable_movilizacion: z
    .object({
      nombre: z.string().min(1),
      documento: z.string().min(1),
      cedula: z.string().min(1),
      telefono: z.string().optional(),
    })
    .optional(),
});

// Crear transferencia
router.post(
  "/",
  authenticateToken,
  validate(createTransferSchema),
  validarSaldoTransferencia, // 🛡️ Validar saldo suficiente antes de transferir
  // transferAutoReconciliation, // ❌ DESHABILITADO: Causaba doble actualización de saldos
  transferController.createTransfer
);

// Listar transferencias
router.get("/", authenticateToken, transferController.getAllTransfers);

export default router;
