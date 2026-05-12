import {
  Prisma,
  TipoMovimiento,
  TipoTransferencia,
  Transferencia,
  TipoViaTransferencia,
} from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import {
  registrarMovimientoSaldo,
  TipoMovimiento as TipoMov,
  TipoReferencia,
} from "./movimientoSaldoService.js";

export interface TransferData {
  origen_id?: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: TipoTransferencia;
  solicitado_por: string;
  descripcion?: string | null;
  numero_recibo: string;
  estado: "PENDIENTE";
  fecha: Date;
  via?: TipoViaTransferencia | null;
}

type DetalleDivisas = {
  billetes?: number;
  monedas?: number;
};

async function getSaldo(
  pointId: string,
  monedaId: string
): Promise<{
  id: string | null;
  cantidad: number;
  bancos: number;
  billetes: number;
  monedas_fisicas: number;
}> {
  const s = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: pointId,
        moneda_id: monedaId,
      },
    },
    select: { id: true, cantidad: true, bancos: true, billetes: true, monedas_fisicas: true },
  });
  return {
    id: s?.id ?? null,
    cantidad: Number(s?.cantidad ?? 0),
    bancos: Number(s?.bancos ?? 0),
    billetes: Number(s?.billetes ?? 0),
    monedas_fisicas: Number(s?.monedas_fisicas ?? 0),
  };
}

async function _upsertSaldoEfectivo(
  pointId: string,
  monedaId: string,
  nuevoEfectivo: number,
  _usuarioId?: string
) {
  const { id } = await getSaldo(pointId, monedaId);
  if (id) {
    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: pointId,
          moneda_id: monedaId,
        },
      },
      data: { cantidad: nuevoEfectivo },
    });
  } else {
    await prisma.saldo.create({
      data: {
        punto_atencion_id: pointId,
        moneda_id: monedaId,
        cantidad: nuevoEfectivo,
        billetes: 0,
        monedas_fisicas: 0,
        bancos: 0,
      },
    });
  }

  // 🔄 AUTO-RECONCILIACIÓN DESHABILITADA
  // NOTA: La auto-reconciliación causaba doble actualización de saldos porque se ejecutaba
  // inmediatamente después de registrar el movimiento, causando que el saldo se actualizara dos veces.
  // La reconciliación debe ejecutarse manualmente cuando sea necesario usando el endpoint dedicado.
  //
  // Para reconciliar saldos manualmente, usar: POST /api/saldo-reconciliation/reconciliar
  //
  // try {
  //   const reconciliationResult =
  //     await saldoReconciliationService.reconciliarSaldo(
  //       pointId,
  //       monedaId,
  //       usuarioId
  //     );
  //
  //   if (reconciliationResult.corregido) {
  //     logger.warn(
  //       "🔧 Saldo corregido automáticamente después de actualización",
  //       {
  //         pointId,
  //         monedaId,
  //         saldoAnterior: reconciliationResult.saldoAnterior,
  //         saldoCalculado: reconciliationResult.saldoCalculado,
  //         diferencia: reconciliationResult.diferencia,
  //         usuarioId,
  //       }
  //     );
  //   }
  // } catch (reconciliationError) {
  //   logger.error("Error en auto-reconciliación de saldo efectivo", {
  //     error:
  //       reconciliationError instanceof Error
  //         ? reconciliationError.message
  //         : "Unknown error",
  //     pointId,
  //     monedaId,
  //     usuarioId,
  //   });
  //   // No lanzamos el error para no interrumpir la operación principal
  // }
}

