import express from "express";
import logger from "../utils/logger.js";
import { transferValidationService } from "../services/transferValidationService.js";
import transferCreationService from "../services/transferCreationService.js";
import prisma from "../lib/prisma.js";
import { TipoViaTransferencia } from "@prisma/client";
import {
  registrarMovimientoSaldo,
  TipoMovimiento,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

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

const controller = {
  async createTransfer(
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const {
        origen_id,
        destino_id,
        moneda_id,
        monto,
        tipo_transferencia,
        descripcion,
        detalle_divisas,
        responsable_movilizacion,
        via = "EFECTIVO",
        monto_efectivo,
        monto_banco,
      } = req.body;

      logger.info("=== CREAR TRANSFERENCIA EN SERVIDOR ===", {
        usuarioId: req.user?.id,
        datosRecibidos: { ...req.body },
      });

      // Validaciones de negocio
      const userValidation = await transferValidationService.validateUser(
        req.user?.id
      );
      if (!userValidation.success) {
        res.status(401).json({
          error: userValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const destinationValidation =
        await transferValidationService.validateDestination(destino_id);
      if (!destinationValidation.success) {
        res.status(400).json({
          error: destinationValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const currencyValidation =
        await transferValidationService.validateCurrency(moneda_id);
      if (!currencyValidation.success) {
        res.status(400).json({
          error: currencyValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const originValidation = await transferValidationService.validateOrigin(
        origen_id
      );
      if (!originValidation.success) {
        res.status(400).json({
          error: originValidation.error,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          error: "Usuario no autenticado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Crear transferencia
      const numeroRecibo = transferCreationService.generateReceiptNumber();

      // ✅ NUEVO FLUJO: Transferencias directas sin aprobación del admin
      // Al crear la transferencia:
      // 1. Se descuenta inmediatamente del punto origen
      // 2. El estado cambia a EN_TRANSITO
      // 3. El punto destino la acepta cuando recibe el dinero físico
      
      const estadoInicial = "EN_TRANSITO"; // Cambio de PENDIENTE a EN_TRANSITO

      // Crear la transferencia y descontar del origen en una transacción
      const newTransfer = await prisma.$transaction(async (tx) => {
        // 1. Crear la transferencia
        const transfer = await tx.transferencia.create({
          data: {
            origen_id: origen_id || null,
            destino_id,
            moneda_id,
            monto,
            tipo_transferencia,
            solicitado_por: req.user!.id,
            descripcion: descripcion || null,
            numero_recibo: numeroRecibo,
            estado: estadoInicial,
            fecha: new Date(),
            fecha_envio: new Date(), // 👈 Registrar fecha de envío
            via: via as TipoViaTransferencia,
          },
        });

        // 2. Si hay punto origen, descontar del saldo inmediatamente
        if (origen_id) {
          // Obtener saldo anterior
          const saldoOrigen = await tx.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: origen_id,
                moneda_id,
              },
            },
          });

          const saldoAnteriorOrigen = Number(saldoOrigen?.cantidad || 0);
          const billetesAnterior = Number(saldoOrigen?.billetes || 0);
          const monedasAnterior = Number(saldoOrigen?.monedas_fisicas || 0);

          // Validar saldo suficiente
          if (saldoAnteriorOrigen < Number(monto)) {
            throw new Error(
              `Saldo insuficiente en punto origen. Saldo actual: ${saldoAnteriorOrigen.toFixed(
                2
              )}, requerido: ${Number(monto).toFixed(2)}`
            );
          }

          const saldoNuevoOrigen = saldoAnteriorOrigen - Number(monto);

          // Distribuir el egreso entre billetes y monedas físicas
          const totalFisico = billetesAnterior + monedasAnterior;
          let billetesEgreso = 0;
          let monedasEgreso = 0;

          if (totalFisico > 0) {
            const proporcionBilletes = billetesAnterior / totalFisico;
            billetesEgreso = Math.min(
              billetesAnterior,
              Number(monto) * proporcionBilletes
            );
            monedasEgreso = Number(monto) - billetesEgreso;

            if (monedasEgreso > monedasAnterior) {
              monedasEgreso = monedasAnterior;
              billetesEgreso = Number(monto) - monedasEgreso;
            }
          } else {
            billetesEgreso = Number(monto);
          }

          const billetesNuevoOrigen = Math.max(
            0,
            billetesAnterior - billetesEgreso
          );
          const monedasNuevaOrigen = Math.max(
            0,
            monedasAnterior - monedasEgreso
          );

          // Actualizar saldo del origen
          await tx.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: origen_id,
                moneda_id,
              },
            },
            update: {
              cantidad: saldoNuevoOrigen,
              billetes: billetesNuevoOrigen,
              monedas_fisicas: monedasNuevaOrigen,
              updated_at: new Date(),
            },
            create: {
              punto_atencion_id: origen_id,
              moneda_id,
              cantidad: saldoNuevoOrigen,
              billetes: billetesNuevoOrigen,
              monedas_fisicas: monedasNuevaOrigen,
            },
          });

          // Registrar movimiento de salida usando servicio centralizado
          // Nota: el servicio aplica el signo (salida => monto NEGATIVO en BD)
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: origen_id,
              monedaId: moneda_id,
              tipoMovimiento: TipoMovimiento.TRANSFERENCIA_SALIENTE,
              monto: Number(monto), // ⚠️ pasar monto POSITIVO
              saldoAnterior: saldoAnteriorOrigen,
              saldoNuevo: saldoNuevoOrigen,
              tipoReferencia: TipoReferencia.TRANSFER,
              referenciaId: transfer.id,
              descripcion: "Transferencia enviada a punto destino - En tránsito",
              usuarioId: req.user!.id,
            },
            tx
          );
        }

        return transfer;
      });

      // ⚠️ IMPORTANTE: NO CONTABILIZAR AL CREAR
      // La contabilización se realiza SOLO cuando la transferencia es APROBADA
      // en el endpoint de transfer-approvals.ts
      // Esto evita la duplicación de movimientos de saldo.
      //
      // ANTES: Se contabilizaba aquí al crear (PENDIENTE) y luego al aprobar (APROBADO)
      // AHORA: Solo se contabiliza al aprobar (APROBADO)
      //
      // Si en el futuro se necesita contabilizar al crear (para transferencias sin aprobación),
      // se debe eliminar la contabilización del endpoint de aprobación.

      // ❌ CÓDIGO DESHABILITADO - Causaba duplicación
      // // Contabilizar SALIDA del ORIGEN (si existe origen_id)
      // if (origen_id) {
      //   await transferCreationService.contabilizarSalidaOrigen({
      //     origen_id,
      //     moneda_id,
      //     usuario_id: req.user.id,
      //     transferencia: newTransfer,
      //     numero_recibo: numeroRecibo,
      //     via: via as TipoViaTransferencia,
      //     monto,
      //     monto_efectivo,
      //     monto_banco,
      //   });
      // }
      //
      // // Contabilizar ENTRADA en el DESTINO (efectivo y/o banco)
      // await transferCreationService.contabilizarEntradaDestino({
      //   destino_id,
      //   moneda_id,
      //   usuario_id: req.user.id,
      //   transferencia: newTransfer,
      //   numero_recibo: numeroRecibo,
      //   via: via as TipoViaTransferencia,
      //   monto,
      //   monto_efectivo,
      //   monto_banco,
      // });

      // Recibo
      await transferCreationService.createReceipt({
        numero_recibo: numeroRecibo,
        usuario_id: req.user.id,
        punto_atencion_id: destino_id,
        transferencia: newTransfer,
        detalle_divisas,
        responsable_movilizacion,
        tipo_transferencia,
        monto,
        via: via as TipoViaTransferencia,
        monto_efectivo,
        monto_banco,
      });

      const formattedTransfer = {
        ...newTransfer,
        solicitado_por: req.user.id,
        monto: parseFloat(newTransfer.monto.toString()),
        fecha: newTransfer.fecha.toISOString(),
        fecha_aprobacion: newTransfer.fecha_aprobacion?.toISOString() || null,
        detalle_divisas: detalle_divisas || null,
        responsable_movilizacion: responsable_movilizacion || null,
      };

      logger.info("Transferencia creada (en tránsito)", {
        transferId: newTransfer.id,
        createdBy: req.user.id,
        amount: monto,
        type: tipo_transferencia,
        via,
        numeroRecibo,
        origenId: origen_id,
        destinoId: destino_id,
      });

      res.status(201).json({
        transfer: formattedTransfer,
        success: true,
        message:
          "Transferencia creada exitosamente. Monto deducido del punto de origen. Pendiente de aceptación en punto destino.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear transferencia", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        error: "Error interno del servidor al crear transferencia",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  },

  async getAllTransfers(
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> {
    try {
      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      logger.info("Obteniendo transferencias de la base de datos...");

      const transfers = await prisma.transferencia.findMany({
        include: {
          origen: { select: { id: true, nombre: true } },
          destino: { select: { id: true, nombre: true } },
          moneda: {
            select: { id: true, codigo: true, nombre: true, simbolo: true },
          },
          usuarioSolicitante: {
            select: { id: true, nombre: true, username: true },
          },
          usuarioAprobador: {
            select: { id: true, nombre: true, username: true },
          },
        },
        orderBy: { fecha: "desc" },
      });

      logger.info(`Transferencias encontradas en BD: ${transfers.length}`);

      const formattedTransfers = transfers.map(
        (transfer: (typeof transfers)[0]) => ({
          ...transfer,
          solicitado_por: transfer.solicitado_por
            ? transfer.solicitado_por
            : transfer.usuarioSolicitante?.id ?? "",
          monto: parseFloat(transfer.monto.toString()),
          fecha: transfer.fecha.toISOString(),
          fecha_aprobacion: transfer.fecha_aprobacion?.toISOString() || null,
        })
      );

      res.status(200).json({
        transfers: formattedTransfers,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener transferencias", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener transferencias",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

export default controller;
