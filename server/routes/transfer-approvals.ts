import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

// Schema para aprobar/rechazar transferencia
const approvalSchema = z.object({
  observaciones: z.string().optional(),
});

// Obtener transferencias pendientes de aprobación
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "OPERADOR", "CONCESION"]), // <-- Agregamos CONCESION
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const pendingTransfers = await prisma.transferencia.findMany({
        where: {
          estado: "PENDIENTE",
        },
        include: {
          origen: {
            select: {
              id: true,
              nombre: true,
            },
          },
          destino: {
            select: {
              id: true,
              nombre: true,
            },
          },
          moneda: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              simbolo: true,
            },
          },
          usuarioSolicitante: {
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

      const formattedTransfers = pendingTransfers.map((transfer) => ({
        ...transfer,
        monto: parseFloat(transfer.monto.toString()),
        fecha: transfer.fecha.toISOString(),
        fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null,
        fecha_rechazo: transfer.fecha_rechazo?.toISOString() || null,
      }));

      logger.info("Transferencias pendientes obtenidas", {
        count: formattedTransfers.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        transfers: formattedTransfers,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener transferencias pendientes", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener transferencias pendientes",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Aprobar transferencia
router.patch(
  "/:transferId/approve",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Usuario no autenticado", success: false });
        return;
      }
      const userId = req.user.id;
      const { transferId } = req.params;
      const { observaciones } = req.body;

      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.estado !== "PENDIENTE") {
        res.status(400).json({
          error: "La transferencia ya ha sido procesada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Aprobar transferencia y actualizar saldos en una transacción
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        // 1. Actualizar estado de la transferencia
        const transferAprobada = await tx.transferencia.update({
          where: { id: transferId },
          data: {
            estado: "APROBADO",
            aprobado_por: userId,
            fecha_aprobacion: new Date(),
            observaciones_aprobacion: observaciones,
          },
          include: {
            origen: {
              select: {
                id: true,
                nombre: true,
              },
            },
            destino: {
              select: {
                id: true,
                nombre: true,
              },
            },
            moneda: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                simbolo: true,
              },
            },
            usuarioSolicitante: {
              select: {
                id: true,
                nombre: true,
                username: true,
              },
            },
            usuarioAprobador: {
              select: {
                id: true,
                nombre: true,
                username: true,
              },
            },
          },
        });

        // 2. Actualizar saldo del punto origen (restar) - solo si hay punto origen
        if (transfer.origen_id) {
          // Obtener saldo anterior
          const saldoOrigen = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.origen_id,
                moneda_id: transfer.moneda_id,
              },
            },
          });
          const saldoAnteriorOrigen = Number(saldoOrigen?.cantidad || 0);
          const billetesAnterior = Number(saldoOrigen?.billetes || 0);
          const monedasAnterior = Number(saldoOrigen?.monedas_fisicas || 0);

          // 🛡️ VALIDACIÓN CRÍTICA: Verificar saldo suficiente antes de aprobar
          if (saldoAnteriorOrigen < Number(transfer.monto)) {
            throw new Error(
              `Saldo insuficiente en punto origen. Saldo actual: ${saldoAnteriorOrigen.toFixed(
                2
              )} ${transferAprobada.moneda?.codigo || ""}, requerido: ${Number(
                transfer.monto
              ).toFixed(2)}. La transferencia no puede ser aprobada.`
            );
          }

          const saldoNuevoOrigen = saldoAnteriorOrigen - Number(transfer.monto);
          
          // ✅ Distribuir el egreso entre billetes y monedas físicas
          // Intentar mantener la proporción existente
          const totalFisico = billetesAnterior + monedasAnterior;
          let billetesEgreso = 0;
          let monedasEgreso = 0;
          
          if (totalFisico > 0) {
            const proporcionBilletes = billetesAnterior / totalFisico;
            
            billetesEgreso = Math.min(
              billetesAnterior,
              Number(transfer.monto) * proporcionBilletes
            );
            monedasEgreso = Number(transfer.monto) - billetesEgreso;
            
            // Ajustar si no hay suficientes monedas
            if (monedasEgreso > monedasAnterior) {
              monedasEgreso = monedasAnterior;
              billetesEgreso = Number(transfer.monto) - monedasEgreso;
            }
          } else {
            // Si no hay desglose, asumir todo sale de billetes (por defecto)
            billetesEgreso = Number(transfer.monto);
          }

          const billetesNuevoOrigen = Math.max(0, billetesAnterior - billetesEgreso);
          const monedasNuevaOrigen = Math.max(0, monedasAnterior - monedasEgreso);

          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.origen_id,
                moneda_id: transfer.moneda_id,
              },
            },
            update: {
              cantidad: saldoNuevoOrigen,
              billetes: billetesNuevoOrigen,
              monedas_fisicas: monedasNuevaOrigen,
              updated_at: new Date(),
            },
            create: {
              punto_atencion_id: transfer.origen_id,
              moneda_id: transfer.moneda_id,
              cantidad: saldoNuevoOrigen,
              billetes: billetesNuevoOrigen,
              monedas_fisicas: monedasNuevaOrigen,
            },
          });

          // Registrar movimiento de salida en MovimientoSaldo (dentro de la transacción)
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: transfer.origen_id,
              monedaId: transfer.moneda_id,
              tipoMovimiento: TipoMovimiento.EGRESO,
              monto: Number(transfer.monto),
              saldoAnterior: saldoAnteriorOrigen,
              saldoNuevo: saldoNuevoOrigen,
              tipoReferencia: TipoReferencia.TRANSFER,
              referenciaId: transfer.id,
              descripcion: `Transferencia de salida a ${
                transferAprobada.destino?.nombre || "Externa"
              } - ${transfer.monto}`,
              usuarioId: userId,
            },
            tx
          ); // ⚠️ Pasar el cliente de transacción para atomicidad

          // Registrar movimiento de salida en HistorialSaldo (legacy)
          await tx.historialSaldo.create({
            data: {
              punto_atencion_id: transfer.origen_id,
              moneda_id: transfer.moneda_id,
              usuario_id: userId,
              cantidad_anterior: saldoAnteriorOrigen,
              cantidad_incrementada: -Number(transfer.monto),
              cantidad_nueva: saldoNuevoOrigen,
              tipo_movimiento: "EGRESO",
              descripcion: `Transferencia de salida a ${
                transferAprobada.destino?.nombre || "Externa"
              } - ${transfer.monto}`,
              numero_referencia: transfer.numero_recibo || transfer.id,
            },
          });

          // 3. Actualizar saldo del punto destino (sumar) - aprovechando la proporción del origen
          // Obtener saldo anterior
          const saldoDestino = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
              },
            },
          });
          const saldoAnteriorDestino = Number(saldoDestino?.cantidad || 0);
          const billetesAnteriorDestino = Number(saldoDestino?.billetes || 0);
          const monedasAnteriorDestino = Number(saldoDestino?.monedas_fisicas || 0);
          const saldoNuevoDestino = saldoAnteriorDestino + Number(transfer.monto);
          
          // ✅ Para ingreso, mantener la proporción del origen si es posible
          let billetesIngresoDestino = 0;
          let monedasIngresoDestino = 0;
          
          const totalFisicoOrigen = billetesAnterior + monedasAnterior;
          if (totalFisicoOrigen > 0) {
            const proporcionBilletes = billetesAnterior / totalFisicoOrigen;
            const proporcionMonedas = monedasAnterior / totalFisicoOrigen;
            
            billetesIngresoDestino = Number(transfer.monto) * proporcionBilletes;
            monedasIngresoDestino = Number(transfer.monto) * proporcionMonedas;
          } else {
            // Si origen no tenía desglose, distribuir 50/50
            billetesIngresoDestino = Number(transfer.monto) / 2;
            monedasIngresoDestino = Number(transfer.monto) / 2;
          }
          
          const billetesNuevoDestino = billetesAnteriorDestino + billetesIngresoDestino;
          const monedasNuevaDestino = monedasAnteriorDestino + monedasIngresoDestino;

          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
              },
            },
            update: {
              cantidad: saldoNuevoDestino,
              billetes: billetesNuevoDestino,
              monedas_fisicas: monedasNuevaDestino,
              updated_at: new Date(),
            },
            create: {
              punto_atencion_id: transfer.destino_id,
              moneda_id: transfer.moneda_id,
              cantidad: saldoNuevoDestino,
              billetes: billetesNuevoDestino,
              monedas_fisicas: monedasNuevaDestino,
            },
          });

          // Registrar movimiento de entrada en MovimientoSaldo (dentro de la transacción)
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: transfer.destino_id,
              monedaId: transfer.moneda_id,
              tipoMovimiento: TipoMovimiento.INGRESO,
              monto: Number(transfer.monto),
              saldoAnterior: saldoAnteriorDestino,
              saldoNuevo: saldoNuevoDestino,
              tipoReferencia: TipoReferencia.TRANSFER,
              referenciaId: transfer.id,
              descripcion: `Transferencia de entrada desde ${
                transferAprobada.origen?.nombre || "Externa"
              } - ${transfer.monto}`,
              usuarioId: userId,
            },
            tx
          ); // ⚠️ Pasar el cliente de transacción para atomicidad

          // Registrar movimiento de entrada en HistorialSaldo (legacy)
          await tx.historialSaldo.create({
            data: {
              punto_atencion_id: transfer.destino_id,
              moneda_id: transfer.moneda_id,
              usuario_id: userId,
              cantidad_anterior: saldoAnteriorDestino,
              cantidad_incrementada: Number(transfer.monto),
              cantidad_nueva: saldoNuevoDestino,
              tipo_movimiento: "INGRESO",
              descripcion: `Transferencia de entrada desde ${
                transferAprobada.origen?.nombre || "Externa"
              } - ${transfer.monto}`,
              numero_referencia: transfer.numero_recibo || transfer.id,
            },
          });
        } else {
          // Si NO hay origen, solo actualizar destino (sin cambios en billetes/monedas)
          const saldoDestino = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
              },
            },
          });
          const saldoAnteriorDestino = Number(saldoDestino?.cantidad || 0);
          const billetesAnteriorDestino = Number(saldoDestino?.billetes || 0);
          const monedasAnteriorDestino = Number(saldoDestino?.monedas_fisicas || 0);
          const saldoNuevoDestino = saldoAnteriorDestino + Number(transfer.monto);
          
          // Distribuir 50/50 si no hay origen
          const billetesIngresoDestino = Number(transfer.monto) / 2;
          const monedasIngresoDestino = Number(transfer.monto) / 2;
          
          const billetesNuevoDestino = billetesAnteriorDestino + billetesIngresoDestino;
          const monedasNuevaDestino = monedasAnteriorDestino + monedasIngresoDestino;

          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
              },
            },
            update: {
              cantidad: saldoNuevoDestino,
              billetes: billetesNuevoDestino,
              monedas_fisicas: monedasNuevaDestino,
              updated_at: new Date(),
            },
            create: {
              punto_atencion_id: transfer.destino_id,
              moneda_id: transfer.moneda_id,
              cantidad: saldoNuevoDestino,
              billetes: billetesNuevoDestino,
              monedas_fisicas: monedasNuevaDestino,
            },
          });

          // Registrar movimiento de entrada en MovimientoSaldo (dentro de la transacción)
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: transfer.destino_id,
              monedaId: transfer.moneda_id,
              tipoMovimiento: TipoMovimiento.INGRESO,
              monto: Number(transfer.monto),
              saldoAnterior: saldoAnteriorDestino,
              saldoNuevo: saldoNuevoDestino,
              tipoReferencia: TipoReferencia.TRANSFER,
              referenciaId: transfer.id,
              descripcion: `Transferencia de entrada desde ${
                transferAprobada.origen?.nombre || "Externa"
              } - ${transfer.monto}`,
              usuarioId: userId,
            },
            tx
          ); // ⚠️ Pasar el cliente de transacción para atomicidad

          // Registrar movimiento de entrada en HistorialSaldo (legacy)
          await tx.historialSaldo.create({
            data: {
              punto_atencion_id: transfer.destino_id,
              moneda_id: transfer.moneda_id,
              usuario_id: userId,
              cantidad_anterior: saldoAnteriorDestino,
              cantidad_incrementada: Number(transfer.monto),
              cantidad_nueva: saldoNuevoDestino,
              tipo_movimiento: "INGRESO",
              descripcion: `Transferencia de entrada desde ${
                transferAprobada.origen?.nombre || "Externa"
              } - ${transfer.monto}`,
              numero_referencia: transfer.numero_recibo || transfer.id,
            },
          });
        }

        return transferAprobada;
      });

      logger.info("Transferencia aprobada", {
        transferId,
        approvedBy: userId,
        amount: transfer.monto.toString(),
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al aprobar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al aprobar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Rechazar transferencia
router.patch(
  "/:transferId/reject",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { transferId } = req.params;
      const { observaciones } = req.body;

      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.estado !== "PENDIENTE") {
        res.status(400).json({
          error: "La transferencia ya ha sido procesada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedTransfer = await prisma.transferencia.update({
        where: { id: transferId },
        data: {
          estado: "RECHAZADO",
          rechazado_por: req.user?.id,
          fecha_rechazo: new Date(),
          observaciones_aprobacion: observaciones,
        },
        include: {
          origen: {
            select: {
              id: true,
              nombre: true,
            },
          },
          destino: {
            select: {
              id: true,
              nombre: true,
            },
          },
          moneda: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              simbolo: true,
            },
          },
          usuarioSolicitante: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          usuarioRechazador: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
      });

      logger.info("Transferencia rechazada", {
        transferId,
        rejectedBy: req.user?.id,
        amount: transfer.monto.toString(),
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
        },
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al rechazar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al rechazar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Endpoint para que el punto DESTINO acepte la transferencia
// Cuando se acepta, se agrega el monto al saldo del destino y se marca como COMPLETADO
router.post(
  "/:id/accept",
  authenticateToken,
  requireRole(["OPERADOR", "CONCESION", "ADMIN", "SUPER_USUARIO"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const transferId = req.params.id;
      const { observaciones } = req.body;

      if (!req.user) {
        res
          .status(401)
          .json({ error: "Usuario no autenticado", success: false });
        return;
      }

      const userId = req.user.id;

      // Obtener la transferencia
      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
        include: {
          origen: true,
          destino: true,
          moneda: true,
        },
      });

      if (!transfer) {
        logger.warn("Transferencia no encontrada para aceptar", {
          transferId,
          requestedBy: userId,
        });
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validar que el usuario pertenece al punto destino (a menos que sea admin/super)
      if (
        req.user.rol !== "ADMIN" &&
        req.user.rol !== "SUPER_USUARIO" &&
        req.user.punto_atencion_id !== transfer.destino_id
      ) {
        logger.warn("Usuario no autorizado para aceptar esta transferencia", {
          transferId,
          userId: userId,
          userPuntoId: req.user.punto_atencion_id,
          destinoId: transfer.destino_id,
        });
        res.status(403).json({
          error: "No tienes permiso para aceptar esta transferencia",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validar que la transferencia está EN_TRANSITO
      if (transfer.estado !== "EN_TRANSITO") {
        logger.warn("Intento de aceptar transferencia que no está en tránsito", {
          transferId,
          estadoActual: transfer.estado,
          requestedBy: userId,
        });
        res.status(400).json({
          error: `La transferencia no está en tránsito (estado actual: ${transfer.estado})`,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Realizar la aceptación en una transacción
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        const monto = Number(transfer.monto);
        const monedaId = transfer.moneda_id;
        const destinoId = transfer.destino_id;

        // 1. Actualizar el estado de la transferencia
        const updated = await tx.transferencia.update({
          where: { id: transferId },
          data: {
            estado: "COMPLETADO",
            aceptado_por: userId,
            fecha_aceptacion: new Date(),
            observaciones_aceptacion: observaciones,
          },
          include: {
            origen: true,
            destino: true,
            moneda: true,
            usuarioSolicitante: true,
          },
        });

        // 2. Obtener o crear el saldo del punto destino
        const saldoDestino = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: destinoId,
              moneda_id: monedaId,
            },
          },
        });

        const saldoAnterior = saldoDestino ? Number(saldoDestino.cantidad) : 0;
        const billetesAnterior = saldoDestino ? Number(saldoDestino.billetes) : 0;
        const monedasAnterior = saldoDestino
          ? Number(saldoDestino.monedas_fisicas)
          : 0;

        // 3. Calcular el ingreso según la vía de transferencia
        let billetesIngreso = 0;
        const monedasIngreso = 0;

        // Para transferencias EFECTIVO, todo va a billetes
        // Para BANCO y MIXTO, asumimos que todo es efectivo por ahora
        // TODO: Agregar campos monto_efectivo y monto_banco al schema si se necesita mayor detalle
        if (transfer.via === "EFECTIVO" || transfer.via === "MIXTO") {
          billetesIngreso = monto;
        }
        // Para BANCO, no se afectan billetes/monedas físicas
        // El monto se registra solo en cantidad total

        const saldoNuevoDestino = saldoAnterior + monto;
        const billetesNuevoDestino = billetesAnterior + billetesIngreso;
        const monedasNuevaDestino = monedasAnterior + monedasIngreso;

        // 4. Actualizar el saldo del destino
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: destinoId,
              moneda_id: monedaId,
            },
          },
          update: {
            cantidad: saldoNuevoDestino,
            billetes: billetesNuevoDestino,
            monedas_fisicas: monedasNuevaDestino,
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: destinoId,
            moneda_id: monedaId,
            cantidad: saldoNuevoDestino,
            billetes: billetesNuevoDestino,
            monedas_fisicas: monedasNuevaDestino,
          },
        });

        // 5. Registrar movimiento de entrada (ledger)
        await registrarMovimientoSaldo(
          {
            puntoAtencionId: destinoId,
            monedaId: monedaId,
            tipoMovimiento: TipoMovimiento.TRANSFERENCIA_ENTRANTE,
            monto: monto,
            saldoAnterior: saldoAnterior,
            saldoNuevo: saldoNuevoDestino,
            tipoReferencia: TipoReferencia.TRANSFER,
            referenciaId: String(transferId),
            saldoBucket: "NINGUNO",
            descripcion: `Transferencia aceptada desde punto origen`,
            usuarioId: userId,
          },
          tx
        );

        return updated;
      });

      logger.info("Transferencia aceptada exitosamente", {
        transferId,
        acceptedBy: userId,
        amount: transfer.monto.toString(),
        destinoId: transfer.destino_id,
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
          fecha_aceptacion:
            updatedTransfer.fecha_aceptacion?.toISOString() || null,
        },
        success: true,
        message: "Transferencia aceptada. Monto agregado al saldo del punto destino.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al aceptar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
        transferId: req.params.id,
      });

      res.status(500).json({
        error: "Error al aceptar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Rechazar/Anular transferencia EN_TRANSITO (por el punto destino)
router.post(
  "/:id/reject",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "OPERADOR", "CONCESION"]),
  validate(approvalSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const transferId = req.params.id;
      const { observaciones } = req.body;

      if (!req.user) {
        res.status(401).json({ error: "Usuario no autenticado", success: false });
        return;
      }

      const userId = req.user.id;

      const transfer = await prisma.transferencia.findUnique({
        where: { id: transferId },
        include: {
          origen: true,
          destino: true,
          moneda: true,
        },
      });

      if (!transfer) {
        logger.warn("Transferencia no encontrada para rechazar", {
          transferId,
          requestedBy: userId,
        });
        res.status(404).json({
          error: "Transferencia no encontrada",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validar que el usuario pertenece al punto destino (a menos que sea admin/super)
      if (
        req.user.rol !== "ADMIN" &&
        req.user.rol !== "SUPER_USUARIO" &&
        req.user.punto_atencion_id !== transfer.destino_id
      ) {
        logger.warn("Usuario no autorizado para rechazar esta transferencia", {
          transferId,
          userId: userId,
          userPuntoId: req.user.punto_atencion_id,
          destinoId: transfer.destino_id,
        });
        res.status(403).json({
          error: "No tienes permiso para rechazar esta transferencia",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validar que la transferencia está EN_TRANSITO
      if (transfer.estado !== "EN_TRANSITO") {
        logger.warn("Intento de rechazar transferencia que no está en tránsito", {
          transferId,
          estadoActual: transfer.estado,
          requestedBy: userId,
        });
        res.status(400).json({
          error: `La transferencia no puede ser rechazada (estado actual: ${transfer.estado})`,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Realizar el rechazo en una transacción: devolver el dinero al origen y marcar como CANCELADO
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        const monto = Number(transfer.monto);
        const monedaId = transfer.moneda_id;
        const origenId = transfer.origen_id;

        if (!origenId) {
          throw new Error(
            "Transferencia sin punto origen; no se puede devolver el saldo."
          );
        }

        // 1. Actualizar el estado de la transferencia a CANCELADO
        const updated = await tx.transferencia.update({
          where: { id: transferId },
          data: {
            estado: "CANCELADO",
            fecha_rechazo: new Date(),
            observaciones_rechazo: observaciones || "Rechazada por el punto destino",
          },
          include: {
            origen: true,
            destino: true,
            moneda: true,
            usuarioSolicitante: true,
          },
        });

        // 2. Obtener el saldo actual del punto origen
        const saldoOrigen = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: origenId,
              moneda_id: monedaId,
            },
          },
        });

        if (!saldoOrigen) {
          throw new Error(
            "No se encontró el saldo del punto origen. Esto no debería ocurrir."
          );
        }

        const saldoAnteriorOrigen = Number(saldoOrigen.cantidad);
        const billetesAnteriorOrigen = Number(saldoOrigen.billetes);
        const monedasAnteriorOrigen = Number(saldoOrigen.monedas_fisicas);

        // 3. Devolver el dinero al punto origen
        let billetesDevolucion = 0;
        const monedasDevolucion = 0;

        // Para transferencias EFECTIVO, devolvemos a billetes
        if (transfer.via === "EFECTIVO" || transfer.via === "MIXTO") {
          billetesDevolucion = monto;
        }

        const saldoNuevoOrigen = saldoAnteriorOrigen + monto;
        const billetesNuevoOrigen = billetesAnteriorOrigen + billetesDevolucion;
        const monedasNuevaOrigen = monedasAnteriorOrigen + monedasDevolucion;

        // 4. Actualizar el saldo del origen (devolver el dinero)
        await tx.saldo.update({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: origenId,
              moneda_id: monedaId,
            },
          },
          data: {
            cantidad: saldoNuevoOrigen,
            billetes: billetesNuevoOrigen,
            monedas_fisicas: monedasNuevaOrigen,
            updated_at: new Date(),
          },
        });

        // 5. Registrar movimiento de devolución (ledger)
        await registrarMovimientoSaldo(
          {
            puntoAtencionId: origenId,
            monedaId: monedaId,
            tipoMovimiento: TipoMovimiento.TRANSFERENCIA_DEVOLUCION,
            monto: monto,
            saldoAnterior: saldoAnteriorOrigen,
            saldoNuevo: saldoNuevoOrigen,
            tipoReferencia: TipoReferencia.TRANSFER,
            referenciaId: String(transferId),
            saldoBucket: "NINGUNO",
            descripcion: `Devolución por transferencia rechazada - ${
              observaciones || "Sin observaciones"
            }`,
            usuarioId: userId,
          },
          tx
        );

        return updated;
      });

      logger.info("Transferencia rechazada exitosamente", {
        transferId,
        rejectedBy: userId,
        amount: transfer.monto.toString(),
        origenId: transfer.origen_id,
        observaciones,
      });

      res.status(200).json({
        transfer: {
          ...updatedTransfer,
          monto: parseFloat(updatedTransfer.monto.toString()),
          fecha: updatedTransfer.fecha.toISOString(),
          fecha_aprobacion:
            updatedTransfer.fecha_aprobacion?.toISOString() || null,
          fecha_rechazo: updatedTransfer.fecha_rechazo?.toISOString() || null,
          fecha_aceptacion:
            updatedTransfer.fecha_aceptacion?.toISOString() || null,
        },
        success: true,
        message: "Transferencia rechazada. Monto devuelto al punto origen.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al rechazar transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
        transferId: req.params.id,
      });

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Error al rechazar transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