async function upsertSaldoBanco(
  pointId: string,
  monedaId: string,
  nuevoBanco: number,
  _usuarioId?: string
) {
  const { id } = await getSaldo(pointId, monedaId);
  if (id) {
    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: pointId,
          moneda_id: monedaId,
        },
      },
      data: { bancos: nuevoBanco },
    });
  } else {
    await prisma.saldo.create({
      data: {
        punto_atencion_id: pointId,
        moneda_id: monedaId,
        cantidad: 0,
        billetes: 0,
        monedas_fisicas: 0,
        bancos: nuevoBanco,
      },
    });
  }

  // 🔄 AUTO-RECONCILIACIÓN DESHABILITADA
  // NOTA: La auto-reconciliación causaba doble actualización de saldos porque se ejecutaba
  // inmediatamente después de registrar el movimiento, causando que el saldo se actualizara dos veces.
  // La reconciliación debe ejecutarse manualmente cuando sea necesario usando el endpoint dedicado.
  //
  // Para reconciliar saldos manualmente, usar: POST /api/saldo-reconciliation/reconciliar
  //
  // try {
  //   const reconciliationResult =
  //     await saldoReconciliationService.reconciliarSaldo(
  //       pointId,
  //       monedaId,
  //       usuarioId
  //     );
  //
  //   if (reconciliationResult.corregido) {
  //     logger.warn(
  //       "🔧 Saldo corregido automáticamente después de actualización de banco",
  //       {
  //         pointId,
  //         monedaId,
  //         saldoAnterior: reconciliationResult.saldoAnterior,
  //         saldoCalculado: reconciliationResult.saldoCalculado,
  //         diferencia: reconciliationResult.diferencia,
  //         usuarioId,
  //       }
  //     );
  //   }
  // } catch (reconciliationError) {
  //   logger.error("Error en auto-reconciliación de saldo banco", {
  //     error:
  //       reconciliationError instanceof Error
  //         ? reconciliationError.message
  //         : "Unknown error",
  //     pointId,
  //     monedaId,
  //     usuarioId,
  //   });
  //   // No lanzamos el error para no interrumpir la operación principal
  // }
}

async function logMovimientoSaldo(
  args: {
    punto_atencion_id: string;
    moneda_id: string;
    tipo_movimiento: "INGRESO" | "EGRESO" | "AJUSTE";
    monto: number;
    saldo_anterior: number;
    saldo_nuevo: number;
    usuario_id: string;
    referencia_id: string;
    tipo_referencia: "TRANSFERENCIA";
    descripcion?: string;
    saldo_bucket?: "CAJA" | "BANCOS" | "NINGUNO";
  },
  tx?: Prisma.TransactionClient
) {
  // Usar servicio centralizado
  const tipoMov =
    args.tipo_movimiento === "INGRESO"
      ? TipoMov.INGRESO
      : args.tipo_movimiento === "EGRESO"
      ? TipoMov.EGRESO
      : TipoMov.AJUSTE;

  // El monto ya viene con el signo correcto desde las llamadas
  // pero el servicio espera monto positivo, así que tomamos el valor absoluto
  const montoAbsoluto = Math.abs(args.monto);
  const bucketInferido: "CAJA" | "BANCOS" = (args.descripcion || "")
    .toLowerCase()
    .includes("banco")
    ? "BANCOS"
    : "CAJA";

  await registrarMovimientoSaldo(
    {
      puntoAtencionId: args.punto_atencion_id,
      monedaId: args.moneda_id,
      tipoMovimiento: tipoMov,
      monto: montoAbsoluto, // ⚠️ Pasar monto POSITIVO, el servicio aplica el signo
      saldoAnterior: args.saldo_anterior,
      saldoNuevo: args.saldo_nuevo,
      tipoReferencia: TipoReferencia.TRANSFER,
      referenciaId: args.referencia_id,
      descripcion: args.descripcion || undefined,
      saldoBucket: args.saldo_bucket ?? bucketInferido,
      usuarioId: args.usuario_id,
    },
    tx
  ); // ⚠️ Pasar el cliente de transacción para atomicidad (si se proporciona)
}

