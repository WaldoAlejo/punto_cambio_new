import express from "express";
import { EstadoTransaccion, TipoOperacion } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import axios from "axios";
import {
  todayGyeDateOnly,
  gyeDayRangeUtcFromDateOnly,
} from "../utils/timezone.js";

const router = express.Router();

const exchangeSchema = z.object({
  moneda_origen_id: z.string().uuid(),
  moneda_destino_id: z.string().uuid(),
  monto_origen: z.number().nonnegative(),
  monto_destino: z.number().nonnegative(),

  // Tasas diferenciadas (0 permitido cuando no aplica)
  tasa_cambio_billetes: z.number().nonnegative().default(0),
  tasa_cambio_monedas: z.number().nonnegative().default(0),

  tipo_operacion: z.nativeEnum(TipoOperacion),
  punto_atencion_id: z.string().uuid(),
  datos_cliente: z.object({
    nombre: z.string(),
    apellido: z.string(),
    documento: z.string().optional().nullable(), // opcional; lo normalizamos a cédula si viene vacío
    cedula: z.string(),
    telefono: z.string().optional(),
  }),

  // Detalles de divisas entregadas (por el cliente) - MONEDA ORIGEN
  divisas_entregadas_billetes: z.number().default(0),
  divisas_entregadas_monedas: z.number().default(0),
  divisas_entregadas_total: z.number().default(0),

  // Detalles de divisas recibidas (por el cliente) - MONEDA DESTINO
  divisas_recibidas_billetes: z.number().default(0),
  divisas_recibidas_monedas: z.number().default(0),
  divisas_recibidas_total: z.number().default(0),

  // Control de entrega USD
  metodo_entrega: z
    .enum(["efectivo", "transferencia", "mixto"])
    .default("efectivo"),
  usd_entregado_efectivo: z.number().optional().nullable(),
  usd_entregado_transfer: z.number().optional().nullable(),

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

router.post(
  "/",
  authenticateToken,
  validate(exchangeSchema),
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
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
        transferencia_numero,
        transferencia_banco,
        transferencia_imagen_url,
        abono_inicial_monto,
        abono_inicial_fecha,
        abono_inicial_recibido_por,
        saldo_pendiente,
        referencia_cambio_principal,
      } = req.body;

      // Normalización de par con USD para evitar inversiones por error en selección
      // Regla:
      // - COMPRA: el cliente entrega divisa (no USD) y recibe USD
      // - VENTA: el cliente entrega USD y recibe divisa (no USD)
      // Si viene invertido y una de las monedas es USD, intercambiamos origen/destino y sus montos/detalles
      try {
        const usdMoneda = await prisma.moneda.findFirst({
          where: { codigo: "USD" },
        });

        // Normalizar valores de entrega USD segun metodo
        if (metodo_entrega === "efectivo") {
          usd_entregado_efectivo = Number(divisas_recibidas_total || 0);
          usd_entregado_transfer = 0;
        } else if (metodo_entrega === "transferencia") {
          usd_entregado_efectivo = 0;
          usd_entregado_transfer = Number(divisas_recibidas_total || 0);
        } else if (metodo_entrega === "mixto") {
          // Si llegan ambos, se respetan; si solo uno, el otro va a 0
          usd_entregado_efectivo = Number(usd_entregado_efectivo || 0);
          usd_entregado_transfer = Number(usd_entregado_transfer || 0);
          // Ajuste por seguridad: la suma no debe exceder el total a entregar
          const totalUsd = Number(divisas_recibidas_total || 0);
          if (usd_entregado_efectivo + usd_entregado_transfer > totalUsd) {
            usd_entregado_transfer = Math.max(
              0,
              totalUsd - usd_entregado_efectivo
            );
          }
        }
        if (
          usdMoneda &&
          (moneda_origen_id === usdMoneda.id ||
            moneda_destino_id === usdMoneda.id)
        ) {
          const usdMonedaId = usdMoneda.id;
          const isCompra = tipo_operacion === "COMPRA";
          const isVenta = tipo_operacion === "VENTA";

          if (isCompra) {
            // USD debe ser DESTINO
            if (moneda_origen_id === usdMonedaId) {
              // Swap monedas
              [moneda_origen_id, moneda_destino_id] = [
                moneda_destino_id,
                moneda_origen_id,
              ];
              // Swap montos totales
              [monto_origen, monto_destino] = [monto_destino, monto_origen];
              // Swap detalles de divisas
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
          } else if (isVenta) {
            // USD debe ser ORIGEN
            if (moneda_destino_id === usdMoneda.id) {
              // Swap monedas
              [moneda_origen_id, moneda_destino_id] = [
                moneda_destino_id,
                moneda_origen_id,
              ];
              // Swap montos totales
              [monto_origen, monto_destino] = [monto_destino, monto_origen];
              // Swap detalles de divisas
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
        }
      } catch (e) {
        // Si falla la normalización, continuamos sin bloquear la operación
        logger.warn("No se pudo normalizar par USD (continuando)", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (!req.user?.id) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Monedas deben ser distintas
      if (moneda_origen_id === moneda_destino_id) {
        res.status(400).json({
          success: false,
          error: "Moneda origen y destino no pueden ser iguales",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Si es transferencia, banco y número son requeridos
      if (metodo_entrega === "transferencia") {
        if (!transferencia_banco || !String(transferencia_banco).trim()) {
          res.status(400).json({
            success: false,
            error: "Banco requerido para transferencia",
            details: { transferencia_banco: "Requerido" },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (!transferencia_numero || !String(transferencia_numero).trim()) {
          res.status(400).json({
            success: false,
            error: "Número de referencia requerido para transferencia",
            details: { transferencia_numero: "Requerido" },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      logger.info("Creando cambio de divisa", {
        usuario_id: req.user.id,
        punto_atencion_id,
        tipo_operacion,
        monto_origen,
        monto_destino,
        metodo_entrega,
        abono_inicial_monto,
        saldo_pendiente,
        referencia_cambio_principal,
      });

      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: punto_atencion_id },
      });

      if (!punto) {
        res.status(400).json({
          error: "Punto de atención no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [monedaOrigen, monedaDestino] = await Promise.all([
        prisma.moneda.findUnique({ where: { id: moneda_origen_id } }),
        prisma.moneda.findUnique({ where: { id: moneda_destino_id } }),
      ]);

      if (!monedaOrigen || !monedaDestino) {
        res.status(400).json({
          error: "Una o ambas monedas no fueron encontradas",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Normalizar documento del cliente (si falta, usar la cédula)
      const datos_cliente_sanitized = {
        ...datos_cliente,
        documento:
          (datos_cliente?.documento &&
            String(datos_cliente.documento).trim()) ||
          (datos_cliente?.cedula && String(datos_cliente.cedula).trim()) ||
          "",
      };

      // Recalcular y forzar consistencia de totales y montos
      const entregadas_total_calc =
        Number(divisas_entregadas_billetes || 0) +
        Number(divisas_entregadas_monedas || 0);
      const recibidas_total_calc =
        Number(divisas_recibidas_billetes || 0) +
        Number(divisas_recibidas_monedas || 0);

      const monto_origen_final =
        Number(monto_origen || 0) > 0
          ? Number(monto_origen)
          : entregadas_total_calc;
      const monto_destino_final =
        Number(monto_destino || 0) > 0
          ? Number(monto_destino)
          : recibidas_total_calc;

      const divisas_entregadas_total_final =
        Number(divisas_entregadas_total || 0) > 0
          ? Number(divisas_entregadas_total)
          : entregadas_total_calc;

      const divisas_recibidas_total_final =
        Number(divisas_recibidas_total || 0) > 0
          ? Number(divisas_recibidas_total)
          : recibidas_total_calc;

      if (
        !isFinite(monto_origen_final) ||
        !isFinite(monto_destino_final) ||
        monto_origen_final <= 0 ||
        monto_destino_final <= 0
      ) {
        res.status(400).json({
          success: false,
          error: "Montos inválidos: deben ser mayores a 0",
          details: {
            monto_origen: monto_origen_final,
            monto_destino: monto_destino_final,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const timestamp = new Date().getTime();
      const numeroRecibo = `CAM-${timestamp}`;

      console.log("💫 Creating exchange with data:", {
        moneda_origen_id,
        moneda_destino_id,
        monto_origen: Number(monto_origen_final),
        monto_destino: Number(monto_destino_final),
        tasa_cambio_billetes: Number(tasa_cambio_billetes),
        tasa_cambio_monedas: Number(tasa_cambio_monedas),
        tipo_operacion,
        usuario_id: req.user.id,
        punto_atencion_id,
        numeroRecibo,
        abono_inicial_monto,
        saldo_pendiente,
        estado:
          saldo_pendiente && saldo_pendiente > 0
            ? EstadoTransaccion.PENDIENTE
            : EstadoTransaccion.COMPLETADO,
      });

      const exchange = await prisma.cambioDivisa.create({
        data: {
          moneda_origen_id,
          moneda_destino_id,
          monto_origen: Number(monto_origen_final),
          monto_destino: Number(monto_destino_final),
          tasa_cambio_billetes: Number(tasa_cambio_billetes),
          tasa_cambio_monedas: Number(tasa_cambio_monedas),
          tipo_operacion,
          usuario_id: req.user.id,
          punto_atencion_id,
          observacion: observacion || null,
          numero_recibo: numeroRecibo,
          // Si tiene saldo pendiente, marcar como PENDIENTE, sino COMPLETADO
          estado:
            saldo_pendiente && saldo_pendiente > 0
              ? EstadoTransaccion.PENDIENTE
              : EstadoTransaccion.COMPLETADO,
          metodo_entrega,
          transferencia_numero:
            metodo_entrega !== "efectivo" ? transferencia_numero : null,
          transferencia_banco:
            metodo_entrega !== "efectivo" ? transferencia_banco : null,
          transferencia_imagen_url:
            metodo_entrega !== "efectivo" ? transferencia_imagen_url : null,
          // Detalle USD entregado: efectivo vs transferencia
          usd_entregado_efectivo: usd_entregado_efectivo ?? null,
          usd_entregado_transfer: usd_entregado_transfer ?? null,
          abono_inicial_monto: abono_inicial_monto ?? null,
          abono_inicial_fecha: abono_inicial_fecha
            ? new Date(abono_inicial_fecha)
            : null,
          abono_inicial_recibido_por: abono_inicial_recibido_por ?? null,
          saldo_pendiente: saldo_pendiente ?? null,
          referencia_cambio_principal: referencia_cambio_principal ?? null,
          cliente: `${datos_cliente_sanitized.nombre} ${datos_cliente_sanitized.apellido}`,
          // Campos de divisas ENTREGADAS por el cliente (origen)
          divisas_entregadas_billetes: Number(divisas_entregadas_billetes || 0),
          divisas_entregadas_monedas: Number(divisas_entregadas_monedas || 0),
          divisas_entregadas_total: Number(divisas_entregadas_total_final),
          // Campos de divisas RECIBIDAS por el cliente (destino)
          divisas_recibidas_billetes: Number(divisas_recibidas_billetes || 0),
          divisas_recibidas_monedas: Number(divisas_recibidas_monedas || 0),
          divisas_recibidas_total: Number(divisas_recibidas_total_final),
        },
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      console.log("✅ Exchange created successfully:", {
        id: exchange.id,
        estado: exchange.estado,
        numero_recibo: exchange.numero_recibo,
        fecha: exchange.fecha,
      });

      // Construir objetos de divisas para compatibilidad (recibo)
      const divisas_entregadas = {
        billetes: Number(divisas_entregadas_billetes || 0),
        monedas: Number(divisas_entregadas_monedas || 0),
        total: Number(divisas_entregadas_total_final),
      };

      const divisas_recibidas = {
        billetes: Number(divisas_recibidas_billetes || 0),
        monedas: Number(divisas_recibidas_monedas || 0),
        total: Number(divisas_recibidas_total_final),
      };

      await prisma.recibo.create({
        data: {
          numero_recibo: numeroRecibo,
          tipo_operacion: "CAMBIO_DIVISA",
          referencia_id: exchange.id,
          usuario_id: req.user.id,
          punto_atencion_id,
          datos_operacion: {
            ...exchange,
            datos_cliente: datos_cliente_sanitized,
            divisas_entregadas,
            divisas_recibidas,
          },
        },
      });

      // === Contabilidad de saldos (billetes / monedas) ===
      await prisma.$transaction(async (tx) => {
        // 1) Moneda ORIGEN: el punto RECIBE -> sumar
        const saldoOrigen = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id: moneda_origen_id,
            },
          },
        });
        const saldoOrigenAnterior = Number(saldoOrigen?.cantidad ?? 0);
        const saldoOrigenNuevo =
          saldoOrigenAnterior + Number(divisas_entregadas_total_final || 0);
        const billetesOrigenAnterior = Number(saldoOrigen?.billetes ?? 0);
        const monedasOrigenAnterior = Number(saldoOrigen?.monedas_fisicas ?? 0);
        const billetesOrigenNuevo =
          billetesOrigenAnterior + Number(divisas_entregadas_billetes || 0);
        const monedasOrigenNuevo =
          monedasOrigenAnterior + Number(divisas_entregadas_monedas || 0);

        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id: moneda_origen_id,
            },
          },
          update: {
            cantidad: saldoOrigenNuevo,
            billetes: billetesOrigenNuevo,
            monedas_fisicas: monedasOrigenNuevo,
          },
          create: {
            punto_atencion_id,
            moneda_id: moneda_origen_id,
            cantidad: saldoOrigenNuevo,
            billetes: billetesOrigenNuevo,
            monedas_fisicas: monedasOrigenNuevo,
          },
        });

        await tx.movimientoSaldo.create({
          data: {
            punto_atencion_id,
            moneda_id: moneda_origen_id,
            tipo_movimiento: "CAMBIO_DIVISA",
            monto: Number(divisas_entregadas_total_final || 0),
            saldo_anterior: saldoOrigenAnterior,
            saldo_nuevo: saldoOrigenNuevo,
            usuario_id: req.user!.id,
            referencia_id: exchange.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Ingreso por cambio - Recibido del cliente (${numeroRecibo})`,
          },
        });

        // 2) Moneda DESTINO: el punto ENTREGA -> restar efectivo y/o bancos según método
        const saldoDestino = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id: moneda_destino_id,
            },
          },
        });
        const saldoDestinoAnterior = Number(saldoDestino?.cantidad ?? 0);
        const bancosAnterior = Number(saldoDestino?.bancos ?? 0);

        // Determinar si la moneda destino es USD para usar los campos específicos de USD
        const isDestinoUSD = monedaDestino.codigo === "USD";

        let egresoEfectivo, egresoTransfer, egresoTotal;

        if (isDestinoUSD) {
          // Si la moneda destino es USD, usar los campos específicos de USD
          egresoEfectivo = Number(usd_entregado_efectivo || 0);
          egresoTransfer = Number(usd_entregado_transfer || 0);
          egresoTotal = egresoEfectivo + egresoTransfer;
        } else {
          // Si la moneda destino NO es USD, usar el total de divisas recibidas
          // y distribuir según el método de entrega
          const totalEgreso = Number(divisas_recibidas_total_final || 0);

          if (metodo_entrega === "efectivo") {
            egresoEfectivo = totalEgreso;
            egresoTransfer = 0;
          } else if (metodo_entrega === "transferencia") {
            egresoEfectivo = 0;
            egresoTransfer = totalEgreso;
          } else if (metodo_entrega === "mixto") {
            // Para mixto, usar los valores USD si están disponibles, sino distribuir proporcionalmente
            egresoEfectivo = Number(usd_entregado_efectivo || 0);
            egresoTransfer = Number(usd_entregado_transfer || 0);
            // Si no suman el total, ajustar
            if (egresoEfectivo + egresoTransfer !== totalEgreso) {
              egresoEfectivo = totalEgreso / 2; // Distribución por defecto
              egresoTransfer = totalEgreso / 2;
            }
          }

          egresoTotal = egresoEfectivo + egresoTransfer;
        }

        if (saldoDestinoAnterior < egresoEfectivo) {
          throw new Error(
            "Saldo efectivo insuficiente en moneda destino para realizar el cambio"
          );
        }
        if (bancosAnterior < egresoTransfer) {
          throw new Error(
            "Saldo en bancos insuficiente para realizar el cambio por transferencia"
          );
        }

        const saldoDestinoNuevo = saldoDestinoAnterior - egresoEfectivo;
        const bancosNuevo = bancosAnterior - egresoTransfer;

        const billetesDestinoAnterior = Number(saldoDestino?.billetes ?? 0);
        const monedasDestinoAnterior = Number(
          saldoDestino?.monedas_fisicas ?? 0
        );
        const billetesDestinoEgreso = Number(divisas_recibidas_billetes || 0);
        const monedasDestinoEgreso = Number(divisas_recibidas_monedas || 0);

        const billetesDestinoNuevo = Math.max(
          0,
          billetesDestinoAnterior - billetesDestinoEgreso
        );
        const monedasDestinoNuevo = Math.max(
          0,
          monedasDestinoAnterior - monedasDestinoEgreso
        );

        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id: moneda_destino_id,
            },
          },
          update: {
            cantidad: saldoDestinoNuevo,
            billetes: billetesDestinoNuevo,
            monedas_fisicas: monedasDestinoNuevo,
            bancos: bancosNuevo,
          },
          create: {
            punto_atencion_id,
            moneda_id: moneda_destino_id,
            cantidad: saldoDestinoNuevo,
            billetes: billetesDestinoNuevo,
            monedas_fisicas: monedasDestinoNuevo,
            bancos: bancosNuevo,
          },
        });

        // Movimiento por efectivo
        if (egresoEfectivo > 0) {
          await tx.movimientoSaldo.create({
            data: {
              punto_atencion_id,
              moneda_id: moneda_destino_id,
              tipo_movimiento: "CAMBIO_DIVISA",
              monto: -egresoEfectivo,
              saldo_anterior: saldoDestinoAnterior,
              saldo_nuevo: saldoDestinoNuevo,
              usuario_id: req.user!.id,
              referencia_id: exchange.id,
              tipo_referencia: "CAMBIO_DIVISA",
              descripcion: `Egreso por cambio (EFECTIVO) - Entregado al cliente (${numeroRecibo})`,
            },
          });
        }

        // Movimiento por bancos (registro de control)
        if (egresoTransfer > 0) {
          await tx.movimientoSaldo.create({
            data: {
              punto_atencion_id,
              moneda_id: moneda_destino_id,
              tipo_movimiento: "CAMBIO_DIVISA",
              monto: -egresoTransfer, // Registrar el egreso por transferencia
              saldo_anterior: bancosAnterior, // referencia del saldo en bancos
              saldo_nuevo: saldoDestinoNuevo,
              usuario_id: req.user!.id,
              referencia_id: exchange.id,
              tipo_referencia: "CAMBIO_DIVISA",
              descripcion: `Egreso por cambio (BANCOS) - Transferencia ${
                transferencia_banco || ""
              } ${transferencia_numero || ""}`.trim(),
            },
          });
        }
      });

      const exchangeResponse = {
        ...exchange,
        datos_cliente: datos_cliente_sanitized,
        divisas_entregadas,
        divisas_recibidas,
      };

      logger.info("Cambio de divisa creado y contabilizado exitosamente", {
        exchangeId: exchange.id,
        numeroRecibo,
        usuario_id: req.user.id,
      });

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
        error: "Error interno del servidor al crear cambio de divisa",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.get(
  "/",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const whereClause: ExchangeWhereClause = {};

      if (req.query.point_id) {
        whereClause.punto_atencion_id = req.query.point_id as string;
      }

      if (req.query.estado) {
        const estadoQuery = req.query.estado as string;
        if (
          estadoQuery === EstadoTransaccion.PENDIENTE ||
          estadoQuery === EstadoTransaccion.COMPLETADO
        ) {
          whereClause.estado = estadoQuery as EstadoTransaccion;
        }
      }

      if (req.user.rol === "OPERADOR") {
        whereClause.usuario_id = req.user.id;
      }

      // Date scoping: default to today's GYE day unless date/from/to provided
      const { date, from, to } = req.query as {
        date?: string;
        from?: string;
        to?: string;
      };

      let gte: Date;
      let lt: Date;
      if (from || to) {
        // Range mode: inclusive of entire days from 'from' to 'to'
        const fromStr = (from || (to as string)) as string; // if only 'to' provided, use it for both
        const toStr = (to || (from as string)) as string; // if only 'from' provided, use it for both
        const rFrom = gyeDayRangeUtcFromDateOnly(fromStr).gte;
        const rTo = gyeDayRangeUtcFromDateOnly(toStr).lt; // end of day for 'to'
        gte = rFrom;
        lt = rTo;
      } else {
        const dateStr = (date && String(date)) || todayGyeDateOnly();
        const r = gyeDayRangeUtcFromDateOnly(dateStr);
        gte = r.gte;
        lt = r.lt;
      }

      const exchanges = await prisma.cambioDivisa.findMany({
        where: {
          ...whereClause,
          fecha: { gte, lt },
        },
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: {
          fecha: "desc",
        },
        take: 50,
      });

      logger.info("Cambios de divisa obtenidos", {
        count: exchanges.length,
        usuario_id: req.user.id,
      });

      res.status(200).json({
        exchanges,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener cambios de divisa", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuario_id: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener cambios de divisa",
        details: error instanceof Error ? error.message : String(error),
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.patch(
  "/:id/cerrar",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    const { id } = req.params;

    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const cambio = await prisma.cambioDivisa.findUnique({
        where: { id },
      });

      if (!cambio) {
        res.status(404).json({
          error: "Cambio de divisa no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (cambio.estado === EstadoTransaccion.COMPLETADO) {
        res.status(400).json({
          error: "El cambio ya está completado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedCambio = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          estado: EstadoTransaccion.COMPLETADO,
        },
      });

      const numeroReciboCierre = `CIERRE-${new Date().getTime()}`;

      await prisma.recibo.create({
        data: {
          numero_recibo: numeroReciboCierre,
          tipo_operacion: "CAMBIO_DIVISA",
          referencia_id: updatedCambio.id,
          usuario_id: req.user.id,
          punto_atencion_id: updatedCambio.punto_atencion_id,
          datos_operacion: updatedCambio,
        },
      });

      logger.info("Cambio de divisa cerrado", {
        cambioId: updatedCambio.id,
        usuario_id: req.user.id,
      });

      res.status(200).json({
        exchange: updatedCambio,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cerrar cambio de divisa", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuario_id: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno del servidor al cerrar cambio de divisa",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Completar cambio pendiente (setear detalles de entrega y marcar COMPLETADO)
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
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({
          error: "Cambio de divisa no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (cambio.estado === EstadoTransaccion.COMPLETADO) {
        res.status(400).json({
          error: "El cambio ya está completado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Si el método indicado es transferencia, exigir banco y número
      if (metodo_entrega === "transferencia") {
        if (!transferencia_banco || !String(transferencia_banco).trim()) {
          res.status(400).json({
            success: false,
            error: "Banco requerido para transferencia",
            details: { transferencia_banco: "Requerido" },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (!transferencia_numero || !String(transferencia_numero).trim()) {
          res.status(400).json({
            success: false,
            error: "Número de referencia requerido para transferencia",
            details: { transferencia_numero: "Requerido" },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const numeroReciboCompletar = `COMP-${Date.now()}`;

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
            divisas_recibidas_billetes ?? cambio.divisas_recibidas_billetes,
          divisas_recibidas_monedas:
            divisas_recibidas_monedas ?? cambio.divisas_recibidas_monedas,
          divisas_recibidas_total:
            divisas_recibidas_total ?? cambio.divisas_recibidas_total,
          numero_recibo_completar: numeroReciboCompletar,
          fecha_completado: new Date(),
        },
        include: {
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
          punto_atencion_id: updated.punto_atencion_id,
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
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuario_id: req.user?.id,
      });
      res.status(500).json({
        error: "Error interno del servidor al completar cambio de divisa",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Endpoint para obtener cambios pendientes
router.get(
  "/pending",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { pointId } = req.query;

      if (!pointId) {
        res.status(400).json({
          success: false,
          error: "Se requiere pointId",
        });
        return;
      }

      const exchanges = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: pointId as string,
          estado: {
            in: [EstadoTransaccion.PENDIENTE],
          },
          saldo_pendiente: {
            gt: 0,
          },
        },
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: {
          fecha: "desc",
        },
      });

      logger.info("Cambios pendientes obtenidos", {
        count: exchanges.length,
        pointId,
      });

      res.json({
        success: true,
        exchanges,
      });
    } catch (error) {
      logger.error("Error fetching pending exchanges", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Endpoint para obtener cambios parciales (con saldo pendiente)
router.get(
  "/partial",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { pointId } = req.query;

      // Solo admin y super usuario pueden ver cambios parciales de todos los puntos
      const isAdmin =
        req.user?.rol === "ADMIN" || req.user?.rol === "SUPER_USUARIO";

      let whereClause: any = {
        saldo_pendiente: {
          gt: 0,
        },
        estado: EstadoTransaccion.PENDIENTE, // Solo cambios pendientes
      };

      // Si no es admin, solo puede ver los de su punto
      if (!isAdmin && pointId) {
        whereClause.punto_atencion_id = pointId as string;
      } else if (isAdmin && pointId && pointId !== "ALL") {
        whereClause.punto_atencion_id = pointId as string;
      }

      const exchanges = await prisma.cambioDivisa.findMany({
        where: whereClause,
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          abonoInicialRecibidoPorUsuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
        orderBy: {
          fecha: "desc",
        },
      });

      logger.info("Cambios parciales obtenidos", {
        count: exchanges.length,
        pointId,
        requestedBy: req.user?.id,
      });

      res.json({
        success: true,
        exchanges,
      });
    } catch (error) {
      logger.error("Error fetching partial exchanges", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Endpoint para completar un cambio parcial
router.patch(
  "/:id/complete-partial",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { completado_por_usuario_id } = req.body;

      // Solo admin y super usuario pueden completar cambios parciales
      const isAdmin =
        req.user?.rol === "ADMIN" || req.user?.rol === "SUPER_USUARIO";

      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: "Solo administradores pueden completar cambios parciales",
        });
        return;
      }

      // Verificar que el cambio existe y tiene saldo pendiente
      const exchange = await prisma.cambioDivisa.findUnique({
        where: { id },
        include: {
          monedaDestino: {
            select: {
              codigo: true,
              simbolo: true,
            },
          },
        },
      });

      if (!exchange) {
        res.status(404).json({
          success: false,
          error: "Cambio no encontrado",
        });
        return;
      }

      if (!exchange.saldo_pendiente || exchange.saldo_pendiente.lte(0)) {
        res.status(400).json({
          success: false,
          error: "Este cambio no tiene saldo pendiente",
        });
        return;
      }

      // Actualizar el cambio para completarlo
      const updatedExchange = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          saldo_pendiente: 0,
          fecha_completado: new Date(),
          estado: EstadoTransaccion.COMPLETADO,
        },
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      logger.info("Cambio parcial completado", {
        exchangeId: id,
        saldoCompletado: exchange.saldo_pendiente,
        completadoPor: req.user?.id,
        moneda: exchange.monedaDestino?.codigo,
      });

      res.json({
        success: true,
        exchange: updatedExchange,
        message: `Cambio parcial completado. Saldo de ${
          exchange.monedaDestino?.simbolo || ""
        }${exchange.saldo_pendiente} entregado.`,
      });
    } catch (error) {
      logger.error("Error completing partial exchange", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        exchangeId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Endpoint para registrar un abono parcial
router.patch(
  "/:id/register-partial-payment",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { abono_inicial_monto, abono_inicial_fecha, observacion_parcial } =
        req.body;

      // Verificar que el cambio existe
      const exchange = await prisma.cambioDivisa.findUnique({
        where: { id },
        include: {
          monedaDestino: {
            select: {
              codigo: true,
              simbolo: true,
            },
          },
        },
      });

      if (!exchange) {
        res.status(404).json({
          success: false,
          error: "Cambio no encontrado",
        });
        return;
      }

      // Verificar que el cambio no esté ya completado
      if (exchange.estado === EstadoTransaccion.COMPLETADO) {
        res.status(400).json({
          success: false,
          error: "Este cambio ya está completado",
        });
        return;
      }

      // Validar el monto del abono
      const abonoMonto = Number(abono_inicial_monto);
      const montoDestino = Number(exchange.monto_destino);

      if (abonoMonto <= 0 || abonoMonto >= montoDestino) {
        res.status(400).json({
          success: false,
          error: "El monto del abono debe ser mayor a 0 y menor al monto total",
        });
        return;
      }

      // Calcular saldo pendiente
      const saldoPendiente = montoDestino - abonoMonto;

      // Actualizar el cambio con la información del abono parcial
      const updatedExchange = await prisma.cambioDivisa.update({
        where: { id },
        data: {
          abono_inicial_monto: abonoMonto,
          abono_inicial_fecha: new Date(abono_inicial_fecha),
          abono_inicial_recibido_por: req.user?.id, // ID del usuario que recibe el abono
          saldo_pendiente: saldoPendiente,
          observacion_parcial: observacion_parcial || null,
          estado: EstadoTransaccion.PENDIENTE, // Mantener como pendiente hasta completar
        },
        include: {
          monedaOrigen: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          monedaDestino: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
              simbolo: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          abonoInicialRecibidoPorUsuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
      });

      logger.info("Abono parcial registrado", {
        exchangeId: id,
        abonoMonto,
        saldoPendiente,
        recibidoPor: req.user?.id,
        moneda: exchange.monedaDestino?.codigo,
      });

      res.json({
        success: true,
        exchange: updatedExchange,
        message: `Abono parcial registrado. Saldo pendiente: ${
          exchange.monedaDestino?.simbolo || ""
        }${saldoPendiente.toFixed(2)}`,
      });
    } catch (error) {
      logger.error("Error registering partial payment", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        exchangeId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Ruta para buscar clientes por nombre y cédula
router.get(
  "/search-customers",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { query } = req.query;

      if (!query || typeof query !== "string" || query.trim().length < 2) {
        res.status(400).json({
          error: "Debe proporcionar al menos 2 caracteres para la búsqueda",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const searchTerm = query.trim().toLowerCase();

      logger.info("Buscando clientes", {
        searchTerm,
        usuario_id: req.user.id,
      });

      // Buscar en cambios de divisa por nombre completo
      const exchanges = await prisma.cambioDivisa.findMany({
        where: {
          cliente: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          cliente: true,
          fecha: true,
          numero_recibo: true,
        },
        orderBy: {
          fecha: "desc",
        },
        take: 20,
      });

      // Buscar también en recibos con datos_cliente
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
        orderBy: {
          fecha: "desc",
        },
        take: 20,
      });

      const clientesFromExchanges = exchanges.map((exchange) => ({
        id: exchange.id,
        nombre: exchange.cliente?.split(" ")[0] || "",
        apellido: exchange.cliente?.split(" ").slice(1).join(" ") || "",
        cedula: "",
        telefono: "",
        fuente: "exchange",
        fecha_ultima_operacion: exchange.fecha,
        numero_recibo: exchange.numero_recibo,
      }));

      const clientesFromRecibos = recibos.map((recibo) => {
        const datosCliente =
          (recibo.datos_operacion as any)?.datos_cliente || {};
        return {
          id: recibo.id,
          nombre: datosCliente.nombre || "",
          apellido: datosCliente.apellido || "",
          cedula: datosCliente.cedula || "",
          telefono: datosCliente.telefono || "",
          fuente: "recibo",
          fecha_ultima_operacion: recibo.fecha,
          numero_recibo: recibo.numero_recibo,
        };
      });

      // Combinar y deduplicar por cédula (si no hay cédula, usar nombre+apellido)
      const todosClientes = [...clientesFromExchanges, ...clientesFromRecibos];
      const clientesUnicos = new Map<
        string,
        | (typeof clientesFromExchanges)[number]
        | (typeof clientesFromRecibos)[number]
      >();

      todosClientes.forEach((cliente) => {
        const key =
          (cliente as any).cedula || `${cliente.nombre}_${cliente.apellido}`;
        if (
          !clientesUnicos.has(key) ||
          new Date(cliente.fecha_ultima_operacion) >
            new Date((clientesUnicos.get(key) as any).fecha_ultima_operacion)
        ) {
          clientesUnicos.set(key, cliente);
        }
      });

      const resultados = Array.from(clientesUnicos.values())
        .filter((cliente: any) => {
          const nombreCompleto =
            `${cliente.nombre} ${cliente.apellido}`.toLowerCase();
          const cedula = (cliente.cedula || "").toLowerCase();
          return (
            nombreCompleto.includes(searchTerm) || cedula.includes(searchTerm)
          );
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.fecha_ultima_operacion).getTime() -
            new Date(a.fecha_ultima_operacion).getTime()
        )
        .slice(0, 10);

      logger.info("Búsqueda de clientes completada", {
        searchTerm,
        resultados: resultados.length,
        usuario_id: req.user.id,
      });

      res.status(200).json({
        clientes: resultados,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al buscar clientes", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        usuario_id: req.user?.id,
      });

      res.status(500).json({
        error: "Error interno del servidor al buscar clientes",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Recontabilizar un cambio ya creado: idempotente por referencia
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

      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }

      // Construir movimientos esperados (para el endpoint contable)
      const movimientos = [
        {
          punto_atencion_id: cambio.punto_atencion_id,
          moneda_id: cambio.moneda_destino_id,
          tipo_movimiento: "EGRESO",
          monto: Number(cambio.monto_destino),
          usuario_id: req.user.id,
          referencia_id: cambio.id,
          tipo_referencia: "CAMBIO_DIVISA",
          descripcion: `Cambio de divisas - Entrega ${cambio.monto_destino}`,
        },
        {
          punto_atencion_id: cambio.punto_atencion_id,
          moneda_id: cambio.moneda_origen_id,
          tipo_movimiento: "INGRESO",
          monto: Number(cambio.monto_origen),
          usuario_id: req.user.id,
          referencia_id: cambio.id,
          tipo_referencia: "CAMBIO_DIVISA",
          descripcion: `Cambio de divisas - Recepción ${cambio.monto_origen}`,
        },
      ];

      // Evitar duplicados
      const existentes = await prisma.movimientoSaldo.findMany({
        where: {
          referencia_id: cambio.id,
          tipo_referencia: "CAMBIO_DIVISA",
        },
        select: { id: true },
      });

      if (existentes.length > 0) {
        res.status(200).json({
          success: true,
          message: "Movimientos ya existentes para este cambio. No se duplicó.",
        });
        return;
      }

      const baseUrl =
        process.env.INTERNAL_API_BASE_URL || "http://localhost:3001/api";
      const url = `${baseUrl}/movimientos-contables/procesar-cambio`;

      const response = await axios.post(
        url,
        {
          cambio_id: cambio.id,
          movimientos,
        },
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

// Eliminar un cambio de divisa (solo ADMIN)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Cargar cambio
      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }

      // Restringir a operaciones del mismo día (zona GYE)
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
      } catch (e) {
        // Si util falla, no arriesgar: bloquear por seguridad
        res.status(400).json({
          success: false,
          error: "Restricción de día no disponible. Intente más tarde.",
        });
        return;
      }

      // Iniciar transacción para revertir saldos y borrar recibos relacionados
      await prisma.$transaction(async (tx) => {
        // 1) Revertir efecto en saldos según lo registrado
        // Moneda ORIGEN: en creación sumamos ENTREGADAS -> revertimos restando
        const saldoOrigen = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
        });
        const origenAnterior = Number(saldoOrigen?.cantidad ?? 0);
        const origenNuevo = Math.max(
          0,
          origenAnterior -
            Number(cambio.divisas_entregadas_total || cambio.monto_origen || 0)
        );
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
          update: { cantidad: origenNuevo },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            cantidad: origenNuevo,
            billetes: 0,
            monedas_fisicas: 0,
          },
        });
        await tx.movimientoSaldo.create({
          data: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            tipo_movimiento: "AJUSTE",
            monto: -Number(
              cambio.divisas_entregadas_total || cambio.monto_origen || 0
            ),
            saldo_anterior: origenAnterior,
            saldo_nuevo: origenNuevo,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Reverso eliminación cambio (origen) #${
              cambio.numero_recibo || ""
            }`,
          },
        });

        // Moneda DESTINO: en creación restamos RECIBIDAS -> revertimos sumando
        const saldoDestino = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
        });
        const destinoAnterior = Number(saldoDestino?.cantidad ?? 0);
        const sumDest = Number(
          cambio.divisas_recibidas_total || cambio.monto_destino || 0
        );
        const destinoNuevo = destinoAnterior + sumDest;
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
          update: { cantidad: destinoNuevo },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_destino_id,
            cantidad: destinoNuevo,
            billetes: 0,
            monedas_fisicas: 0,
          },
        });
        await tx.movimientoSaldo.create({
          data: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_destino_id,
            tipo_movimiento: "AJUSTE",
            monto: sumDest,
            saldo_anterior: destinoAnterior,
            saldo_nuevo: destinoNuevo,
            usuario_id: req.user!.id,
            referencia_id: cambio.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Reverso eliminación cambio (destino) #${
              cambio.numero_recibo || ""
            }`,
          },
        });

        // 2) Eliminar recibos vinculados (si existen)
        await tx.recibo.deleteMany({
          where: {
            OR: [
              { referencia_id: cambio.id },
              { numero_recibo: cambio.numero_recibo || undefined },
              { numero_recibo: cambio.numero_recibo_abono || undefined },
              { numero_recibo: cambio.numero_recibo_completar || undefined },
            ].filter(Boolean) as any,
          },
        });

        // 3) Eliminar el cambio en sí
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
