import express from "express";
import { PrismaClient, EstadoTransaccion } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

const exchangeSchema = z.object({
  moneda_origen_id: z.string().uuid(),
  moneda_destino_id: z.string().uuid(),
  monto_origen: z.number().positive(),
  monto_destino: z.number().positive(),
  tasa_cambio: z.number().positive(),
  tipo_operacion: z.enum(["COMPRA", "VENTA"]),
  punto_atencion_id: z.string().uuid(),
  datos_cliente: z.object({
    nombre: z.string(),
    apellido: z.string(),
    documento: z.string(),
    cedula: z.string(),
    telefono: z.string().optional(),
  }),
  divisas_entregadas: z.object({
    billetes: z.number().default(0),
    monedas: z.number().default(0),
    total: z.number().default(0),
  }),
  divisas_recibidas: z.object({
    billetes: z.number().default(0),
    monedas: z.number().default(0),
    total: z.number().default(0),
  }),
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
        tasa_cambio,
        tipo_operacion,
        punto_atencion_id,
        datos_cliente,
        divisas_entregadas,
        divisas_recibidas,
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

      const timestamp = new Date().getTime();
      const numeroRecibo = `CAM-${timestamp}`;

      const exchange = await prisma.cambioDivisa.create({
        data: {
          moneda_origen_id,
          moneda_destino_id,
          monto_origen,
          monto_destino,
          tasa_cambio,
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
          cliente: `${datos_cliente.nombre} ${datos_cliente.apellido}`,
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

      await prisma.recibo.create({
        data: {
          numero_recibo: numeroRecibo,
          tipo_operacion: "CAMBIO_DIVISA",
          referencia_id: exchange.id,
          usuario_id: req.user.id,
          punto_atencion_id,
          datos_operacion: {
            ...exchange,
            datos_cliente,
            divisas_entregadas,
            divisas_recibidas,
          },
        },
      });

      const exchangeResponse = {
        ...exchange,
        datos_cliente,
        divisas_entregadas,
        divisas_recibidas,
      };

      logger.info("Cambio de divisa creado exitosamente", {
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

// Endpoint para obtener cambios pendientes
router.get("/pending", authenticateToken, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { pointId } = req.query;
    
    if (!pointId) {
      res.status(400).json({ 
        success: false, 
        error: "Se requiere pointId" 
      });
      return;
    }

    const exchanges = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: pointId as string,
        estado: {
          in: [EstadoTransaccion.PENDIENTE]
        },
        saldo_pendiente: {
          gt: 0
        }
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
});

export default router;
