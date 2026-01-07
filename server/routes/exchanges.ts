// server/routes/exchanges.ts
import express from "express";
import {
  EstadoTransaccion,
  TipoOperacion,
  TipoViaTransferencia,
} from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { ServientregaValidationService } from "../services/servientregaValidationService.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { validarSaldoCambioDivisa } from "../middleware/saldoValidation.js";
import { z } from "zod";
import axios from "axios";
import {
  todayGyeDateOnly,
  gyeDayRangeUtcFromDateOnly,
} from "../utils/timezone.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

/* ========================= Helpers numéricos / guardas ========================= */

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const isUSDByCode = (codigo?: string | null) =>
  (codigo || "").toUpperCase() === "USD";

const round2 = (x: number) =>
  Math.round((Number(x) + Number.EPSILON) * 100) / 100;
// General rounding helper for N decimals (useful for DB fields with scale > 2)
const roundN = (x: number, n = 6) => {
  const factor = Math.pow(10, n);
  return Math.round((Number(x) + Number.EPSILON) * factor) / factor;
};

async function getSaldo(tx: any, puntoId: string, monedaId: string) {
  return tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
      },
    },
  });
}
async function upsertSaldoEfectivoYBancos(
  tx: any,
  puntoId: string,
  monedaId: string,
  data: {
    cantidad?: number;
    billetes?: number;
    monedas_fisicas?: number;
    bancos?: number;
  }
) {
  const existing = await getSaldo(tx, puntoId, monedaId);
  if (existing) {
    return tx.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoId,
          moneda_id: monedaId,
        },
      },
      data: {
        ...(typeof data.cantidad === "number" && {
          cantidad: round2(data.cantidad),
        }),
        ...(typeof data.billetes === "number" && {
          billetes: round2(data.billetes),
        }),
        ...(typeof data.monedas_fisicas === "number" && {
          monedas_fisicas: round2(data.monedas_fisicas),
        }),
        ...(typeof existing.bancos !== "undefined"
          ? {
              bancos:
                typeof data.bancos === "number"
                  ? round2(data.bancos)
                  : existing.bancos,
            }
          : {}),
        updated_at: new Date(),
      },
    });
  }
  return tx.saldo.create({
    data: {
      punto_atencion_id: puntoId,
      moneda_id: monedaId,
      cantidad: round2(data.cantidad ?? 0),
      billetes: round2(data.billetes ?? 0),
      monedas_fisicas: round2(data.monedas_fisicas ?? 0),
      ...(typeof data.bancos !== "undefined"
        ? { bancos: round2(data.bancos) }
        : {}),
      updated_at: new Date(),
    },
  });
}

async function logMovimientoSaldo(
  tx: any,
  data: {
    punto_atencion_id: string;
    moneda_id: string;
    tipo_movimiento: "INGRESO" | "EGRESO" | "AJUSTE";
    monto: number;
    saldo_anterior: number;
    saldo_nuevo: number;
    usuario_id: string;
    referencia_id: string;
    tipo_referencia:
      | "CAMBIO_DIVISA"
      | "TRANSFERENCIA"
      | "SERVICIO_EXTERNO"
      | "AJUSTE_MANUAL"
      | "RECIBO";
    descripcion?: string | null;
  }
) {
  // Usar servicio centralizado
  const tipoMov =
    data.tipo_movimiento === "INGRESO"
      ? TipoMovimiento.INGRESO
      : data.tipo_movimiento === "EGRESO"
      ? TipoMovimiento.EGRESO
      : TipoMovimiento.AJUSTE;

  const tipoRef =
    data.tipo_referencia === "CAMBIO_DIVISA"
      ? TipoReferencia.EXCHANGE
      : data.tipo_referencia === "TRANSFERENCIA"
      ? TipoReferencia.TRANSFER
      : data.tipo_referencia === "SERVICIO_EXTERNO"
      ? TipoReferencia.SERVICIO_EXTERNO
      : TipoReferencia.AJUSTE_MANUAL;

  // El monto ya viene con el signo correcto desde las llamadas
  // pero el servicio espera monto positivo, así que tomamos el valor absoluto
  const montoAbsoluto = Math.abs(data.monto);

  await registrarMovimientoSaldo(
    {
      puntoAtencionId: data.punto_atencion_id,
      monedaId: data.moneda_id,
      tipoMovimiento: tipoMov,
      monto: montoAbsoluto, // ⚠️ Pasar monto POSITIVO, el servicio aplica el signo
      saldoAnterior: round2(data.saldo_anterior),
      saldoNuevo: round2(data.saldo_nuevo),
      tipoReferencia: tipoRef,
      referenciaId: data.referencia_id,
      descripcion: data.descripcion || undefined,
      usuarioId: data.usuario_id,
    },
    tx
  ); // ⚠️ Pasar el cliente de transacción para atomicidad
}

/* ========================= Validación payload ========================= */

const exchangeSchema = z.object({
  moneda_origen_id: z.string().uuid(),
  moneda_destino_id: z.string().uuid(),
  monto_origen: z.number().positive(),
  monto_destino: z.number().positive(),

  tasa_cambio_billetes: z.number().nonnegative().default(0),
  tasa_cambio_monedas: z.number().nonnegative().default(0),

  tipo_operacion: z.nativeEnum(TipoOperacion),
  punto_atencion_id: z.string().uuid(),
  datos_cliente: z.object({
    nombre: z.string(),
    apellido: z.string(),
    documento: z.string().optional().nullable(),
    cedula: z.string(),
    telefono: z.string().optional(),
  }),

  // MONEDA ORIGEN (lo que entrega el cliente)
  divisas_entregadas_billetes: z.number().default(0),
  divisas_entregadas_monedas: z.number().default(0),
  divisas_entregadas_total: z.number().default(0),

  // MONEDA DESTINO (lo que recibe el cliente)
  divisas_recibidas_billetes: z.number().default(0),
  divisas_recibidas_monedas: z.number().default(0),
  divisas_recibidas_total: z.number().default(0),

  // DESTINO: Entrega USD (efectivo/transfer/mixto) – para reporte y bancos
  metodo_entrega: z
    .enum(["efectivo", "transferencia", "mixto"])
    .default("efectivo"),
  usd_entregado_efectivo: z.number().optional().nullable(),
  usd_entregado_transfer: z.number().optional().nullable(),

  // ORIGEN: método de pago del cliente
  metodo_pago_origen: z
    .nativeEnum(TipoViaTransferencia)
    .default(TipoViaTransferencia.EFECTIVO), // EFECTIVO | BANCO | MIXTO
  usd_recibido_efectivo: z.number().optional().nullable(),
  usd_recibido_transfer: z.number().optional().nullable(),

  observacion: z.string().optional(),
  transferencia_numero: z.string().optional().nullable(),
  transferencia_banco: z.string().optional().nullable(),
  transferencia_imagen_url: z.string().optional().nullable(),
  abono_inicial_monto: z.number().optional().nullable(),
  abono_inicial_fecha: z.string().optional().nullable(),
  abono_inicial_recibido_por: z.string().optional().nullable(),
  saldo_pendiente: z.number().optional().nullable(),
  referencia_cambio_principal: z.string().optional().nullable(),
});

interface ExchangeWhereClause {
  punto_atencion_id?: string;
  usuario_id?: string;
  estado?: EstadoTransaccion;
}

interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: string;
  activo: boolean;
  punto_atencion_id: string | null;
}
interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

/* ========================= Crear cambio ========================= */

