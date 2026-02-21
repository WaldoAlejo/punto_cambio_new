import express from "express";
import { EstadoJornada } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import { validate } from "../middleware/validation.js";
import { validarSaldoTransferencia } from "../middleware/saldoValidation.js";
import { z } from "zod";
import transferController from "../controllers/transferController.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";

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
  idempotency({ route: "/api/transfers" }),
  validate(createTransferSchema),
  validarSaldoTransferencia, // 🛡️ Validar saldo suficiente antes de transferir
  // transferAutoReconciliation, // ❌ DESHABILITADO: Causaba doble actualización de saldos
  transferController.createTransfer
);

// Listar transferencias
router.get("/", authenticateToken, transferController.getAllTransfers);

// Obtener transferencias EN_TRANSITO pendientes de aceptación para el punto actual
router.get("/pending-acceptance", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Usuario no autenticado",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const queryPointIdRaw =
      (req.query.point_id as string | undefined) ||
      (req.query.pointId as string | undefined) ||
      (req.query.point as string | undefined);

    const queryPointId = queryPointIdRaw
      ? z.string().uuid().safeParse(queryPointIdRaw).success
        ? queryPointIdRaw
        : undefined
      : undefined;

    const isPrivileged =
      req.user.rol === "ADMIN" ||
      req.user.rol === "SUPER_USUARIO" ||
      req.user.rol === "ADMINISTRATIVO";

    let puntoAtencionId: string | null | undefined = req.user.punto_atencion_id;

    // Para OPERADOR/CONCESION, el punto actual normalmente viene de la jornada activa.
    if (!puntoAtencionId && (req.user.rol === "OPERADOR" || req.user.rol === "CONCESION")) {
      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());
      const activeSchedule = await prisma.jornada.findFirst({
        where: {
          usuario_id: req.user.id,
          fecha_inicio: { gte: hoy, lt: manana },
          OR: [{ estado: EstadoJornada.ACTIVO }, { estado: EstadoJornada.ALMUERZO }],
        },
        select: { punto_atencion_id: true },
      });
      puntoAtencionId = activeSchedule?.punto_atencion_id || null;
    }

    // Si es usuario privilegiado, permitir consultar por point_id explícito
    if (isPrivileged && queryPointId) {
      puntoAtencionId = queryPointId;
    }

    // Si no es privilegiado y mandó point_id, debe coincidir con su punto operativo actual
    if (!isPrivileged && queryPointId && puntoAtencionId && queryPointId !== puntoAtencionId) {
      return res.status(403).json({
        error: "No tienes permiso para consultar transferencias de otro punto",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    if (!puntoAtencionId) {
      return res.status(400).json({
        error: "No se pudo determinar el punto de atención actual (perfil/jornada)",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const pendingTransfers = await prisma.transferencia.findMany({
      where: {
        destino_id: puntoAtencionId,
        estado: "EN_TRANSITO",
      },
      include: {
        origen: { select: { id: true, nombre: true } },
        destino: { select: { id: true, nombre: true } },
        moneda: {
          select: { id: true, codigo: true, nombre: true, simbolo: true },
        },
        usuarioSolicitante: {
          select: { id: true, nombre: true, username: true },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const formattedTransfers = pendingTransfers.map((transfer) => ({
      ...transfer,
      monto: parseFloat(transfer.monto.toString()),
      fecha: transfer.fecha.toISOString(),
      fecha_envio: transfer.fecha_envio?.toISOString() || null,
    }));

    res.status(200).json({
      transfers: formattedTransfers,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al obtener transferencias pendientes de aceptación", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      requestedBy: req.user?.id,
    });

    res.status(500).json({
      error: "Error al obtener transferencias pendientes de aceptación",
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post(
  "/:transferId/cancel",
  authenticateToken,
  async (req, res) => {
    await transferController.cancelTransfer(req as any, res);
  }
);

export default router;
