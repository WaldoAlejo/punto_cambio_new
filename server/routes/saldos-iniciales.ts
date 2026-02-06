import express, { Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

// ===== helpers =====
const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);
  const raw = v.trim();
  if (!raw) return NaN;
  // 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{1,6}$/.test(raw))
    return Number(raw.replace(/\./g, "").replace(",", "."));
  // 1,234.56 -> 1234.56
  if (/^\d{1,3}(,\d{3})+\.\d{1,6}$/.test(raw))
    return Number(raw.replace(/,/g, ""));
  // 1234,56 -> 1234.56
  if (/^\d+(,\d{1,6})$/.test(raw)) return Number(raw.replace(",", "."));
  return Number(raw.replace(",", "."));
};
// Redondeo seguro con EPSILON para evitar problemas de punto flotante
const round2 = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Tipos de Request
interface PostSaldoBody {
  punto_atencion_id: string;
  moneda_id: string;
  cantidad_inicial: number | string; // puede venir como texto
  observaciones?: string;
  billetes?: number | string;
  monedas_fisicas?: number | string;
}

// ======================= GET: saldos iniciales (punto) =======================
router.get<{ pointId: string }>(
  "/:pointId",
  authenticateToken,
  async (req: Request<{ pointId: string }>, res: Response) => {
    try {
      const { pointId } = req.params;

      const rows = await prisma.saldoInicial.findMany({
        where: { punto_atencion_id: pointId, activo: true },
        orderBy: { created_at: "desc" },
        include: {
          moneda: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          puntoAtencion: { select: { id: true, nombre: true, ciudad: true } },
        },
      });

      const saldos = rows.map((si) => ({
        id: si.id,
        punto_atencion_id: si.punto_atencion_id,
        moneda_id: si.moneda_id,
        cantidad_inicial: si.cantidad_inicial,
        asignado_por: si.asignado_por,
        observaciones: si.observaciones,
        activo: si.activo,
        created_at: si.created_at,
        moneda_nombre: si.moneda?.nombre,
        moneda_codigo: si.moneda?.codigo,
        moneda_simbolo: si.moneda?.simbolo,
        punto_nombre: si.puntoAtencion?.nombre,
        ciudad: si.puntoAtencion?.ciudad,
      }));

      return res.json({ success: true, saldos });
    } catch (error) {
      logger.error("Error al obtener saldos iniciales", {
        error: error instanceof Error ? error.message : "Unknown error",
        pointId: req.params.pointId,
      });
      return res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    }
  }
);