export const transferCreationService = {
  generateReceiptNumber(): string {
    return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  },

  async createTransfer(transferData: TransferData) {
    logger.info("Creando transferencia con datos:", { ...transferData });

    const newTransfer = await prisma.transferencia.create({
      data: transferData,
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
    });

    logger.info("Transferencia creada en BD:", { id: newTransfer.id });
    return newTransfer;
  },

  async contabilizarEntradaDestino(args: {
    destino_id: string;
    moneda_id: string;
    usuario_id: string;
    transferencia: Transferencia;
    numero_recibo: string;
    via: TipoViaTransferencia;
    monto: number;
    monto_efectivo?: number;
    monto_banco?: number;
    detalle_divisas?: DetalleDivisas | null;
  }) {
    const {
      destino_id,
      moneda_id,
      usuario_id,
      transferencia,
      numero_recibo,
      via,
    } = args;
    let efectivo = 0;
    let banco = 0;

    if (via === "EFECTIVO") {
      efectivo = args.monto;
    } else if (via === "BANCO") {
      banco = args.monto;
    } else {
      // MIXTO
      const me = Number(args.monto_efectivo ?? NaN);
      const mb = Number(args.monto_banco ?? NaN);
      if (
        Number.isFinite(me) &&
        Number.isFinite(mb) &&
        me >= 0 &&
        mb >= 0 &&
        +(me + mb).toFixed(2) <= +args.monto.toFixed(2)
      ) {
        efectivo = +me.toFixed(2);
        banco = +mb.toFixed(2);
      } else {
        // Split 50/50 si no viene desglose válido
        const half = Math.round((args.monto / 2) * 100) / 100;
        efectivo = half;
        banco = +(+args.monto - half).toFixed(2);
      }
    }

    // === EFECTIVO (afecta cuadre)
    if (efectivo > 0) {
      // Obtener desglose físico si está disponible
      let billetes = 0;
      let monedas = 0;
      if (args.detalle_divisas) {
        billetes = Number(args.detalle_divisas.billetes ?? 0);
        monedas = Number(args.detalle_divisas.monedas ?? 0);
        // Si el total no cuadra, ajustar todo a billetes
        if ((billetes + monedas).toFixed(2) !== efectivo.toFixed(2)) {
          billetes = efectivo;
          monedas = 0;
        }
      } else {
        billetes = efectivo;
        monedas = 0;
      }

      // Leer saldo actual
      const saldoActual = await getSaldo(destino_id, moneda_id);
      const antEf = saldoActual.cantidad || 0;
      const antBil = saldoActual.billetes || 0;
      const antMon = saldoActual.monedas_fisicas || 0;
      const nuevoEf = +(antEf + efectivo).toFixed(2);
      const nuevoBil = +(Number(antBil) + billetes).toFixed(2);
      const nuevoMon = +(Number(antMon) + monedas).toFixed(2);

      // Actualizar saldo con desglose
      await prisma.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: destino_id,
            moneda_id: moneda_id,
          },
        },
        data: {
          cantidad: nuevoEf,
          billetes: nuevoBil,
          monedas_fisicas: nuevoMon,
        },
      });

      await logMovimientoSaldo({
        punto_atencion_id: destino_id,
        moneda_id,
        tipo_movimiento: "INGRESO",
        monto: efectivo,
        saldo_anterior: antEf,
        saldo_nuevo: nuevoEf,
        usuario_id,
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Transferencia (EFECTIVO) ${numero_recibo}`,
      });
    }

    // === BANCO (solo control)
    if (banco > 0) {
      const { bancos: antBk } = await getSaldo(destino_id, moneda_id);
      const nuevoBk = +(antBk + banco).toFixed(2);
      await upsertSaldoBanco(destino_id, moneda_id, nuevoBk, usuario_id);

      await logMovimientoSaldo({
        punto_atencion_id: destino_id,
        moneda_id,
        tipo_movimiento: "INGRESO",
        monto: banco,
        saldo_anterior: antBk,
        saldo_nuevo: nuevoBk,
        usuario_id,
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Transferencia (bancos) ${numero_recibo}`,
        saldo_bucket: "BANCOS",
      });
    }

  },

  async contabilizarSalidaOrigen(args: {
    origen_id: string;
    moneda_id: string;
    usuario_id: string;
    transferencia: Transferencia;
    numero_recibo: string;
    via: TipoViaTransferencia;
    monto: number;
    monto_efectivo?: number;
    monto_banco?: number;
    detalle_divisas?: DetalleDivisas | null;
  }) {
    const {
      origen_id,
      moneda_id,
      usuario_id,
      transferencia,
      numero_recibo,
      via,
    } = args;
    let efectivo = 0;
    let banco = 0;

    if (via === "EFECTIVO") {
      efectivo = args.monto;
    } else if (via === "BANCO") {
      banco = args.monto;
    } else {
      // MIXTO
      const me = Number(args.monto_efectivo ?? NaN);
      const mb = Number(args.monto_banco ?? NaN);
      if (
        Number.isFinite(me) &&
        Number.isFinite(mb) &&
        me >= 0 &&
        mb >= 0 &&
        +(me + mb).toFixed(2) <= +args.monto.toFixed(2)
      ) {
        efectivo = +me.toFixed(2);
        banco = +mb.toFixed(2);
      } else {
        // Split 50/50 si no viene desglose válido
        const half = Math.round((args.monto / 2) * 100) / 100;
        efectivo = half;
        banco = +(+args.monto - half).toFixed(2);
      }
    }

    // === EFECTIVO (afecta cuadre) - RESTAR del origen
    if (efectivo > 0) {
      // Obtener desglose físico si está disponible
      let billetes = 0;
      let monedas = 0;
      if (args.detalle_divisas) {
        billetes = Number(args.detalle_divisas.billetes ?? 0);
        monedas = Number(args.detalle_divisas.monedas ?? 0);
        // Si el total no cuadra, ajustar todo a billetes
        if ((billetes + monedas).toFixed(2) !== efectivo.toFixed(2)) {
          billetes = efectivo;
          monedas = 0;
        }
      } else {
        billetes = efectivo;
        monedas = 0;
      }

      // Leer saldo actual
      const saldoActual = await getSaldo(origen_id, moneda_id);
      const antEf = saldoActual.cantidad || 0;
      const antBil = saldoActual.billetes || 0;
      const antMon = saldoActual.monedas_fisicas || 0;
      const nuevoEf = +(antEf - efectivo).toFixed(2);
      const nuevoBil = +(Number(antBil) - billetes).toFixed(2);
      const nuevoMon = +(Number(antMon) - monedas).toFixed(2);

      // Actualizar saldo con desglose
      await prisma.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: origen_id,
            moneda_id: moneda_id,
          },
        },
        data: {
          cantidad: nuevoEf,
          billetes: nuevoBil,
          monedas_fisicas: nuevoMon,
        },
      });

      await logMovimientoSaldo({
        punto_atencion_id: origen_id,
        moneda_id,
        tipo_movimiento: "EGRESO",
        monto: efectivo, // ✅ Positivo - el servicio aplica el signo
        saldo_anterior: antEf,
        saldo_nuevo: nuevoEf,
        usuario_id,
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Transferencia (EFECTIVO) ${numero_recibo} - Salida`,
      });
    }

    // === BANCO (solo control) - RESTAR del origen
    if (banco > 0) {
      const { bancos: antBk } = await getSaldo(origen_id, moneda_id);
      const nuevoBk = +(antBk - banco).toFixed(2);
      await upsertSaldoBanco(origen_id, moneda_id, nuevoBk, usuario_id);

      await logMovimientoSaldo({
        punto_atencion_id: origen_id,
        moneda_id,
        tipo_movimiento: "EGRESO",
        monto: banco, // ✅ Positivo - el servicio aplica el signo
        saldo_anterior: antBk,
        saldo_nuevo: nuevoBk,
        usuario_id,
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `Transferencia (bancos) ${numero_recibo} - Salida`,
        saldo_bucket: "BANCOS",
      });
    }

    // NOTA: Eliminado registro en modelo Movimiento (zombie/legacy).
    // Los movimientos detallados de efectivo y bancos ya se registran en MovimientoSaldo
    // via logMovimientoSaldo arriba. El modelo Movimiento está en desuso.
  },

  async createReceipt(data: {
    numero_recibo: string;
    usuario_id: string;
    punto_atencion_id: string;
    transferencia: Transferencia;
    detalle_divisas?: object;
    responsable_movilizacion?: object;
    tipo_transferencia: TipoTransferencia;
    monto: number;
    via: TipoViaTransferencia;
    monto_efectivo?: number;
    monto_banco?: number;
  }) {
    try {
      await prisma.recibo.create({
        data: {
          numero_recibo: data.numero_recibo,
          tipo_operacion: "TRANSFERENCIA",
          referencia_id: data.transferencia.id,
          usuario_id: data.usuario_id,
          punto_atencion_id: data.punto_atencion_id,
          datos_operacion: {
            transferencia: data.transferencia,
            detalle_divisas: data.detalle_divisas || null,
            responsable_movilizacion: data.responsable_movilizacion || null,
            tipo_transferencia: data.tipo_transferencia,
            monto: data.monto,
            via: data.via,
            monto_efectivo: data.monto_efectivo ?? null,
            monto_banco: data.monto_banco ?? null,
            fecha: new Date().toISOString(),
          },
        },
      });
      logger.info("Recibo registrado exitosamente");
    } catch (reciboError) {
      logger.warn("Error registrando recibo (no crítico)", {
        error: reciboError,
      });
    }
  },
};

export default transferCreationService;
