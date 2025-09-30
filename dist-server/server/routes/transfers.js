import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import transferController from "../controllers/transferController.js";
const router = express.Router();
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
router.post("/", authenticateToken, validate(createTransferSchema), transferController.createTransfer);
// Listar transferencias
router.get("/", authenticateToken, transferController.getAllTransfers);
export default router;