// ======================= POST: asignar / INCREMENTAR =======================
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request<unknown, unknown, PostSaldoBody>, res: Response) => {
    try {
      const {
        punto_atencion_id,
        moneda_id,
        cantidad_inicial,
        observaciones,
        billetes,
        monedas_fisicas,
      } = req.body ?? {};

      // Validaciones base: aceptar cantidad_inicial o billetes/monedas_fisicas
      const hasCantidad =
        cantidad_inicial !== undefined && cantidad_inicial !== null;
      const hasDesglose =
        billetes !== undefined || monedas_fisicas !== undefined;

      if (!punto_atencion_id || !moneda_id || (!hasCantidad && !hasDesglose)) {
        return res
          .status(400)
          .json({ success: false, error: "Faltan campos obligatorios" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: "No autorizado" });
      }
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, error: "No autorizado" });
      }

      // Validar punto y moneda existen y están activos
      const [punto, moneda] = await Promise.all([
        prisma.puntoAtencion.findUnique({
          where: { id: punto_atencion_id },
          select: { id: true, activo: true },
        }),
        prisma.moneda.findUnique({
          where: { id: moneda_id },
          select: { id: true, activo: true },
        }),
      ]);
      if (!punto || punto.activo === false) {
        return res.status(404).json({
          success: false,
          error: "Punto de atención inválido o inactivo",
        });
      }
      if (!moneda || moneda.activo === false) {
        return res
          .status(400)
          .json({ success: false, error: "Moneda inválida o inactiva" });
      }

      // Parseo y redondeo
      const totalFromField = toNumber(cantidad_inicial);
      const billetesNum =
        billetes !== undefined ? toNumber(billetes) : undefined;
      const monedasNum =
        monedas_fisicas !== undefined ? toNumber(monedas_fisicas) : undefined;

      if (
        (billetes !== undefined &&
          (!Number.isFinite(billetesNum ?? NaN) || isNaN(billetesNum ?? NaN))) ||
        (monedas_fisicas !== undefined &&
          (!Number.isFinite(monedasNum ?? NaN) || isNaN(monedasNum ?? NaN)))
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Billetes/monedas inválidos" });
      }
      if ((billetesNum ?? 0) < 0 || (monedasNum ?? 0) < 0) {
        return res.status(400).json({
          success: false,
          error: "Billetes/monedas no pueden ser negativos",
        });
      }

      // ✅ NUEVA LÓGICA: Garantizar coherencia
      let cantidad = totalFromField;
      let incBilletes = round2(billetesNum ?? 0);
      let incMonedas = round2(monedasNum ?? 0);

      // Caso 1: Se envía CANTIDAD e DESGLOSE
      if (hasCantidad && hasDesglose) {
        cantidad = round2(cantidad);
        const desgloseTotal = incBilletes + incMonedas;
        
        // ⚠️ Validar consistencia
        if (Math.abs(cantidad - desgloseTotal) > 0.01) {
          return res.status(400).json({
            success: false,
            error: "Inconsistencia de datos",
            details: {
              mensaje: "La cantidad_inicial debe ser igual a billetes + monedas",
              cantidad_inicial: cantidad,
              billetes: incBilletes,
              monedas: incMonedas,
              suma_recibida: desgloseTotal,
            },
          });
        }
      }
      // Caso 2: Se envía SOLO DESGLOSE
      else if (!hasCantidad && hasDesglose) {
        cantidad = round2(incBilletes + incMonedas);
      }
      // Caso 3: Se envía SOLO CANTIDAD
      else if (hasCantidad && !hasDesglose) {
        cantidad = round2(cantidad);
        // Distribuir 50/50 para mantener consistencia
        incBilletes = round2(cantidad / 2);
        incMonedas = round2(cantidad - incBilletes); // Asegurar suma exacta
      }

      // Validaciones finales
      if (!Number.isFinite(cantidad) || isNaN(cantidad)) {
        return res
          .status(400)
          .json({ success: false, error: "Cantidad inválida" });
      }
      if (cantidad <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "La cantidad debe ser mayor a 0" });
      }
      
      // Verificar que billetes + monedas = cantidad (dentro de tolerancia de redondeo)
      if (Math.abs((incBilletes + incMonedas) - cantidad) > 0.01) {
        return res.status(400).json({
          success: false,
          error: "Error interno: desglose no suma correctamente",
        });
      }

      // Transacción: incrementar sin usar { increment } (evita fallos con NULL históricos)
      const resultado = await prisma.$transaction(async (tx) => {
        const decCantidad = new Prisma.Decimal(cantidad);
        const decBilletes = new Prisma.Decimal(incBilletes);
        const decMonedas = new Prisma.Decimal(incMonedas);

        // 1) SaldoInicial activo: si existe, sumar; si no, crear
        const existingInicial = await tx.saldoInicial.findFirst({
          where: { punto_atencion_id, moneda_id, activo: true },
          select: { id: true, cantidad_inicial: true, observaciones: true },
        });

        let saldoInicialResult;
        if (existingInicial) {
          const baseInicial = new Prisma.Decimal(
            existingInicial.cantidad_inicial ?? 0
          );
          saldoInicialResult = await tx.saldoInicial.update({
            where: { id: existingInicial.id },
            data: {
              cantidad_inicial: baseInicial.add(decCantidad),
              observaciones:
                observaciones ?? existingInicial.observaciones ?? null,
            },
          });
        } else {
          saldoInicialResult = await tx.saldoInicial.create({
            data: {
              punto_atencion_id,
              moneda_id,
              cantidad_inicial: decCantidad,
              asignado_por: user.id,
              observaciones: observaciones ?? null,
              activo: true,
            },
          });
        }

        // 2) Saldo actual: si existe, sumar; si no, crear
        const existingSaldo = await tx.saldo.findFirst({
          where: { punto_atencion_id, moneda_id },
          select: {
            id: true,
            cantidad: true,
            billetes: true,
            monedas_fisicas: true,
          },
        });

        let saldoResult;
        if (existingSaldo) {
          const baseCantidad = new Prisma.Decimal(
            existingSaldo.cantidad ?? 0
          ).add(decCantidad);
          const baseBilletes = new Prisma.Decimal(
            existingSaldo.billetes ?? 0
          ).add(decBilletes);
          const baseMonedas = new Prisma.Decimal(
            existingSaldo.monedas_fisicas ?? 0
          ).add(decMonedas);

          saldoResult = await tx.saldo.update({
            where: { id: existingSaldo.id },
            data: {
              cantidad: baseCantidad,
              billetes: baseBilletes,
              monedas_fisicas: baseMonedas,
            },
          });
        } else {
          saldoResult = await tx.saldo.create({
            data: {
              punto_atencion_id,
              moneda_id,
              cantidad: decCantidad,
              billetes: decBilletes,
              monedas_fisicas: decMonedas,
            },
          });
        }

        // ⚠️ USAR SERVICIO CENTRALIZADO para registrar el movimiento (dentro de la transacción)
        await registrarMovimientoSaldo(
          {
            puntoAtencionId: punto_atencion_id,
            monedaId: moneda_id,
            tipoMovimiento: TipoMovimiento.SALDO_INICIAL,
            monto: decCantidad, // Monto positivo
            saldoAnterior: new Prisma.Decimal(existingSaldo?.cantidad ?? 0),
            saldoNuevo: saldoResult.cantidad,
            tipoReferencia: TipoReferencia.SALDO_INICIAL,
            referenciaId: saldoInicialResult.id,
            descripcion: observaciones || undefined,
            usuarioId: user.id,
          },
          tx
        ); // ⚠️ Pasar el cliente de transacción para atomicidad

        // Registrar historial consolidado de saldo (para auditoría)
        await tx.historialSaldo.create({
          data: {
            punto_atencion_id,
            moneda_id,
            usuario_id: user.id,
            cantidad_anterior: new Prisma.Decimal(existingSaldo?.cantidad ?? 0),
            cantidad_incrementada: decCantidad,
            cantidad_nueva: saldoResult.cantidad,
            tipo_movimiento: "INGRESO", // corresponde a aumento de saldo
            descripcion: observaciones ?? null,
            numero_referencia: saldoInicialResult.id,
          },
        });

        return {
          saldoInicialResult,
          saldoResult,
          updated: Boolean(existingInicial),
        };
      });

      logger.info("Saldo inicial asignado/incrementado", {
        saldoInicialId: resultado.saldoInicialResult.id,
        puntoAtencionId: punto_atencion_id,
        monedaId: moneda_id,
        cantidad: cantidad,
        createdBy: user.id,
      });

      return res.json({
        success: true,
        saldo: resultado.saldoInicialResult,
        updated: resultado.updated,
      });
    } catch (error: unknown) {
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Error al asignar saldo inicial", {
        error: message,
        code,
        requestedBy: req.user?.id,
      });

      if (code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "Saldo inicial ya existe (unicidad)",
        });
      }
      if (code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Referencia inválida (FK)",
        });
      }
      if (code === "P2025") {
        return res.status(404).json({
          success: false,
          error: "Registro no encontrado",
        });
      }

      return res.status(500).json({
        success: false,
        error: "Error al asignar saldo inicial",
      });
    }
  }
);

export default router;
