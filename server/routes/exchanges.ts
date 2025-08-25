import express from "express";
import { EstadoTransaccion, TipoOperacion } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();

const exchangeSchema = z.object({
  moneda_origen_id: z.string().uuid(),
  moneda_destino_id: z.string().uuid(),
  monto_origen: z.number().positive(),
  monto_destino: z.number().positive(),
  tasa_cambio: z.number().positive(),
  tipo_operacion: z.nativeEnum(TipoOperacion),
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

      console.log("💫 Creating exchange with data:", {
        moneda_origen_id,
        moneda_destino_id,
        monto_origen: Number(monto_origen),
        monto_destino: Number(monto_destino),
        tasa_cambio_billetes: Number(tasa_cambio),
        tasa_cambio_monedas: Number(tasa_cambio),
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
          monto_origen: Number(monto_origen),
          monto_destino: Number(monto_destino),
          tasa_cambio_billetes: Number(tasa_cambio),
          tasa_cambio_monedas: Number(tasa_cambio),
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
          // Campos de divisas entregadas
          divisas_entregadas_billetes: divisas_entregadas?.billetes ?? 0,
          divisas_entregadas_monedas: divisas_entregadas?.monedas ?? 0,
          divisas_entregadas_total: divisas_entregadas?.total ?? 0,
          // Campos de divisas recibidas
          divisas_recibidas_billetes: divisas_recibidas?.billetes ?? 0,
          divisas_recibidas_monedas: divisas_recibidas?.monedas ?? 0,
          divisas_recibidas_total: divisas_recibidas?.total ?? 0,
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

      // Actualizar el cambio a completado y actualizar saldos
      const updatedCambio = await prisma.$transaction(async (tx) => {
        // 1. Actualizar estado del cambio
        const cambioActualizado = await tx.cambioDivisa.update({
          where: { id },
          data: {
            estado: EstadoTransaccion.COMPLETADO,
          },
        });

        // 2. Actualizar saldo de moneda origen (restar)
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
            },
          },
          update: {
            cantidad: {
              decrement: Number(cambio.monto_origen),
            },
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_origen_id,
            cantidad: -Number(cambio.monto_origen),
            billetes: 0,
            monedas_fisicas: 0,
          },
        });

        // 3. Actualizar saldo de moneda destino (sumar)
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
            },
          },
          update: {
            cantidad: {
              increment: Number(cambio.monto_destino),
            },
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: cambio.punto_atencion_id,
            moneda_id: cambio.moneda_destino_id,
            cantidad: Number(cambio.monto_destino),
            billetes: 0,
            monedas_fisicas: 0,
          },
        });

        // 4. Registrar movimientos en historial
        await tx.historialSaldo.createMany({
          data: [
            {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_origen_id,
              usuario_id: req.user!.id,
              cantidad_anterior: 0, // Se calculará después si es necesario
              cantidad_incrementada: -Number(cambio.monto_origen),
              cantidad_nueva: 0, // Se calculará después si es necesario
              tipo_movimiento: "EGRESO",
              descripcion: `Cambio de divisa - Egreso ${cambio.monto_origen}`,
              numero_referencia: cambio.numero_recibo,
            },
            {
              punto_atencion_id: cambio.punto_atencion_id,
              moneda_id: cambio.moneda_destino_id,
              usuario_id: req.user!.id,
              cantidad_anterior: 0, // Se calculará después si es necesario
              cantidad_incrementada: Number(cambio.monto_destino),
              cantidad_nueva: 0, // Se calculará después si es necesario
              tipo_movimiento: "INGRESO",
              descripcion: `Cambio de divisa - Ingreso ${cambio.monto_destino}`,
              numero_referencia: cambio.numero_recibo,
            },
          ],
        });

        return cambioActualizado;
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
          // Removido el filtro de saldo_pendiente > 0 para mostrar TODOS los cambios pendientes
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

      // Buscar en cambios de divisa por nombre completo o cédula
      const exchanges = await prisma.cambioDivisa.findMany({
        where: {
          OR: [
            {
              cliente: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              // Buscar en el JSON datos_cliente si existe
              AND: [
                {
                  NOT: {
                    cliente: null,
                  },
                },
              ],
            },
          ],
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

      // Buscar también en los recibos que contienen datos_cliente
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

      // Procesar y combinar resultados
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

      // Combinar y eliminar duplicados por cédula
      const todosClientes = [...clientesFromExchanges, ...clientesFromRecibos];
      const clientesUnicos = new Map();

      todosClientes.forEach((cliente) => {
        const key = cliente.cedula || `${cliente.nombre}_${cliente.apellido}`;
        if (
          !clientesUnicos.has(key) ||
          new Date(cliente.fecha_ultima_operacion) >
            new Date(clientesUnicos.get(key).fecha_ultima_operacion)
        ) {
          clientesUnicos.set(key, cliente);
        }
      });

      const resultados = Array.from(clientesUnicos.values())
        .filter((cliente) => {
          const nombreCompleto =
            `${cliente.nombre} ${cliente.apellido}`.toLowerCase();
          const cedula = cliente.cedula.toLowerCase();
          return (
            nombreCompleto.includes(searchTerm) || cedula.includes(searchTerm)
          );
        })
        .sort(
          (a, b) =>
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

export default router;
