
import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

// Schema para crear cambio de divisa
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
});

interface ExchangeWhereClause {
  punto_atencion_id?: string;
  usuario_id?: string;
}

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    rol: string;
  };
}

// Crear cambio de divisa
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
      } = req.body;

      // Verificar que el usuario esté autenticado
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
      });

      // Verificar que el punto de atención existe
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

      // Verificar que las monedas existen
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

      // Generar número de recibo único
      const timestamp = new Date().getTime();
      const numeroRecibo = `CAM-${timestamp}`;

      // Crear el cambio de divisa
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
          estado: "COMPLETADO",
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

      // Crear el recibo
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

      // Preparar respuesta con datos del cliente incluidos
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

// Obtener cambios de divisa
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

      // Filtrar por punto de atención si se proporciona
      if (req.query.point_id) {
        whereClause.punto_atencion_id = req.query.point_id as string;
      }

      // Los operadores solo pueden ver sus propios cambios
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
        take: 50, // Limitar a los últimos 50 cambios
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

export default router;