router.post(
  "/",
  authenticateToken,
  validate(exchangeSchema),
  validarSaldoCambioDivisa, // 🛡️ Validar saldo suficiente antes del cambio
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res
          .status(401)
          .json({ success: false, error: "Usuario no autenticado" });
        return;
      }

      let {
        moneda_origen_id,
        moneda_destino_id,
        monto_origen,
        monto_destino,
        tasa_cambio_billetes,
        tasa_cambio_monedas,
        tipo_operacion,
        punto_atencion_id,
        datos_cliente,
        divisas_entregadas_billetes,
        divisas_entregadas_monedas,
        divisas_entregadas_total,
        divisas_recibidas_billetes,
        divisas_recibidas_monedas,
        divisas_recibidas_total,
        observacion,
        metodo_entrega,
        usd_entregado_efectivo,
        usd_entregado_transfer,
        metodo_pago_origen,
        usd_recibido_efectivo,
        usd_recibido_transfer,
        transferencia_numero,
        transferencia_banco,
        transferencia_imagen_url,
        abono_inicial_monto,
        abono_inicial_fecha,
        abono_inicial_recibido_por,
        saldo_pendiente,
        referencia_cambio_principal,
      } = req.body;

      // Normalización del par cuando una de las monedas es USD (COMPRA -> USD destino, VENTA -> USD origen)
      try {
        const usdMoneda = await prisma.moneda.findFirst({
          where: { codigo: "USD" },
        });
        if (
          usdMoneda &&
          (moneda_origen_id === usdMoneda.id ||
            moneda_destino_id === usdMoneda.id)
        ) {
          const isCompra = tipo_operacion === "COMPRA";
          const isVenta = tipo_operacion === "VENTA";
          if (isCompra && moneda_origen_id === usdMoneda.id) {
            [moneda_origen_id, moneda_destino_id] = [
              moneda_destino_id,
              moneda_origen_id,
            ];
            [monto_origen, monto_destino] = [monto_destino, monto_origen];
            [divisas_entregadas_billetes, divisas_recibidas_billetes] = [
              divisas_recibidas_billetes,
              divisas_entregadas_billetes,
            ];
            [divisas_entregadas_monedas, divisas_recibidas_monedas] = [
              divisas_recibidas_monedas,
              divisas_entregadas_monedas,
            ];
            [divisas_entregadas_total, divisas_recibidas_total] = [
              divisas_recibidas_total,
              divisas_entregadas_total,
            ];
          } else if (isVenta && moneda_destino_id === usdMoneda.id) {
            [moneda_origen_id, moneda_destino_id] = [
              moneda_destino_id,
              moneda_origen_id,
            ];
            [monto_origen, monto_destino] = [monto_destino, monto_origen];
            [divisas_entregadas_billetes, divisas_recibidas_billetes] = [
              divisas_recibidas_billetes,
              divisas_entregadas_billetes,
            ];
            [divisas_entregadas_monedas, divisas_recibidas_monedas] = [
              divisas_recibidas_monedas,
              divisas_entregadas_monedas,
            ];
            [divisas_entregadas_total, divisas_recibidas_total] = [
              divisas_recibidas_total,
              divisas_entregadas_total,
            ];
          }
        }
      } catch (e) {
        logger.warn("No se pudo normalizar par USD (continuando)", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Monedas distintas
      if (moneda_origen_id === moneda_destino_id) {
        res.status(400).json({
          success: false,
          error: "Moneda origen y destino no pueden ser iguales",
        });
        return;
      }

      // Validación mínima de transferencia (solo para la ENTREGA)
      if (metodo_entrega === "transferencia") {
        if (!transferencia_banco || !String(transferencia_banco).trim()) {
          res.status(400).json({
            success: false,
            error: "Banco requerido para transferencia",
          });
          return;
        }
        if (!transferencia_numero || !String(transferencia_numero).trim()) {
          res.status(400).json({
            success: false,
            error: "Número de referencia requerido para transferencia",
          });
          return;
        }
      }

      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: punto_atencion_id },
      });
      if (!punto) {
        res
          .status(400)
          .json({ success: false, error: "Punto de atención no encontrado" });
        return;
      }

      const [monedaOrigen, monedaDestino] = await Promise.all([
        prisma.moneda.findUnique({ where: { id: moneda_origen_id } }),
        prisma.moneda.findUnique({ where: { id: moneda_destino_id } }),
      ]);
      if (!monedaOrigen || !monedaDestino) {
        res.status(400).json({
          success: false,
          error: "Una o ambas monedas no fueron encontradas",
        });
        return;
      }

      // === Conversión por convención de tasa (multiplicar/dividir según divisa) ===
      type RateMode = "USD_PER_UNIT" | "UNITS_PER_USD";
      const rateModeByCode: Record<string, RateMode> = {
        EUR: "USD_PER_UNIT",
        GBP: "USD_PER_UNIT",
        CHF: "USD_PER_UNIT",
        JPY: "USD_PER_UNIT",
        COP: "UNITS_PER_USD",
        PYG: "UNITS_PER_USD",
        CLP: "UNITS_PER_USD",
        PEN: "UNITS_PER_USD",
        ARS: "UNITS_PER_USD",
        MXN: "UNITS_PER_USD",
        BRL: "UNITS_PER_USD",
        UYU: "UNITS_PER_USD",
        DOP: "UNITS_PER_USD",
      };
      const tasaEfectiva =
        num(tasa_cambio_billetes) > 0
          ? num(tasa_cambio_billetes)
          : num(tasa_cambio_monedas) > 0
          ? num(tasa_cambio_monedas)
          : 0;

      const codigoOrigen = (monedaOrigen?.codigo || "").toUpperCase();
      const codigoDestino = (monedaDestino?.codigo || "").toUpperCase();

      function getRateModeForPair(
        codOrigen: string,
        codDestino: string
      ): RateMode {
        if (codOrigen === "USD" && codDestino !== "USD") {
          return rateModeByCode[codDestino] ?? "UNITS_PER_USD";
        }
        if (codDestino === "USD" && codOrigen !== "USD") {
          return rateModeByCode[codOrigen] ?? "UNITS_PER_USD";
        }
        return rateModeByCode[codDestino] ?? "USD_PER_UNIT";
      }

      function convertir(
        _tipo: TipoOperacion,
        modo: RateMode,
        montoOrigen: number,
        tasa: number,
        codOrigen: string,
        codDestino: string
      ) {
        if (!Number.isFinite(tasa) || tasa <= 0) return { montoDestinoCalc: 0 };

        if (codOrigen === "USD" && codDestino !== "USD") {
          // VENTA: USD -> DIVISA
          if (modo === "UNITS_PER_USD")
            return { montoDestinoCalc: montoOrigen * tasa };
          return { montoDestinoCalc: montoOrigen / tasa };
        }
        if (codDestino === "USD" && codOrigen !== "USD") {
          // COMPRA: DIVISA -> USD
          if (modo === "UNITS_PER_USD")
            return { montoDestinoCalc: montoOrigen / tasa };
          return { montoDestinoCalc: montoOrigen * tasa };
        }
        // Cross (no USD): no forzamos cálculo
        return { montoDestinoCalc: 0 };
      }

      // === Recalcular totales coherentes (manteniendo compatibilidad) ===
      const entregadas_total_calc =
        num(divisas_entregadas_billetes) + num(divisas_entregadas_monedas);
      const recibidas_total_calc =
        num(divisas_recibidas_billetes) + num(divisas_recibidas_monedas);

      let monto_origen_final =
        num(monto_origen) > 0 ? num(monto_origen) : entregadas_total_calc;
      let monto_destino_final =
        num(monto_destino) > 0 ? num(monto_destino) : recibidas_total_calc;

      const divisas_entregadas_total_final =
        num(divisas_entregadas_total) > 0
          ? num(divisas_entregadas_total)
          : entregadas_total_calc;

      const divisas_recibidas_total_final =
        num(divisas_recibidas_total) > 0
          ? num(divisas_recibidas_total)
          : recibidas_total_calc;

      // Recalcular destino si está en cero (aunque vengan parciales de UI)
      if (
        tasaEfectiva > 0 &&
        (codigoOrigen === "USD" || codigoDestino === "USD")
      ) {
        const modo = getRateModeForPair(codigoOrigen, codigoDestino);
        if (monto_destino_final === 0 && monto_origen_final > 0) {
          const { montoDestinoCalc } = convertir(
            tipo_operacion,
            modo,
            monto_origen_final,
            tasaEfectiva,
            codigoOrigen,
            codigoDestino
          );
          if (montoDestinoCalc > 0) {
            monto_destino_final = round2(montoDestinoCalc);
          }
        }
      }

      if (!(monto_origen_final > 0 && monto_destino_final > 0)) {
        res.status(400).json({
          success: false,
          error: "Montos inválidos: deben ser mayores a 0",
          details: {
            monto_origen: monto_origen_final,
            monto_destino: monto_destino_final,
          },
        });
        return;
      }

      // Normalización de datos de cliente
      // Validar identificación del cliente (cedula o documento)
      const idCliente = String(
        (datos_cliente?.documento && String(datos_cliente.documento).trim()) ||
        (datos_cliente?.cedula && String(datos_cliente.cedula).trim()) ||
        ""
      );
      const datos_cliente_sanitized = {
        ...datos_cliente,
        documento:
          (datos_cliente?.documento && String(datos_cliente.documento).trim()) ||
          (datos_cliente?.cedula && String(datos_cliente.cedula).trim()) ||
          "",
      };

      // Normalizar campos USD por método de entrega (solo para reportes; el CUADRE es solo EFECTIVO)
      if (isUSDByCode(monedaDestino.codigo)) {
        if (metodo_entrega === "efectivo") {
          usd_entregado_efectivo = divisas_recibidas_total_final;
          usd_entregado_transfer = 0;
        } else if (metodo_entrega === "transferencia") {
          usd_entregado_efectivo = 0;
          usd_entregado_transfer = divisas_recibidas_total_final;
        } else {
          usd_entregado_efectivo = num(usd_entregado_efectivo);
          usd_entregado_transfer = num(usd_entregado_transfer);
          const tot = divisas_recibidas_total_final;
          if (
            round2(
              (usd_entregado_efectivo || 0) + (usd_entregado_transfer || 0)
            ) !== round2(tot)
          ) {
            // fallback prudente
            usd_entregado_efectivo = round2(tot / 2);
            usd_entregado_transfer = round2(tot - usd_entregado_efectivo);
          }
        }
      }

      // Normalizar ORIGEN (método de pago del cliente) – solo para registrar bancos vs efectivo
      metodo_pago_origen = metodo_pago_origen || TipoViaTransferencia.EFECTIVO;
      if (metodo_pago_origen === TipoViaTransferencia.EFECTIVO) {
        usd_recibido_efectivo = divisas_entregadas_total_final;
        usd_recibido_transfer = 0;
      } else if (metodo_pago_origen === TipoViaTransferencia.BANCO) {
        usd_recibido_efectivo = 0;
        usd_recibido_transfer = divisas_entregadas_total_final;
      } else {
        // MIXTO
        usd_recibido_efectivo = num(usd_recibido_efectivo);
        usd_recibido_transfer = num(usd_recibido_transfer);
        const tot = divisas_entregadas_total_final;
        if (
          round2(
            (usd_recibido_efectivo || 0) + (usd_recibido_transfer || 0)
          ) !== round2(tot)
        ) {
          usd_recibido_efectivo = round2(tot / 2);
          usd_recibido_transfer = round2(tot - usd_recibido_efectivo);
        }
      }

      const numeroRecibo = `CAM-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      // Validar que las tasas caben en la columna Decimal(10,6) de la BD.
      // Decimal(10,6) permite como máximo 4 dígitos en la parte entera (|int| < 10^4).
      const MAX_INT_FOR_RATE = 10000; // exclusive upper bound
      if (
        Math.abs(num(tasa_cambio_billetes)) >= MAX_INT_FOR_RATE ||
        Math.abs(num(tasa_cambio_monedas)) >= MAX_INT_FOR_RATE
      ) {
        res.status(400).json({
          success: false,
          error:
            "tasa_cambio fuera de rango para almacenamiento (Decimal(10,6)).",
          detalles: {
            tasa_cambio_billetes: tasa_cambio_billetes,
            tasa_cambio_monedas: tasa_cambio_monedas,
            max_integer_allowed: MAX_INT_FOR_RATE - 1,
          },
        });
        return;
      }

      // ========= Transacción atómica =========
      const exchange = await prisma.$transaction(async (tx) => {
        // 1) Crear cambio
        const cambio = await tx.cambioDivisa.create({
          data: {
            moneda_origen_id,
            moneda_destino_id,
            monto_origen: round2(monto_origen_final),
            monto_destino: round2(monto_destino_final),
            tasa_cambio_billetes: roundN(num(tasa_cambio_billetes), 6),
            tasa_cambio_monedas: roundN(num(tasa_cambio_monedas), 6),
            tipo_operacion,
            usuario_id: req.user!.id,
            punto_atencion_id,
            observacion: observacion || null,
            numero_recibo: numeroRecibo,
            estado:
              num(saldo_pendiente) > 0
                ? EstadoTransaccion.PENDIENTE
                : EstadoTransaccion.COMPLETADO,
            metodo_entrega,
            transferencia_numero:
              metodo_entrega !== "efectivo"
                ? transferencia_numero || null
                : null,
            transferencia_banco:
              metodo_entrega !== "efectivo"
                ? transferencia_banco || null
                : null,
            transferencia_imagen_url:
              metodo_entrega !== "efectivo"
                ? transferencia_imagen_url || null
                : null,
            // DESTINO USD
            usd_entregado_efectivo:
              typeof usd_entregado_efectivo === "number"
                ? round2(usd_entregado_efectivo)
                : null,
            usd_entregado_transfer:
              typeof usd_entregado_transfer === "number"
                ? round2(usd_entregado_transfer)
                : null,
            // ORIGEN (nuevo)
            metodo_pago_origen,
            usd_recibido_efectivo:
              typeof usd_recibido_efectivo === "number"
                ? round2(usd_recibido_efectivo)
                : null,
            usd_recibido_transfer:
              typeof usd_recibido_transfer === "number"
                ? round2(usd_recibido_transfer)
                : null,

            abono_inicial_monto:
              typeof abono_inicial_monto === "number"
                ? round2(abono_inicial_monto)
                : null,
            abono_inicial_fecha: abono_inicial_fecha
              ? new Date(abono_inicial_fecha)
              : null,
            abono_inicial_recibido_por: abono_inicial_recibido_por ?? null,
            saldo_pendiente:
              typeof saldo_pendiente === "number"
                ? round2(saldo_pendiente)
                : null,
            referencia_cambio_principal: referencia_cambio_principal ?? null,
            cliente: `${datos_cliente_sanitized.nombre} ${datos_cliente_sanitized.apellido}`,
            divisas_entregadas_billetes: round2(
              num(divisas_entregadas_billetes)
            ),
            divisas_entregadas_monedas: round2(num(divisas_entregadas_monedas)),
            divisas_entregadas_total: round2(divisas_entregadas_total_final),
            divisas_recibidas_billetes: round2(num(divisas_recibidas_billetes)),
            divisas_recibidas_monedas: round2(num(divisas_recibidas_monedas)),
            divisas_recibidas_total: round2(divisas_recibidas_total_final),
          },
          select: {
            id: true,
            fecha: true,
            tipo_operacion: true,
            estado: true,
            monto_origen: true,
            monto_destino: true,
            tasa_cambio_billetes: true,
            tasa_cambio_monedas: true,
            observacion: true,
            numero_recibo: true,
            numero_recibo_abono: true,
            numero_recibo_completar: true,
            cliente: true,
            divisas_entregadas_total: true,
            divisas_entregadas_billetes: true,
            divisas_entregadas_monedas: true,
            divisas_recibidas_total: true,
            divisas_recibidas_billetes: true,
            divisas_recibidas_monedas: true,
            saldo_pendiente: true,
            abono_inicial_monto: true,
            abono_inicial_fecha: true,
            fecha_completado: true,
            metodo_entrega: true,
            transferencia_banco: true,
            transferencia_numero: true,
            transferencia_imagen_url: true,
            usd_entregado_efectivo: true,
            usd_entregado_transfer: true,
            // usd_recibido_efectivo: true,
            // usd_recibido_transfer: true,
            // metodo_pago_origen: true,
            monedaOrigen: {
              select: { id: true, nombre: true, codigo: true, simbolo: true },
            },
            monedaDestino: {
              select: { id: true, nombre: true, codigo: true, simbolo: true },
            },
            usuario: { select: { id: true, nombre: true, username: true } },
            puntoAtencion: { select: { id: true, nombre: true } },
          },
        });

        // 2) Recibo
        await tx.recibo.create({
          data: {
            numero_recibo: numeroRecibo,
            tipo_operacion: "CAMBIO_DIVISA",
            referencia_id: cambio.id,
            usuario_id: req.user!.id,
            punto_atencion_id,
            datos_operacion: {
              ...cambio,
              datos_cliente: datos_cliente_sanitized,
              divisas_entregadas: {
                billetes: round2(num(divisas_entregadas_billetes)),
                monedas: round2(num(divisas_entregadas_monedas)),
                total: round2(divisas_entregadas_total_final),
              },
              divisas_recibidas: {
                billetes: round2(num(divisas_recibidas_billetes)),
                monedas: round2(num(divisas_recibidas_monedas)),
                total: round2(divisas_recibidas_total_final),
              },
            },
          },
        });

        // 3) SALDOS Y CUADRE DE CAJA
        // ═══════════════════════════════════════════════════════════════════════
        // REGLAS DE NEGOCIO:
        // 1. EFECTIVO: Se controla al centavo, afecta cuadre de caja
        // 2. BANCOS: NO tiene límites, solo es registro, NO afecta cuadre
        // 3. CAMBIOS PARCIALES: Cuando el punto no tiene divisas suficientes:
        //    - Cliente deja abono inicial (ej: 30% del total)
        //    - Sistema actualiza SOLO el 30% de los saldos físicos
        //    - Cliente firma compromiso y regresa después
        //    - Al completar, se actualiza el 70% restante
        // 4. TRANSFERENCIAS: Poco común, solo cuando hay cantidades muy grandes
        // ═══════════════════════════════════════════════════════════════════════

        // ✅ Calcular porcentaje de actualización según estado
        const porcentajeActualizacion =
          cambio.estado === EstadoTransaccion.PENDIENTE &&
          num(abono_inicial_monto) > 0
            ? num(abono_inicial_monto) / monto_destino_final
            : 1.0; // 100% si está completado o no hay abono

        // 3.1 Origen (INGRESO efectivo/bancos según metodo_pago_origen)
        const saldoOrigen = await getSaldo(
          tx,
          punto_atencion_id,
          moneda_origen_id
        );
        const origenAnteriorEf = num(saldoOrigen?.cantidad);
        let origenAnteriorBil = num(saldoOrigen?.billetes);
        let origenAnteriorMon = num(saldoOrigen?.monedas_fisicas);
        // Fallback: si ambos son 0 pero el total físico es positivo, asignar todo a billetes
        if (origenAnteriorBil === 0 && origenAnteriorMon === 0 && origenAnteriorEf > 0) {
          origenAnteriorBil = origenAnteriorEf;
        }
        const origenAnteriorBk =
          typeof saldoOrigen?.bancos !== "undefined"
            ? num(saldoOrigen?.bancos)
            : 0;

        // ✅ APLICAR PORCENTAJE: Solo actualizar según el abono inicial si es PENDIENTE
        const ingresoEf = round2(
          num(usd_recibido_efectivo) * porcentajeActualizacion
        );
        const ingresoBk = round2(
          num(usd_recibido_transfer) * porcentajeActualizacion
        );

        // breakdown físico solo si entra efectivo (también aplicar porcentaje)
        let ingresoBil = 0;
        let ingresoMon = 0;

        if (ingresoEf > 0) {
          // Calcular proporción de billetes y monedas
          const totalEntregado =
            num(divisas_entregadas_billetes) + num(divisas_entregadas_monedas);

          if (totalEntregado > 0) {
            const proporcionBilletes =
              num(divisas_entregadas_billetes) / totalEntregado;
            const proporcionMonedas =
              num(divisas_entregadas_monedas) / totalEntregado;

            // Aplicar proporción al ingreso efectivo para mantener coherencia
            ingresoBil = round2(ingresoEf * proporcionBilletes);
            ingresoMon = round2(ingresoEf * proporcionMonedas);

            // Ajustar por diferencias de redondeo: asegurar que billetes + monedas = total
            const diferencia = ingresoEf - (ingresoBil + ingresoMon);
            if (Math.abs(diferencia) > 0.01) {
              // Si hay diferencia significativa, ajustar el componente mayor
              if (ingresoBil >= ingresoMon) {
                ingresoBil = round2(ingresoBil + diferencia);
              } else {
                ingresoMon = round2(ingresoMon + diferencia);
              }
            }
          } else {
            // Si no hay breakdown, todo va a billetes por defecto
            ingresoBil = ingresoEf;
            ingresoMon = 0;
          }
        }

        const origenNuevoEf = round2(origenAnteriorEf + ingresoEf);
        const origenNuevoBil = round2(origenAnteriorBil + ingresoBil);
        const origenNuevoMon = round2(origenAnteriorMon + ingresoMon);
        const origenNuevoBk = round2(origenAnteriorBk + ingresoBk);

        await upsertSaldoEfectivoYBancos(
          tx,
          punto_atencion_id,
          moneda_origen_id,
          {
            cantidad: origenNuevoEf,
            billetes: origenNuevoBil,
            monedas_fisicas: origenNuevoMon,
            ...(typeof saldoOrigen?.bancos !== "undefined"
              ? { bancos: origenNuevoBk }
              : {}),
          }
        );

        if (ingresoEf > 0) {
          await logMovimientoSaldo(tx, {
            punto_atencion_id,
            moneda_id: moneda_origen_id,
            tipo_movimiento: "INGRESO",
            monto: ingresoEf,
            saldo_anterior: origenAnteriorEf,
            saldo_nuevo: origenNuevoEf,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Ingreso por cambio (efectivo, origen) ${numeroRecibo}`,
          });
        }
        // BANCOS: Solo registro, NO afecta cuadre de caja
        // Los bancos NO tienen límite ni control estricto, solo son para trazabilidad
        if (ingresoBk > 0 && typeof saldoOrigen?.bancos !== "undefined") {
          await logMovimientoSaldo(tx, {
            punto_atencion_id,
            moneda_id: moneda_origen_id,
            tipo_movimiento: "INGRESO",
            monto: ingresoBk,
            saldo_anterior: origenAnteriorBk,
            saldo_nuevo: origenNuevoBk,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Ingreso por cambio (transferencia bancaria - NO afecta cuadre físico)`,
          });
        }

        // 3.2 Destino (EGRESO efectivo y/o bancos)
        const saldoDestino = await getSaldo(
          tx,
          punto_atencion_id,
          moneda_destino_id
        );
        const destinoAnteriorEf = num(saldoDestino?.cantidad);
        let destinoAnteriorBil = num(saldoDestino?.billetes);
        let destinoAnteriorMon = num(saldoDestino?.monedas_fisicas);
        // Fallback: si ambos son 0 pero el total físico es positivo, asignar todo a billetes
        if (destinoAnteriorBil === 0 && destinoAnteriorMon === 0 && destinoAnteriorEf > 0) {
          destinoAnteriorBil = destinoAnteriorEf;
        }
        const destinoAnteriorBk =
          typeof saldoDestino?.bancos !== "undefined"
            ? num(saldoDestino?.bancos)
            : 0;

        const isDestinoUSD = isUSDByCode(cambio.monedaDestino?.codigo);
        let egresoEf = 0;
        let egresoBk = 0;

        if (isDestinoUSD) {
          egresoEf = num(usd_entregado_efectivo);
          egresoBk = num(usd_entregado_transfer);
          if (
            round2(egresoEf + egresoBk) !==
            round2(divisas_recibidas_total_final)
          ) {
            const tot = round2(divisas_recibidas_total_final);
            if (metodo_entrega === "efectivo") {
              egresoEf = tot;
              egresoBk = 0;
            } else if (metodo_entrega === "transferencia") {
              egresoEf = 0;
              egresoBk = tot;
            } else {
              egresoEf = round2(tot / 2);
              egresoBk = round2(tot - egresoEf);
            }
          }
        } else {
          const tot = round2(divisas_recibidas_total_final);
          if (metodo_entrega === "efectivo") {
            egresoEf = tot;
            egresoBk = 0;
          } else if (metodo_entrega === "transferencia") {
            egresoEf = 0;
            egresoBk = tot;
          } else {
            egresoEf = num(usd_entregado_efectivo);
            egresoBk = num(usd_entregado_transfer);
            if (round2(egresoEf + egresoBk) !== tot) {
              egresoEf = round2(tot / 2);
              egresoBk = round2(tot - egresoEf);
            }
          }
        }

        // ✅ APLICAR PORCENTAJE al egreso también
        egresoEf = round2(egresoEf * porcentajeActualizacion);
        egresoBk = round2(egresoBk * porcentajeActualizacion);

        // Validaciones de EFECTIVO (estrictas al centavo)
        if (destinoAnteriorEf < egresoEf) {
          throw new Error(
            `Saldo efectivo insuficiente en moneda destino. Disponible: $${destinoAnteriorEf.toFixed(
              2
            )}, Requerido: $${egresoEf.toFixed(2)}. ` +
              `Considera: 1) Hacer cambio PARCIAL (abono inicial), 2) Transferir desde otro punto, 3) Solicitar asignación de saldo.`
          );
        }

        // BANCOS: NO validar límites (puede ser negativo, es solo registro)
        // Los bancos NO tienen monto mínimo/máximo, solo control para reportes
        // Si hay egreso por banco, simplemente se registra sin validación de saldo

        const destinoNuevoEf = round2(destinoAnteriorEf - egresoEf);
        const destinoNuevoBk = round2(destinoAnteriorBk - egresoBk);

        // ⚠️ Solo tocar billetes/monedas físicas si HAY egreso en efectivo
        let billetesEgreso = 0;
        let monedasEgreso = 0;

        if (egresoEf > 0) {
          // ✅ NUEVA LÓGICA: Distribuir dinero de forma flexible
          // El cliente DESEA recibir X billetes y Y monedas
          // Pero el punto TIENE A billetes y B monedas
          // Intentamos satisfacer el deseo del cliente con lo que tenemos
          
          const billetesDeseados = num(divisas_recibidas_billetes);
          const monedasDeseadas = num(divisas_recibidas_monedas);
          const billetesDisponibles = destinoAnteriorBil;
          const monedasDisponibles = destinoAnteriorMon;

          // Estrategia: Intentar dar al cliente lo que quiere, pero con lo que tenemos
          if (billetesDeseados > 0 || monedasDeseadas > 0) {
            // Caso 1: Cliente especificó una mezcla de billetes y monedas
            const totalDeseado = billetesDeseados + monedasDeseadas;
            
            if (totalDeseado > 0) {
              // Intentar respetar la proporción deseada
              const proporcionBilletesDeseada = billetesDeseados / totalDeseado;
              const proporcionMonedasDeseada = monedasDeseadas / totalDeseado;

              billetesEgreso = round2(egresoEf * proporcionBilletesDeseada);
              monedasEgreso = round2(egresoEf * proporcionMonedasDeseada);

              // Si no tenemos suficientes billetes, usar monedas
              if (billetesEgreso > billetesDisponibles) {
                const excesoBilletes = billetesEgreso - billetesDisponibles;
                billetesEgreso = billetesDisponibles;
                monedasEgreso = round2(monedasEgreso + excesoBilletes);
              }

              // Si no tenemos suficientes monedas, usar billetes
              if (monedasEgreso > monedasDisponibles) {
                const excesoMonedas = monedasEgreso - monedasDisponibles;
                monedasEgreso = monedasDisponibles;
                billetesEgreso = round2(billetesEgreso + excesoMonedas);
              }

              // Ajustar redondeo para que suma = total
              const diferencia = egresoEf - (billetesEgreso + monedasEgreso);
              if (Math.abs(diferencia) > 0.01) {
                if (billetesEgreso <= billetesDisponibles) {
                  billetesEgreso = round2(billetesEgreso + diferencia);
                } else if (monedasEgreso <= monedasDisponibles) {
                  monedasEgreso = round2(monedasEgreso + diferencia);
                }
              }
            } else {
              // No se especificó proporción, usar lo disponible
              billetesEgreso = Math.min(egresoEf, billetesDisponibles);
              monedasEgreso = egresoEf - billetesEgreso;
            }
          } else {
            // Cliente no especificó, usar lo disponible (preferir billetes)
            billetesEgreso = Math.min(egresoEf, billetesDisponibles);
            monedasEgreso = Math.min(egresoEf - billetesEgreso, monedasDisponibles);
          }

          // Validación final: ¿tenemos suficiente dinero en total?
          const totalFisicoDisponible = billetesDisponibles + monedasDisponibles;
          const totalFisicoRequerido = billetesEgreso + monedasEgreso;
          
          if (totalFisicoDisponible < egresoEf - 0.01) {
            throw new Error(
              `Saldo de efectivo insuficiente en moneda destino. Disponible: ${totalFisicoDisponible.toFixed(2)} (${billetesDisponibles.toFixed(2)} billetes + ${monedasDisponibles.toFixed(2)} monedas), Requerido: ${egresoEf.toFixed(2)}`
            );
          }
        }

        const destinoNuevoBil = Math.max(
          0,
          round2(destinoAnteriorBil - billetesEgreso)
        );
        const destinoNuevoMon = Math.max(
          0,
          round2(destinoAnteriorMon - monedasEgreso)
        );

        await upsertSaldoEfectivoYBancos(
          tx,
          punto_atencion_id,
          moneda_destino_id,
          {
            cantidad: destinoNuevoEf,
            billetes: destinoNuevoBil,
            monedas_fisicas: destinoNuevoMon,
            ...(typeof saldoDestino?.bancos !== "undefined"
              ? { bancos: destinoNuevoBk }
              : {}),
          }
        );

        // Movimiento: EFECTIVO (cuadre de caja)
        if (egresoEf > 0) {
          await logMovimientoSaldo(tx, {
            punto_atencion_id,
            moneda_id: moneda_destino_id,
            tipo_movimiento: "EGRESO",
            monto: egresoEf, // ✅ Positivo - el servicio aplica el signo
            saldo_anterior: destinoAnteriorEf,
            saldo_nuevo: destinoNuevoEf,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Egreso por cambio (efectivo, destino) ${numeroRecibo}`,
          });
        }
        // Movimiento: BANCOS (control, NO entra al cuadre de efectivo)
        if (egresoBk > 0 && typeof saldoDestino?.bancos !== "undefined") {
          await logMovimientoSaldo(tx, {
            punto_atencion_id,
            moneda_id: moneda_destino_id,
            tipo_movimiento: "EGRESO",
            monto: egresoBk, // ✅ Positivo - el servicio aplica el signo
            saldo_anterior: destinoAnteriorBk,
            saldo_nuevo: destinoNuevoBk,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Egreso por cambio (bancos, destino) ${
              transferencia_banco || ""
            } ${transferencia_numero || ""}`.trim(),
          });
        }

        return cambio;
      });

      logger.info("Cambio de divisa creado y contabilizado", {
        id: exchange.id,
        numero_recibo: exchange.numero_recibo,
      });

      // Incluir datos del cliente en la respuesta (no se persiste en CambioDivisa)
      const exchangeResponse = {
        ...exchange,
        datos_cliente: datos_cliente_sanitized,
      };

      res.status(201).json({
        exchange: exchangeResponse,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear cambio de divisa", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuario_id: req.user?.id,
      });
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/* ========================= Listar (con fecha GYE) ========================= */

router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res
          .status(401)
          .json({ error: "Usuario no autenticado", success: false });
        return;
      }

      const whereClause: ExchangeWhereClause = {};
      if (req.query.point_id)
        whereClause.punto_atencion_id = String(req.query.point_id);

      const estadoParam = req.query.estado as EstadoTransaccion | undefined;
      if (
        estadoParam === EstadoTransaccion.PENDIENTE ||
        estadoParam === EstadoTransaccion.COMPLETADO
      ) {
        whereClause.estado = estadoParam;
      }

      if (req.user.rol === "OPERADOR") whereClause.usuario_id = req.user.id;

      const { date, from, to } = req.query as {
        date?: string;
        from?: string;
        to?: string;
      };
      let gte: Date, lt: Date;
      if (from || to) {
        const fromStr = (from || (to as string)) as string;
        const toStr = (to || (from as string)) as string;
        gte = gyeDayRangeUtcFromDateOnly(fromStr).gte;
        lt = gyeDayRangeUtcFromDateOnly(toStr).lt;
      } else if (date) {
        const dateStr = String(date);
        const r = gyeDayRangeUtcFromDateOnly(dateStr);
        gte = r.gte;
        lt = r.lt;
      } else {
        // Sin filtro de fecha para ADMIN/SUPER_USUARIO: últimos 30 días
        // Para OPERADOR: día actual
        if (req.user.rol === "ADMIN" || req.user.rol === "SUPER_USUARIO") {
          const now = new Date();
          gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás
          lt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Mañana
        } else {
          const dateStr = todayGyeDateOnly();
          const r = gyeDayRangeUtcFromDateOnly(dateStr);
          gte = r.gte;
          lt = r.lt;
        }
      }

      // Primero intentamos una consulta simple para diagnosticar el problema
      let exchanges;
      try {
        exchanges = await prisma.cambioDivisa.findMany({
          where: { ...whereClause, fecha: { gte, lt } },
          select: {
            id: true,
            fecha: true,
            tipo_operacion: true,
            estado: true,
            monto_origen: true,
            monto_destino: true,
            tasa_cambio_billetes: true,
            tasa_cambio_monedas: true,
            observacion: true,
            numero_recibo: true,
            numero_recibo_abono: true,
            numero_recibo_completar: true,
            cliente: true,
            divisas_entregadas_total: true,
            divisas_entregadas_billetes: true,
            divisas_entregadas_monedas: true,
            divisas_recibidas_total: true,
            divisas_recibidas_billetes: true,
            divisas_recibidas_monedas: true,
            saldo_pendiente: true,
            abono_inicial_monto: true,
            abono_inicial_fecha: true,
            fecha_completado: true,
            metodo_entrega: true,
            transferencia_banco: true,
            transferencia_numero: true,
            transferencia_imagen_url: true,
            usd_entregado_efectivo: true,
            usd_entregado_transfer: true,
            // usd_recibido_efectivo: true,
            // usd_recibido_transfer: true,
            // metodo_pago_origen: true,
            moneda_origen_id: true,
            moneda_destino_id: true,
            usuario_id: true,
            punto_atencion_id: true,
          },
          orderBy: { fecha: "desc" },
          take: req.user.rol === "ADMIN" || req.user.rol === "SUPER_USUARIO" ? 500 : 50,
        });

        // Si la consulta básica funciona, intentamos agregar las relaciones
        if (exchanges && exchanges.length >= 0) {
          exchanges = await prisma.cambioDivisa.findMany({
            where: { ...whereClause, fecha: { gte, lt } },
            select: {
              id: true,
              fecha: true,
              tipo_operacion: true,
              estado: true,
              monto_origen: true,
              monto_destino: true,
              tasa_cambio_billetes: true,
              tasa_cambio_monedas: true,
              observacion: true,
              numero_recibo: true,
              numero_recibo_abono: true,
              numero_recibo_completar: true,
              cliente: true,
              divisas_entregadas_total: true,
              divisas_entregadas_billetes: true,
              divisas_entregadas_monedas: true,
              divisas_recibidas_total: true,
              divisas_recibidas_billetes: true,
              divisas_recibidas_monedas: true,
              saldo_pendiente: true,
              abono_inicial_monto: true,
              abono_inicial_fecha: true,
              fecha_completado: true,
              metodo_entrega: true,
              transferencia_banco: true,
              transferencia_numero: true,
              transferencia_imagen_url: true,
              usd_entregado_efectivo: true,
              usd_entregado_transfer: true,
              // usd_recibido_efectivo: true,
              // usd_recibido_transfer: true,
              // metodo_pago_origen: true,
              monedaOrigen: {
                select: { id: true, nombre: true, codigo: true, simbolo: true },
              },
              monedaDestino: {
                select: { id: true, nombre: true, codigo: true, simbolo: true },
              },
              usuario: { select: { id: true, nombre: true, username: true } },
              puntoAtencion: { select: { id: true, nombre: true } },
            },
            orderBy: { fecha: "desc" },
            take: req.user.rol === "ADMIN" || req.user.rol === "SUPER_USUARIO" ? 500 : 50,
          });
        }
      } catch (relationError) {
        logger.warn("Error con relaciones, usando consulta básica", {
          error:
            relationError instanceof Error ? relationError.message : "Unknown",
        });

        // Fallback a consulta sin relaciones
        exchanges = await prisma.cambioDivisa.findMany({
          where: { ...whereClause, fecha: { gte, lt } },
          select: {
            id: true,
            fecha: true,
            tipo_operacion: true,
            estado: true,
            monto_origen: true,
            monto_destino: true,
            tasa_cambio_billetes: true,
            tasa_cambio_monedas: true,
            observacion: true,
            numero_recibo: true,
            cliente: true,
            divisas_entregadas_total: true,
            divisas_recibidas_total: true,
            metodo_entrega: true,
            moneda_origen_id: true,
            moneda_destino_id: true,
            usuario_id: true,
            punto_atencion_id: true,
          },
          orderBy: { fecha: "desc" },
          take: req.user.rol === "ADMIN" || req.user.rol === "SUPER_USUARIO" ? 500 : 50,
        });
      }

      // Enriquecer con datos_cliente desde Recibo.datos_operacion (para históricos)
      try {
        const refIds = (exchanges || []).map((e: any) => e.id);
        if (refIds.length > 0) {
          const recibos = await prisma.recibo.findMany({
            where: { referencia_id: { in: Array.from(new Set(refIds)) } },
            select: { referencia_id: true, datos_operacion: true },
          });
          const datosClienteMap = new Map<string, any>();
          for (const r of recibos) {
            const op = r.datos_operacion as any;
            const datos = op?.datos_cliente || op?.cliente || null;
            if (r.referencia_id && datos) {
              datosClienteMap.set(r.referencia_id, datos);
            }
          }
          exchanges = (exchanges || []).map((e: any) => ({
            ...e,
            datos_cliente: (datosClienteMap.get(e.id) as any) || undefined,
          }));
        }
      } catch (e) {
        logger.warn("No se pudo enriquecer exchanges con datos_cliente de recibos", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      res.status(200).json({
        exchanges,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener cambios de divisa", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ error: "Error al obtener cambios de divisa", success: false });
    }
  }
);

/* ========================= Cerrar cambio pendiente (COMPLETADO) ========================= */

router.patch(
  "/:id/cerrar",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    const { id } = req.params;
    try {
      if (!req.user?.id) {
        res
          .status(401)
          .json({ error: "Usuario no autenticado", success: false });
        return;
      }
      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({ error: "Cambio no encontrado", success: false });
        return;
      }
      if (cambio.estado === EstadoTransaccion.COMPLETADO) {
        res
          .status(400)
          .json({ error: "El cambio ya está completado", success: false });
        return;
      }

      // ✅ CRÍTICO: Si hubo abono inicial, actualizar el balance restante
      const huboAbonoInicial = num(cambio.abono_inicial_monto) > 0;

      if (huboAbonoInicial) {
        // Calcular el porcentaje restante que falta actualizar
        const montoTotal = num(cambio.monto_destino);
        const montoAbonado = num(cambio.abono_inicial_monto);
        const montoRestante = montoTotal - montoAbonado;
        const porcentajeRestante = montoRestante / montoTotal;

        // Obtener saldos actuales
        const saldoOrigen = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
        });

        const saldoDestino = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
        });

        if (!saldoOrigen || !saldoDestino) {
          res.status(400).json({
            error: "No se encontraron saldos para las monedas involucradas",
            success: false,
          });
          return;
        }

        // Calcular incrementos/decrementos restantes según método de pago
        const usdRecibidoEfectivo =
          cambio.metodo_pago_origen === TipoViaTransferencia.EFECTIVO
            ? num(cambio.divisas_entregadas_total)
            : 0;
        const usdRecibidoTransfer =
          cambio.metodo_pago_origen === TipoViaTransferencia.BANCO
            ? num(cambio.divisas_entregadas_total)
            : 0;

        const ingresoEfRestante = round2(
          usdRecibidoEfectivo * porcentajeRestante
        );
        const ingresoBkRestante = round2(
          usdRecibidoTransfer * porcentajeRestante
        );

        // Calcular billetes y monedas de ingreso manteniendo proporción
        let ingresoBilRestante = 0;
        let ingresoMonRestante = 0;

        if (ingresoEfRestante > 0) {
          const totalEntregado =
            num(cambio.divisas_entregadas_billetes) +
            num(cambio.divisas_entregadas_monedas);

          if (totalEntregado > 0) {
            const proporcionBilletes =
              num(cambio.divisas_entregadas_billetes) / totalEntregado;
            const proporcionMonedas =
              num(cambio.divisas_entregadas_monedas) / totalEntregado;

            ingresoBilRestante = round2(ingresoEfRestante * proporcionBilletes);
            ingresoMonRestante = round2(ingresoEfRestante * proporcionMonedas);

            // Ajustar por diferencias de redondeo
            const diferencia =
              ingresoEfRestante - (ingresoBilRestante + ingresoMonRestante);
            if (Math.abs(diferencia) > 0.01) {
              if (ingresoBilRestante >= ingresoMonRestante) {
                ingresoBilRestante = round2(ingresoBilRestante + diferencia);
              } else {
                ingresoMonRestante = round2(ingresoMonRestante + diferencia);
              }
            }
          } else {
            ingresoBilRestante = ingresoEfRestante;
            ingresoMonRestante = 0;
          }
        }

        // Egreso en moneda destino
        const egresoEfRestante =
          cambio.metodo_entrega === "efectivo"
            ? round2(num(cambio.divisas_recibidas_total) * porcentajeRestante)
            : 0;
        const egresoBkRestante =
          cambio.metodo_entrega === "transferencia"
            ? round2(num(cambio.divisas_recibidas_total) * porcentajeRestante)
            : 0;

        // Calcular billetes y monedas de egreso manteniendo proporción
        let billetesEgresoRestante = 0;
        let monedasEgresoRestante = 0;

        if (egresoEfRestante > 0) {
          const totalRecibido =
            num(cambio.divisas_recibidas_billetes) +
            num(cambio.divisas_recibidas_monedas);

          if (totalRecibido > 0) {
            const proporcionBilletes =
              num(cambio.divisas_recibidas_billetes) / totalRecibido;
            const proporcionMonedas =
              num(cambio.divisas_recibidas_monedas) / totalRecibido;

            billetesEgresoRestante = round2(
              egresoEfRestante * proporcionBilletes
            );
            monedasEgresoRestante = round2(
              egresoEfRestante * proporcionMonedas
            );

            // Ajustar por diferencias de redondeo
            const diferencia =
              egresoEfRestante -
              (billetesEgresoRestante + monedasEgresoRestante);
            if (Math.abs(diferencia) > 0.01) {
              if (billetesEgresoRestante >= monedasEgresoRestante) {
                billetesEgresoRestante = round2(
                  billetesEgresoRestante + diferencia
                );
              } else {
                monedasEgresoRestante = round2(
                  monedasEgresoRestante + diferencia
                );
              }
            }
          } else {
            billetesEgresoRestante = egresoEfRestante;
            monedasEgresoRestante = 0;
          }
        }

        // Actualizar saldos en transacción
        await prisma.$transaction(async (tx) => {
          // Actualizar saldo origen (ingreso)
          await tx.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_origen_id,
              },
            },
            data: {
              cantidad: { increment: ingresoEfRestante },
              bancos: { increment: ingresoBkRestante },
              billetes: { increment: ingresoBilRestante },
              monedas_fisicas: { increment: ingresoMonRestante },
            },
          });

          // Actualizar saldo destino (egreso)
          await tx.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_destino_id,
              },
            },
            data: {
              cantidad: { decrement: egresoEfRestante },
              bancos: { decrement: egresoBkRestante },
              billetes: { decrement: billetesEgresoRestante },
              monedas_fisicas: { decrement: monedasEgresoRestante },
            },
          });

          // Registrar movimiento de saldo
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: cambio.punto_atencion_id,
              monedaId: cambio.moneda_origen_id,
              tipoMovimiento: TipoMovimiento.INGRESO,
              monto: round2(ingresoEfRestante + ingresoBkRestante),
              saldoAnterior: round2(num(saldoOrigen.cantidad) + num(saldoOrigen.bancos)),
              saldoNuevo: round2(
                num(saldoOrigen.cantidad) +
                  num(saldoOrigen.bancos) +
                  ingresoEfRestante +
                  ingresoBkRestante
              ),
              tipoReferencia: TipoReferencia.EXCHANGE,
              referenciaId: cambio.id,
              descripcion: `Cierre de cambio pendiente (ingreso restante) - Recibo: ${cambio.numero_recibo}`,
              usuarioId: req.user!.id,
            },
            tx
          );
        });
      }

      const numeroReciboCierre = `CIERRE-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const updated = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          estado: EstadoTransaccion.COMPLETADO,
          numero_recibo_completar: numeroReciboCierre,
          fecha_completado: new Date(),
          saldo_pendiente: 0,
        },
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_recibidas_total: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      await prisma.recibo.create({
        data: {
          numero_recibo: numeroReciboCierre,
          tipo_operacion: "CAMBIO_DIVISA",
          referencia_id: updated.id,
          usuario_id: req.user.id,
          punto_atencion_id: cambio.punto_atencion_id,
          datos_operacion: updated,
        },
      });

      res.status(200).json({
        exchange: updated,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cerrar cambio de divisa", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ error: "Error interno al cerrar cambio", success: false });
    }
  }
);

/* ========================= Completar: setear entrega + COMPLETADO ========================= */

router.patch(
  "/:id/completar",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    const { id } = req.params;
    const {
      metodo_entrega,
      transferencia_numero,
      transferencia_banco,
      transferencia_imagen_url,
      divisas_recibidas_billetes,
      divisas_recibidas_monedas,
      divisas_recibidas_total,
    } = req.body || {};
    try {
      if (!req.user?.id) {
        res
          .status(401)
          .json({ error: "Usuario no autenticado", success: false });
        return;
      }

      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({ error: "Cambio no encontrado", success: false });
        return;
      }
      if (cambio.estado === EstadoTransaccion.COMPLETADO) {
        res
          .status(400)
          .json({ error: "El cambio ya está completado", success: false });
        return;
      }

      if (metodo_entrega === "transferencia") {
        if (!transferencia_banco || !String(transferencia_banco).trim()) {
          res.status(400).json({
            success: false,
            error: "Banco requerido para transferencia",
          });
          return;
        }
        if (!transferencia_numero || !String(transferencia_numero).trim()) {
          res.status(400).json({
            success: false,
            error: "Número de referencia requerido para transferencia",
          });
          return;
        }
      }

      // ✅ CRÍTICO: Si hubo abono inicial, actualizar el balance restante
      const huboAbonoInicial = num(cambio.abono_inicial_monto) > 0;

      if (huboAbonoInicial) {
        // Calcular el porcentaje restante que falta actualizar
        const montoTotal = num(cambio.monto_destino);
        const montoAbonado = num(cambio.abono_inicial_monto);
        const montoRestante = montoTotal - montoAbonado;
        const porcentajeRestante = montoRestante / montoTotal;

        // Obtener saldos actuales
        const saldoOrigen = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
        });

        const saldoDestino = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
        });

        if (!saldoOrigen || !saldoDestino) {
          res.status(400).json({
            error: "No se encontraron saldos para las monedas involucradas",
            success: false,
          });
          return;
        }

        // Calcular incrementos/decrementos restantes según método de pago
        const usdRecibidoEfectivo =
          cambio.metodo_pago_origen === TipoViaTransferencia.EFECTIVO
            ? num(cambio.divisas_entregadas_total)
            : 0;
        const usdRecibidoTransfer =
          cambio.metodo_pago_origen === TipoViaTransferencia.BANCO
            ? num(cambio.divisas_entregadas_total)
            : 0;

        const ingresoEfRestante = round2(
          usdRecibidoEfectivo * porcentajeRestante
        );
        const ingresoBkRestante = round2(
          usdRecibidoTransfer * porcentajeRestante
        );

        // Calcular billetes y monedas de ingreso manteniendo proporción
        let ingresoBilRestante = 0;
        let ingresoMonRestante = 0;

        if (ingresoEfRestante > 0) {
          const totalEntregado =
            num(cambio.divisas_entregadas_billetes) +
            num(cambio.divisas_entregadas_monedas);

          if (totalEntregado > 0) {
            const proporcionBilletes =
              num(cambio.divisas_entregadas_billetes) / totalEntregado;
            const proporcionMonedas =
              num(cambio.divisas_entregadas_monedas) / totalEntregado;

            ingresoBilRestante = round2(ingresoEfRestante * proporcionBilletes);
            ingresoMonRestante = round2(ingresoEfRestante * proporcionMonedas);

            // Ajustar por diferencias de redondeo
            const diferencia =
              ingresoEfRestante - (ingresoBilRestante + ingresoMonRestante);
            if (Math.abs(diferencia) > 0.01) {
              if (ingresoBilRestante >= ingresoMonRestante) {
                ingresoBilRestante = round2(ingresoBilRestante + diferencia);
              } else {
                ingresoMonRestante = round2(ingresoMonRestante + diferencia);
              }
            }
          } else {
            ingresoBilRestante = ingresoEfRestante;
            ingresoMonRestante = 0;
          }
        }

        // Egreso en moneda destino
        const egresoEfRestante =
          cambio.metodo_entrega === "efectivo"
            ? round2(num(cambio.divisas_recibidas_total) * porcentajeRestante)
            : 0;
        const egresoBkRestante =
          cambio.metodo_entrega === "transferencia"
            ? round2(num(cambio.divisas_recibidas_total) * porcentajeRestante)
            : 0;

        // Calcular billetes y monedas de egreso manteniendo proporción
        let billetesEgresoRestante = 0;
        let monedasEgresoRestante = 0;

        if (egresoEfRestante > 0) {
          const totalRecibido =
            num(cambio.divisas_recibidas_billetes) +
            num(cambio.divisas_recibidas_monedas);

          if (totalRecibido > 0) {
            const proporcionBilletes =
              num(cambio.divisas_recibidas_billetes) / totalRecibido;
            const proporcionMonedas =
              num(cambio.divisas_recibidas_monedas) / totalRecibido;

            billetesEgresoRestante = round2(
              egresoEfRestante * proporcionBilletes
            );
            monedasEgresoRestante = round2(
              egresoEfRestante * proporcionMonedas
            );

            // Ajustar por diferencias de redondeo
            const diferencia =
              egresoEfRestante -
              (billetesEgresoRestante + monedasEgresoRestante);
            if (Math.abs(diferencia) > 0.01) {
              if (billetesEgresoRestante >= monedasEgresoRestante) {
                billetesEgresoRestante = round2(
                  billetesEgresoRestante + diferencia
                );
              } else {
                monedasEgresoRestante = round2(
                  monedasEgresoRestante + diferencia
                );
              }
            }
          } else {
            billetesEgresoRestante = egresoEfRestante;
            monedasEgresoRestante = 0;
          }
        }

        // Actualizar saldos en transacción
        await prisma.$transaction(async (tx) => {
          // 1) Actualizar saldo origen (ingreso del monto restante)
          const existingSaldoOrigen = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_origen_id,
              },
            },
          });

          const origenAnteriorEf = num(existingSaldoOrigen?.cantidad);
          const origenAnteriorBk = num(existingSaldoOrigen?.bancos);
          const origenNuevoEf = round2(origenAnteriorEf + ingresoEfRestante);
          const origenNuevoBk = round2(origenAnteriorBk + ingresoBkRestante);
          const origenNuevoBil = round2(num(existingSaldoOrigen?.billetes) + ingresoBilRestante);
          const origenNuevoMon = round2(num(existingSaldoOrigen?.monedas_fisicas) + ingresoMonRestante);

          await tx.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_origen_id,
              },
            },
            data: {
              cantidad: origenNuevoEf,
              bancos: origenNuevoBk,
              billetes: origenNuevoBil,
              monedas_fisicas: origenNuevoMon,
            },
          });

          // Registrar movimiento origen
          if (ingresoEfRestante > 0 || ingresoBkRestante > 0) {
            await registrarMovimientoSaldo(
              {
                puntoAtencionId: cambio.punto_atencion_id,
                monedaId: cambio.moneda_origen_id,
                tipoMovimiento: TipoMovimiento.INGRESO,
                monto: round2(ingresoEfRestante + ingresoBkRestante),
                saldoAnterior: round2(origenAnteriorEf + origenAnteriorBk),
                saldoNuevo: round2(origenNuevoEf + origenNuevoBk),
                tipoReferencia: TipoReferencia.EXCHANGE,
                referenciaId: cambio.id,
                descripcion: `Completar cambio pendiente (ingreso restante) - Recibo: ${cambio.numero_recibo}`,
                usuarioId: req.user!.id,
              },
              tx
            );
          }

          // 2) Actualizar saldo destino (egreso del monto restante)
          const existingSaldoDestino = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_destino_id,
              },
            },
          });

          const destinoAnteriorEf = num(existingSaldoDestino?.cantidad);
          const destinoAnteriorBk = num(existingSaldoDestino?.bancos);
          const destinoNuevoEf = round2(destinoAnteriorEf - egresoEfRestante);
          const destinoNuevoBk = round2(destinoAnteriorBk - egresoBkRestante);
          const destinoNuevoBil = round2(num(existingSaldoDestino?.billetes) - billetesEgresoRestante);
          const destinoNuevoMon = round2(num(existingSaldoDestino?.monedas_fisicas) - monedasEgresoRestante);

          await tx.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_destino_id,
              },
            },
            data: {
              cantidad: destinoNuevoEf,
              bancos: destinoNuevoBk,
              billetes: destinoNuevoBil,
              monedas_fisicas: destinoNuevoMon,
            },
          });

          // Registrar movimiento destino
          if (egresoEfRestante > 0 || egresoBkRestante > 0) {
            await registrarMovimientoSaldo(
              {
                puntoAtencionId: cambio.punto_atencion_id,
                monedaId: cambio.moneda_destino_id,
                tipoMovimiento: TipoMovimiento.EGRESO,
                monto: round2(egresoEfRestante + egresoBkRestante),
                saldoAnterior: round2(destinoAnteriorEf + destinoAnteriorBk),
                saldoNuevo: round2(destinoNuevoEf + destinoNuevoBk),
                tipoReferencia: TipoReferencia.EXCHANGE,
                referenciaId: cambio.id,
                descripcion: `Completar cambio pendiente (egreso restante) - Recibo: ${cambio.numero_recibo}`,
                usuarioId: req.user!.id,
              },
              tx
            );
          }
        });
      }

      const numeroReciboCompletar = `COMP-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const updated = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          estado: EstadoTransaccion.COMPLETADO,
          metodo_entrega: metodo_entrega || cambio.metodo_entrega,
          transferencia_numero:
            (metodo_entrega || cambio.metodo_entrega) === "transferencia"
              ? transferencia_numero || cambio.transferencia_numero
              : null,
          transferencia_banco:
            (metodo_entrega || cambio.metodo_entrega) === "transferencia"
              ? transferencia_banco || cambio.transferencia_banco
              : null,
          transferencia_imagen_url:
            (metodo_entrega || cambio.metodo_entrega) === "transferencia"
              ? transferencia_imagen_url || cambio.transferencia_imagen_url
              : null,
          divisas_recibidas_billetes:
            typeof divisas_recibidas_billetes === "number"
              ? round2(divisas_recibidas_billetes)
              : cambio.divisas_recibidas_billetes,
          divisas_recibidas_monedas:
            typeof divisas_recibidas_monedas === "number"
              ? round2(divisas_recibidas_monedas)
              : cambio.divisas_recibidas_monedas,
          divisas_recibidas_total:
            typeof divisas_recibidas_total === "number"
              ? round2(divisas_recibidas_total)
              : cambio.divisas_recibidas_total,
          numero_recibo_completar: numeroReciboCompletar,
          fecha_completado: new Date(),
          saldo_pendiente: 0,
        },
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_recibidas_total: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      await prisma.recibo.create({
        data: {
          numero_recibo: numeroReciboCompletar,
          tipo_operacion: "CAMBIO_DIVISA",
          referencia_id: updated.id,
          usuario_id: req.user.id,
          punto_atencion_id: cambio.punto_atencion_id,
          datos_operacion: updated,
        },
      });

      res.status(200).json({
        exchange: updated,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al completar cambio de divisa", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ error: "Error interno al completar cambio", success: false });
    }
  }
);

/* ========================= Pendientes / Parciales / Abonos ========================= */

router.get(
  "/pending",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { pointId } = req.query;
      if (!pointId) {
        res.status(400).json({ success: false, error: "Se requiere pointId" });
        return;
      }

      let exchanges = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: String(pointId),
          estado: EstadoTransaccion.PENDIENTE,
          saldo_pendiente: { gt: 0 },
        },
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_entregadas_billetes: true,
          divisas_entregadas_monedas: true,
          divisas_recibidas_total: true,
          divisas_recibidas_billetes: true,
          divisas_recibidas_monedas: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: "desc" },
      });

      // Enriquecer con datos_cliente desde Recibo.datos_operacion (para históricos)
      try {
        const refIds = (exchanges || []).map((e: any) => e.id);
        if (refIds.length > 0) {
          const recibos = await prisma.recibo.findMany({
            where: { referencia_id: { in: Array.from(new Set(refIds)) } },
            select: { referencia_id: true, datos_operacion: true },
          });
          const datosClienteMap = new Map<string, any>();
          for (const r of recibos) {
            const op = r.datos_operacion as any;
            const datos = op?.datos_cliente || op?.cliente || null;
            if (r.referencia_id && datos) {
              datosClienteMap.set(r.referencia_id, datos);
            }
          }
          exchanges = (exchanges || []).map((e: any) => ({
            ...e,
            datos_cliente: (datosClienteMap.get(e.id) as any) || undefined,
          }));
        }
      } catch (e) {
        logger.warn("No se pudo enriquecer exchanges (pending) con datos_cliente de recibos", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      res.json({ success: true, exchanges });
    } catch (error) {
      logger.error("Error fetching pending exchanges", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ success: false, error: "Error interno del servidor" });
    }
  }
);

router.get(
  "/partial",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { pointId } = req.query;
      const isAdmin =
        req.user?.rol === "ADMIN" || req.user?.rol === "SUPER_USUARIO";

      const where: any = {
        saldo_pendiente: { gt: 0 },
        estado: EstadoTransaccion.PENDIENTE,
      };
      if (!isAdmin && pointId) where.punto_atencion_id = String(pointId);
      else if (isAdmin && pointId && pointId !== "ALL")
        where.punto_atencion_id = String(pointId);

      let exchanges = await prisma.cambioDivisa.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_entregadas_billetes: true,
          divisas_entregadas_monedas: true,
          divisas_recibidas_total: true,
          divisas_recibidas_billetes: true,
          divisas_recibidas_monedas: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          observacion_parcial: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
          abonoInicialRecibidoPorUsuario: {
            select: { id: true, nombre: true, username: true },
          },
        },
        orderBy: { fecha: "desc" },
      });

      // Enriquecer con datos_cliente desde Recibo.datos_operacion (para históricos)
      try {
        const recibos = await prisma.recibo.findMany({
          where: {
            referencia_id: { in: (exchanges || []).map((e: any) => e.id) },
            tipo_operacion: "CAMBIO_DIVISA",
          },
          select: {
            referencia_id: true,
            datos_operacion: true,
          },
        });
        if (recibos?.length) {
          const datosClienteMap = new Map<string, any>();
          for (const r of recibos) {
            if (r.datos_operacion && typeof r.datos_operacion === "object") {
              const datos = (r.datos_operacion as any).datos_cliente;
              if (datos) datosClienteMap.set(r.referencia_id!, datos);
            } else if (r.datos_operacion && typeof r.datos_operacion === "string") {
              try {
                const parsed = JSON.parse(r.datos_operacion as any);
                const datos = parsed?.datos_cliente;
                if (datos) datosClienteMap.set(r.referencia_id!, datos);
              } catch {
                // ignore JSON parse errors
              }
            }
          }
          exchanges = (exchanges || []).map((e: any) => ({
            ...e,
            datos_cliente: (datosClienteMap.get(e.id) as any) || undefined,
          }));
        }
      } catch (e) {
        logger.warn(
          "No se pudo enriquecer exchanges (partial) con datos_cliente de recibos",
          { error: e instanceof Error ? e.message : String(e) }
        );
      }

      res.json({ success: true, exchanges });
    } catch (error) {
      logger.error("Error fetching partial exchanges", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
  }
);

router.patch(
  "/:id/complete-partial",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const isAdmin =
        req.user?.rol === "ADMIN" || req.user?.rol === "SUPER_USUARIO";
      if (!isAdmin) {
        res.status(403).json({ success: false, error: "Solo administradores" });
        return;
      }

      const exchange = await prisma.cambioDivisa.findUnique({
        where: { id },
        select: {
          id: true,
          estado: true,
          monto_destino: true,
          saldo_pendiente: true,
          monedaDestino: { select: { codigo: true, simbolo: true } },
        },
      });
      if (!exchange) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }
      const sp = Number(exchange.saldo_pendiente || 0);
      if (!(sp > 0)) {
        res.status(400).json({
          success: false,
          error: "Este cambio no tiene saldo pendiente",
        });
        return;
      }

      const updated = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          saldo_pendiente: 0,
          fecha_completado: new Date(),
          estado: EstadoTransaccion.COMPLETADO,
        },
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_entregadas_billetes: true,
          divisas_entregadas_monedas: true,
          divisas_recibidas_total: true,
          divisas_recibidas_billetes: true,
          divisas_recibidas_monedas: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      res.json({
        success: true,
        exchange: updated,
        message: `Cambio parcial completado.`,
      });
    } catch (error) {
      logger.error("Error completing partial exchange", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ success: false, error: "Error interno del servidor" });
    }
  }
);

router.patch(
  "/:id/register-partial-payment",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { abono_inicial_monto, abono_inicial_fecha, observacion_parcial } =
        req.body;

      const exchange = await prisma.cambioDivisa.findUnique({
        where: { id },
        select: {
          id: true,
          estado: true,
          monto_destino: true,
          monedaDestino: { select: { codigo: true, simbolo: true } },
        },
      });
      if (!exchange) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }
      if (exchange.estado === EstadoTransaccion.COMPLETADO) {
        res
          .status(400)
          .json({ success: false, error: "Este cambio ya está completado" });
        return;
      }

      const abonoMonto = num(abono_inicial_monto);
      const montoDestino = num(exchange.monto_destino);
      if (!(abonoMonto > 0 && abonoMonto < montoDestino)) {
        res.status(400).json({
          success: false,
          error: "El abono debe ser > 0 y < monto total",
        });
        return;
      }
      const saldoPendiente = round2(montoDestino - abonoMonto);

      const updated = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          abono_inicial_monto: round2(abonoMonto),
          abono_inicial_fecha: abono_inicial_fecha
            ? new Date(abono_inicial_fecha)
            : new Date(),
          abono_inicial_recibido_por: req.user?.id || null,
          saldo_pendiente: saldoPendiente,
          observacion_parcial: observacion_parcial || null,
          estado: EstadoTransaccion.PENDIENTE,
        },
        select: {
          id: true,
          fecha: true,
          tipo_operacion: true,
          estado: true,
          monto_origen: true,
          monto_destino: true,
          tasa_cambio_billetes: true,
          tasa_cambio_monedas: true,
          observacion: true,
          numero_recibo: true,
          numero_recibo_abono: true,
          numero_recibo_completar: true,
          cliente: true,
          divisas_entregadas_total: true,
          divisas_entregadas_billetes: true,
          divisas_entregadas_monedas: true,
          divisas_recibidas_total: true,
          divisas_recibidas_billetes: true,
          divisas_recibidas_monedas: true,
          saldo_pendiente: true,
          abono_inicial_monto: true,
          abono_inicial_fecha: true,
          fecha_completado: true,
          observacion_parcial: true,
          monedaOrigen: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          monedaDestino: {
            select: { id: true, nombre: true, codigo: true, simbolo: true },
          },
          usuario: { select: { id: true, nombre: true, username: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
          abonoInicialRecibidoPorUsuario: {
            select: { id: true, nombre: true, username: true },
          },
        },
      });

      res.json({
        success: true,
        exchange: updated,
        message: `Abono registrado. Saldo pendiente: ${saldoPendiente.toFixed(
          2
        )}`,
      });
    } catch (error) {
      logger.error("Error registering partial payment", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res
        .status(500)
        .json({ success: false, error: "Error interno del servidor" });
    }
  }
);

/* ========================= Búsqueda de clientes ========================= */

router.get(
  "/search-customers",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res
          .status(401)
          .json({ error: "Usuario no autenticado", success: false });
        return;
      }
      const { query } = req.query;
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        res
          .status(400)
          .json({ error: "Proporcione al menos 2 caracteres", success: false });
        return;
      }
      const searchTerm = query.trim().toLowerCase();

      const exchanges = await prisma.cambioDivisa.findMany({
        where: { cliente: { contains: searchTerm, mode: "insensitive" } },
        select: { id: true, cliente: true, fecha: true, numero_recibo: true },
        orderBy: { fecha: "desc" },
        take: 20,
      });
      const recibos = await prisma.recibo.findMany({
        where: {
          tipo_operacion: "CAMBIO_DIVISA",
          OR: [
            {
              datos_operacion: {
                path: ["datos_cliente", "nombre"],
                string_contains: searchTerm,
              },
            },
            {
              datos_operacion: {
                path: ["datos_cliente", "apellido"],
                string_contains: searchTerm,
              },
            },
            {
              datos_operacion: {
                path: ["datos_cliente", "cedula"],
                string_contains: searchTerm,
              },
            },
          ],
        },
        select: {
          id: true,
          datos_operacion: true,
          fecha: true,
          numero_recibo: true,
        },
        orderBy: { fecha: "desc" },
        take: 20,
      });

      const clientesFromExchanges = exchanges.map((e) => ({
        id: e.id,
        nombre: e.cliente?.split(" ")[0] || "",
        apellido: e.cliente?.split(" ").slice(1).join(" ") || "",
        cedula: "",
        telefono: "",
        fuente: "exchange",
        fecha_ultima_operacion: e.fecha,
        numero_recibo: e.numero_recibo,
      }));
      const clientesFromRecibos = recibos.map((r) => {
        const dc: any = (r.datos_operacion as any)?.datos_cliente || {};
        return {
          id: r.id,
          nombre: dc.nombre || "",
          apellido: dc.apellido || "",
          cedula: dc.cedula || "",
          telefono: dc.telefono || "",
          fuente: "recibo",
          fecha_ultima_operacion: r.fecha,
          numero_recibo: r.numero_recibo,
        };
      });

      const all = [...clientesFromExchanges, ...clientesFromRecibos];
      const map = new Map<string, any>();
      for (const c of all) {
        const key = c.cedula || `${c.nombre}_${c.apellido}`;
        if (
          !map.has(key) ||
          new Date(c.fecha_ultima_operacion) >
            new Date(map.get(key).fecha_ultima_operacion)
        ) {
          map.set(key, c);
        }
      }
      const resultados = Array.from(map.values())
        .filter((c: any) => {
          const full = `${c.nombre} ${c.apellido}`.toLowerCase();
          const cedula = (c.cedula || "").toLowerCase();
          return full.includes(searchTerm) || cedula.includes(searchTerm);
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.fecha_ultima_operacion).getTime() -
            new Date(a.fecha_ultima_operacion).getTime()
        )
        .slice(0, 10);

      res.status(200).json({
        clientes: resultados,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al buscar clientes", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      res.status(500).json({
        error: "Error interno del servidor al buscar clientes",
        success: false,
      });
    }
  }
);

/* ========================= Recontabilizar (idempotente por referencia) ========================= */

router.post(
  "/:id/recontabilizar",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.user?.id) {
        res
          .status(401)
          .json({ success: false, error: "Usuario no autenticado" });
        return;
      }

      const cambio = await prisma.cambioDivisa.findUnique({
        where: { id },
        include: {
          monedaOrigen: true,
          monedaDestino: true,
        },
      });
      if (!cambio) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }

      const existentes = await prisma.movimientoSaldo.findMany({
        where: { referencia_id: cambio.id, tipo_referencia: "CAMBIO_DIVISA" },
        select: { id: true },
      });
      if (existentes.length > 0) {
        res.status(200).json({
          success: true,
          message: "Movimientos ya existen para este cambio. No se duplicó.",
        });
        return;
      }

      // Reconstruir egresos/ingresos coherentes con métodos
      const isDestinoUSD = isUSDByCode(cambio.monedaDestino?.codigo);
      const totDestino = num(
        cambio.divisas_recibidas_total || cambio.monto_destino
      );
      const egresoEf = isDestinoUSD
        ? num(cambio.usd_entregado_efectivo)
        : cambio.metodo_entrega === "efectivo"
        ? totDestino
        : 0;
      const egresoBk = isDestinoUSD
        ? num(cambio.usd_entregado_transfer)
        : cambio.metodo_entrega === "transferencia"
        ? totDestino
        : 0;

      const totOrigen = num(
        cambio.divisas_entregadas_total || cambio.monto_origen
      );
      const ingresoEf =
        cambio.metodo_pago_origen === "EFECTIVO"
          ? totOrigen
          : cambio.metodo_pago_origen === "MIXTO"
          ? num(cambio.usd_recibido_efectivo)
          : 0;
      const ingresoBk =
        cambio.metodo_pago_origen === "BANCO"
          ? totOrigen
          : cambio.metodo_pago_origen === "MIXTO"
          ? num(cambio.usd_recibido_transfer)
          : 0;

      const movimientos = [
        ...(egresoEf > 0
          ? [
              {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_destino_id,
                tipo_movimiento: "EGRESO",
                monto: egresoEf,
                usuario_id: req.user.id,
                referencia_id: cambio.id,
                tipo_referencia: "CAMBIO_DIVISA",
                descripcion: `Egreso efectivo (recontabilizar)`,
              },
            ]
          : []),
        ...(egresoBk > 0
          ? [
              {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_destino_id,
                tipo_movimiento: "EGRESO",
                monto: egresoBk,
                usuario_id: req.user.id,
                referencia_id: cambio.id,
                tipo_referencia: "CAMBIO_DIVISA",
                descripcion: `Egreso bancos (recontabilizar)`,
              },
            ]
          : []),
        ...(ingresoEf > 0
          ? [
              {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_origen_id,
                tipo_movimiento: "INGRESO",
                monto: ingresoEf,
                usuario_id: req.user.id,
                referencia_id: cambio.id,
                tipo_referencia: "CAMBIO_DIVISA",
                descripcion: `Ingreso efectivo (recontabilizar)`,
              },
            ]
          : []),
        ...(ingresoBk > 0
          ? [
              {
                punto_atencion_id: cambio.punto_atencion_id,
                moneda_id: cambio.moneda_origen_id,
                tipo_movimiento: "INGRESO",
                monto: ingresoBk,
                usuario_id: req.user.id,
                referencia_id: cambio.id,
                tipo_referencia: "CAMBIO_DIVISA",
                descripcion: `Ingreso bancos (recontabilizar)`,
              },
            ]
          : []),
      ];

      const baseUrl =
        process.env.INTERNAL_API_BASE_URL || "http://localhost:3001/api";
      const url = `${baseUrl}/movimientos-contables/procesar-cambio`;
      const response = await axios.post(
        url,
        { cambio_id: cambio.id, movimientos },
        {
          headers: { Authorization: req.headers.authorization || "" },
          timeout: 15000,
        }
      );

      res.status(200).json({ success: true, result: response.data });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { error: error.message };
        logger.error("Error al recontabilizar cambio (axios)", {
          status,
          data,
        });
        res.status(status).json({
          success: false,
          ...(typeof data === "object" ? data : { error: String(data) }),
        });
        return;
      }
      logger.error("Error al recontabilizar cambio", {
        error: error instanceof Error ? error.message : String(error),
      });
      res
        .status(500)
        .json({ success: false, error: "No se pudo recontabilizar" });
    }
  }
);

/* ========================= Eliminar (reversa exacta + limpiar recibos) ========================= */

router.delete(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      const cambio = await prisma.cambioDivisa.findUnique({
        where: { id },
        include: { monedaOrigen: true, monedaDestino: true },
      });
      if (!cambio) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }

      // Restringir al día actual GYE
      try {
        const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
        const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
        const fecha = new Date(cambio.fecha);
        if (!(fecha >= gte && fecha < lt)) {
          res.status(400).json({
            success: false,
            error: "Solo se pueden eliminar cambios del día actual",
          });
          return;
        }
      } catch {
        res
          .status(400)
          .json({ success: false, error: "Restricción de día no disponible" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        // Revertir ORIGEN (había INGRESO efectivo y/o bancos según metodo_pago_origen)
        const saldoOrigen = await getSaldo(
          tx,
          cambio.punto_atencion_id,
          cambio.moneda_origen_id
        );
        const anteriorEf = num(saldoOrigen?.cantidad);
        const anteriorBk =
          typeof saldoOrigen?.bancos !== "undefined"
            ? num(saldoOrigen?.bancos)
            : 0;

        const ingresoEf = num(cambio.usd_recibido_efectivo, 0);
        const ingresoBk = num(cambio.usd_recibido_transfer, 0);

        const nuevoEf = Math.max(0, round2(anteriorEf - ingresoEf));
        const nuevoBk = Math.max(0, round2(anteriorBk - ingresoBk));

        // Billetes/monedas físicos solo si hubo ingresoEf
        const nuevoBil = Math.max(
          0,
          round2(
            num(saldoOrigen?.billetes) -
              (ingresoEf > 0 ? num(cambio.divisas_entregadas_billetes) : 0)
          )
        );
        const nuevoMon = Math.max(
          0,
          round2(
            num(saldoOrigen?.monedas_fisicas) -
              (ingresoEf > 0 ? num(cambio.divisas_entregadas_monedas) : 0)
          )
        );

        await upsertSaldoEfectivoYBancos(
          tx,
          cambio.punto_atencion_id,
          cambio.moneda_origen_id,
          {
            cantidad: nuevoEf,
            billetes: nuevoBil,
            monedas_fisicas: nuevoMon,
            ...(typeof saldoOrigen?.bancos !== "undefined"
              ? { bancos: nuevoBk }
              : {}),
          }
        );
        if (ingresoEf > 0) {
          await logMovimientoSaldo(tx, {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            tipo_movimiento: "AJUSTE",
            monto: -ingresoEf,
            saldo_anterior: anteriorEf,
            saldo_nuevo: nuevoEf,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Reverso eliminación cambio (origen efectivo) #${
              cambio.numero_recibo || ""
            }`,
          });
        }
        if (ingresoBk > 0 && typeof saldoOrigen?.bancos !== "undefined") {
          await logMovimientoSaldo(tx, {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            tipo_movimiento: "AJUSTE",
            monto: -ingresoBk,
            saldo_anterior: anteriorBk,
            saldo_nuevo: nuevoBk,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Reverso eliminación cambio (origen bancos) #${
              cambio.numero_recibo || ""
            }`,
          });
        }

        // Revertir DESTINO (había EGRESO ef + bancos)
        const saldoDestino = await getSaldo(
          tx,
          cambio.punto_atencion_id,
          cambio.moneda_destino_id
        );
        const antEf = num(saldoDestino?.cantidad);
        const antBk =
          typeof saldoDestino?.bancos !== "undefined"
            ? num(saldoDestino?.bancos)
            : 0;

        const egEf = num(cambio.usd_entregado_efectivo, 0);
        const egBk = num(cambio.usd_entregado_transfer, 0);
        const sumDestTotal = num(
          cambio.divisas_recibidas_total || cambio.monto_destino
        );

        // Si hubo egreso en efectivo, regresamos efectivo físico y su breakdown
        const devolverEf = egEf > 0 ? egEf : sumDestTotal;
        const nuevoEfDest = round2(antEf + devolverEf);
        const nuevoBkDest = round2(antBk + egBk);

        // ⚠️ Solo recuperar billetes/monedas si originalmente hubo efectivo
        const sumarBilletes =
          egEf > 0 ? round2(num(cambio.divisas_recibidas_billetes)) : 0;
        const sumarMonedas =
          egEf > 0 ? round2(num(cambio.divisas_recibidas_monedas)) : 0;

        const nuevoBilDest = round2(
          num(saldoDestino?.billetes) + sumarBilletes
        );
        const nuevoMonDest = round2(
          num(saldoDestino?.monedas_fisicas) + sumarMonedas
        );

        await upsertSaldoEfectivoYBancos(
          tx,
          cambio.punto_atencion_id,
          cambio.moneda_destino_id,
          {
            cantidad: nuevoEfDest,
            billetes: nuevoBilDest,
            monedas_fisicas: nuevoMonDest,
            ...(typeof saldoDestino?.bancos !== "undefined"
              ? { bancos: nuevoBkDest }
              : {}),
          }
        );

        // Ajuste por EFECTIVO (si hubo egreso en efectivo originalmente)
        await logMovimientoSaldo(tx, {
          punto_atencion_id: cambio.punto_atencion_id,
          moneda_id: cambio.moneda_destino_id,
          tipo_movimiento: "AJUSTE",
          monto: devolverEf,
          saldo_anterior: antEf,
          saldo_nuevo: nuevoEfDest,
          usuario_id: req.user!.id,
          referencia_id: cambio.id,
          tipo_referencia: "CAMBIO_DIVISA",
          descripcion: `Reverso eliminación cambio (destino efectivo) #${
            cambio.numero_recibo || ""
          }`,
        });

        // Ajuste por BANCOS (si aplica)
        if (egBk > 0 && typeof saldoDestino?.bancos !== "undefined") {
          await logMovimientoSaldo(tx, {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_destino_id,
            tipo_movimiento: "AJUSTE",
            monto: egBk,
            saldo_anterior: antBk,
            saldo_nuevo: nuevoBkDest,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Reverso eliminación cambio (destino bancos) #${
              cambio.numero_recibo || ""
            }`,
          });
        }

        // Borrar recibos vinculados
        await tx.recibo.deleteMany({
          where: {
            OR: [
              { referencia_id: cambio.id },
              { numero_recibo: cambio.numero_recibo || undefined },
              {
                numero_recibo: (cambio as any).numero_recibo_abono || undefined,
              },
              {
                numero_recibo:
                  (cambio as any).numero_recibo_completar || undefined,
              },
            ].filter(Boolean) as any,
          },
        });

        // Borrar cambio
        await tx.cambioDivisa.delete({ where: { id: cambio.id } });
      });

      logger.info("Cambio de divisa eliminado por admin", {
        cambio_id: id,
        user_id: req.user?.id,
      });
      res.json({ success: true });
    } catch (error) {
      logger.error("Error eliminando cambio de divisa", {
        error: error instanceof Error ? error.message : String(error),
      });
      res
        .status(500)
        .json({ success: false, error: "No se pudo eliminar el cambio" });
    }
  }
);

export default router;
