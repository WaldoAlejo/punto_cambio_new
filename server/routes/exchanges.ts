import express from "express";
import { EstadoTransaccion, TipoOperacion } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import axios from "axios";

const router = express.Router();

const exchangeSchema = z.object({
  moneda_origen_id: z.string().uuid(),
  moneda_destino_id: z.string().uuid(),
  monto_origen: z.number().positive(),
  monto_destino: z.number().positive(),

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

  observacion: z.string().optional(),
  metodo_entrega: z.enum(["efectivo", "transferencia"]),
  transferencia_numero: z.string().optional().nullable(),
  transferencia_banco: z.string().optional().nullable(),
  transferencia_imagen_url: z.string().optional().nullable(),
  abono_inicial_monto: z.number().optional().nullable(),
  abono_inicial_fecha: z.string().optional().nullable(),
  abono_inicial_recibido_por: z.string().uuid().optional().nullable(),
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
      const {
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
        transferencia_numero,
        transferencia_banco,
        transferencia_imagen_url,
        abono_inicial_monto,
        abono_inicial_fecha,
        abono_inicial_recibido_por,
        saldo_pendiente,
        referencia_cambio_principal,
      } = req.body;

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
        estado: EstadoTransaccion.PENDIENTE,
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
          estado: EstadoTransaccion.PENDIENTE,
          metodo_entrega,
          transferencia_numero:
            metodo_entrega === "transferencia" ? transferencia_numero : null,
          transferencia_banco:
            metodo_entrega === "transferencia" ? transferencia_banco : null,
          transferencia_imagen_url:
            metodo_entrega === "transferencia"
              ? transferencia_imagen_url
              : null,
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

        // 2) Moneda DESTINO: el punto ENTREGA -> restar
        const saldoDestino = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id,
              moneda_id: moneda_destino_id,
            },
          },
        });
        const saldoDestinoAnterior = Number(saldoDestino?.cantidad ?? 0);
        const egreso = Number(divisas_recibidas_total_final || 0);
        if (saldoDestinoAnterior < egreso) {
          throw new Error(
            "Saldo insuficiente en moneda destino para realizar el cambio"
          );
        }
        const saldoDestinoNuevo = saldoDestinoAnterior - egreso;
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
          },
          create: {
            punto_atencion_id,
            moneda_id: moneda_destino_id,
            cantidad: saldoDestinoNuevo,
            billetes: billetesDestinoNuevo,
            monedas_fisicas: monedasDestinoNuevo,
          },
        });

        await tx.movimientoSaldo.create({
          data: {
            punto_atencion_id,
            moneda_id: moneda_destino_id,
            tipo_movimiento: "CAMBIO_DIVISA",
            monto: -egreso,
            saldo_anterior: saldoDestinoAnterior,
            saldo_nuevo: saldoDestinoNuevo,
            usuario_id: req.user!.id,
            referencia_id: exchange.id,
            tipo_referencia: "CAMBIO_DIVISA",
            descripcion: `Egreso por cambio - Entregado al cliente (${numeroRecibo})`,
          },
        });
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

/** ==============================
 *  DELETE /exchanges/:id
 *  Anula un cambio de divisas (solo ADMIN/SUPER_USUARIO):
 *   - Marca estado = CANCELADO y set deleted_* (soft delete)
 *   - Reversa saldos (origen/destino)
 *   - Inserta MovimientoSaldo de reverso para ambas monedas
 *  Body: { motivo: string }
 *  ============================== */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user || (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO")) {
        res
          .status(403)
          .json({ success: false, error: "Permisos insuficientes" });
        return;
      }

      const { id } = req.params;
      const { motivo } = (req.body || {}) as { motivo?: string };
      if (!motivo || !String(motivo).trim()) {
        res.status(400).json({ success: false, error: "motivo es requerido" });
        return;
      }

      const cambio = await prisma.cambioDivisa.findUnique({ where: { id } });
      if (!cambio) {
        res.status(404).json({ success: false, error: "Cambio no encontrado" });
        return;
      }
      if (
        (cambio as any).deleted_at ||
        cambio.estado === EstadoTransaccion.CANCELADO
      ) {
        res.status(409).json({ success: false, error: "Cambio ya cancelado" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        // 1) Soft delete + estado CANCELADO
        await tx.cambioDivisa.update({
          where: { id },
          data: {
            estado: EstadoTransaccion.CANCELADO,
            deleted_at: new Date(),
            deleted_by: user.id,
            delete_reason: motivo,
          } as any,
        });

        // 2) Reverso de saldos: destino fue EGRESO -> ahora INGRESO; origen fue INGRESO -> ahora EGRESO
        // Destino (se entregó al cliente) => revertir con INGRESO al saldo del punto
        const destinoSaldo = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
        });
        const destinoAnterior = Number(destinoSaldo?.cantidad ?? 0);
        const destinoNuevo = destinoAnterior + Number(cambio.monto_destino);
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
          update: { cantidad: destinoNuevo, updated_at: new Date() },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_destino_id,
            cantidad: destinoNuevo,
            billetes: 0,
            monedas_fisicas: 0,
            updated_at: new Date(),
          },
        });

        // Origen (se recibió del cliente) => revertir con EGRESO desde el saldo del punto
        const origenSaldo = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
        });
        const origenAnterior = Number(origenSaldo?.cantidad ?? 0);
        const origenNuevo = origenAnterior - Number(cambio.monto_origen);
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
          update: { cantidad: origenNuevo, updated_at: new Date() },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            cantidad: origenNuevo,
            billetes: 0,
            monedas_fisicas: 0,
            updated_at: new Date(),
          },
        });

        // 3) Insertar movimientos de reverso (dos filas)
        await tx.movimientoSaldo.createMany({
          data: [
            {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
              tipo_movimiento: "INGRESO",
              monto: Number(cambio.monto_destino),
              saldo_anterior: destinoAnterior,
              saldo_nuevo: destinoNuevo,
              usuario_id: user.id,
              referencia_id: cambio.id,
              tipo_referencia: "REVERSO_CAMBIO",
              descripcion: `Reverso CAMBIO (destino) por anulación (ADMIN: ${user.nombre}) - motivo: ${motivo}`,
              fecha: new Date(),
              created_at: new Date(),
            },
            {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
              tipo_movimiento: "EGRESO",
              monto: Number(cambio.monto_origen),
              saldo_anterior: origenAnterior,
              saldo_nuevo: origenNuevo,
              usuario_id: user.id,
              referencia_id: cambio.id,
              tipo_referencia: "REVERSO_CAMBIO",
              descripcion: `Reverso CAMBIO (origen) por anulación (ADMIN: ${user.nombre}) - motivo: ${motivo}`,
              fecha: new Date(),
              created_at: new Date(),
            },
          ],
        });
      });

      res.json({
        success: true,
        message: "Cambio anulado y saldos revertidos",
      });
    } catch (error) {
      logger.error("Error al anular cambio", { error });
      res
        .status(500)
        .json({ success: false, error: "No se pudo anular el cambio" });
    }
  }
);

export default router;
