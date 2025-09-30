import { TipoMovimiento, } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import saldoReconciliationService from "./saldoReconciliationService.js";
async function getSaldo(pointId, monedaId) {
    const s = await prisma.saldo.findUnique({
        where: {
            punto_atencion_id_moneda_id: {
                punto_atencion_id: pointId,
                moneda_id: monedaId,
            },
        },
        select: { id: true, cantidad: true, bancos: true },
    });
    return {
        id: s?.id ?? null,
        cantidad: Number(s?.cantidad ?? 0),
        bancos: Number(s?.bancos ?? 0),
    };
}
async function upsertSaldoEfectivo(pointId, monedaId, nuevoEfectivo, usuarioId) {
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
    }
    else {
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
    // 🔄 AUTO-RECONCILIACIÓN: Verificar y corregir automáticamente cualquier inconsistencia
    try {
        const reconciliationResult = await saldoReconciliationService.reconciliarSaldo(pointId, monedaId, usuarioId);
        if (reconciliationResult.corregido) {
            logger.warn("🔧 Saldo corregido automáticamente después de actualización", {
                pointId,
                monedaId,
                saldoAnterior: reconciliationResult.saldoAnterior,
                saldoCalculado: reconciliationResult.saldoCalculado,
                diferencia: reconciliationResult.diferencia,
                usuarioId,
            });
        }
    }
    catch (reconciliationError) {
        logger.error("Error en auto-reconciliación de saldo efectivo", {
            error: reconciliationError instanceof Error
                ? reconciliationError.message
                : "Unknown error",
            pointId,
            monedaId,
            usuarioId,
        });
        // No lanzamos el error para no interrumpir la operación principal
    }
}
async function upsertSaldoBanco(pointId, monedaId, nuevoBanco, usuarioId) {
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
    }
    else {
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
    // 🔄 AUTO-RECONCILIACIÓN: Verificar saldo después de actualización de banco
    // Nota: Los saldos de banco no afectan el cuadre de caja, pero mantenemos consistencia
    try {
        const reconciliationResult = await saldoReconciliationService.reconciliarSaldo(pointId, monedaId, usuarioId);
        if (reconciliationResult.corregido) {
            logger.warn("🔧 Saldo corregido automáticamente después de actualización de banco", {
                pointId,
                monedaId,
                saldoAnterior: reconciliationResult.saldoAnterior,
                saldoCalculado: reconciliationResult.saldoCalculado,
                diferencia: reconciliationResult.diferencia,
                usuarioId,
            });
        }
    }
    catch (reconciliationError) {
        logger.error("Error en auto-reconciliación de saldo banco", {
            error: reconciliationError instanceof Error
                ? reconciliationError.message
                : "Unknown error",
            pointId,
            monedaId,
            usuarioId,
        });
        // No lanzamos el error para no interrumpir la operación principal
    }
}
async function logMovimientoSaldo(args) {
    await prisma.movimientoSaldo.create({
        data: {
            punto_atencion_id: args.punto_atencion_id,
            moneda_id: args.moneda_id,
            tipo_movimiento: args.tipo_movimiento,
            monto: args.monto,
            saldo_anterior: args.saldo_anterior,
            saldo_nuevo: args.saldo_nuevo,
            usuario_id: args.usuario_id,
            referencia_id: args.referencia_id,
            tipo_referencia: args.tipo_referencia,
            descripcion: args.descripcion ?? null,
        },
    });
}
export const transferCreationService = {
    generateReceiptNumber() {
        return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    },
    async createTransfer(transferData) {
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
    async contabilizarEntradaDestino(args) {
        const { destino_id, moneda_id, usuario_id, transferencia, numero_recibo, via, } = args;
        let efectivo = 0;
        let banco = 0;
        if (via === "EFECTIVO") {
            efectivo = args.monto;
        }
        else if (via === "BANCO") {
            banco = args.monto;
        }
        else {
            // MIXTO
            const me = Number(args.monto_efectivo ?? NaN);
            const mb = Number(args.monto_banco ?? NaN);
            if (Number.isFinite(me) &&
                Number.isFinite(mb) &&
                me >= 0 &&
                mb >= 0 &&
                +(me + mb).toFixed(2) <= +args.monto.toFixed(2)) {
                efectivo = +me.toFixed(2);
                banco = +mb.toFixed(2);
            }
            else {
                // Split 50/50 si no viene desglose válido
                const half = Math.round((args.monto / 2) * 100) / 100;
                efectivo = half;
                banco = +(+args.monto - half).toFixed(2);
            }
        }
        // === EFECTIVO (afecta cuadre)
        if (efectivo > 0) {
            const { cantidad: antEf } = await getSaldo(destino_id, moneda_id);
            const nuevoEf = +(antEf + efectivo).toFixed(2);
            await upsertSaldoEfectivo(destino_id, moneda_id, nuevoEf, usuario_id);
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
                descripcion: `Transferencia (BANCO) ${numero_recibo}`,
            });
        }
        // Registrar movimiento “operacional” (para listados rápidos)
        try {
            await prisma.movimiento.create({
                data: {
                    punto_atencion_id: destino_id,
                    usuario_id,
                    moneda_id,
                    monto: args.monto,
                    tipo: TipoMovimiento.TRANSFERENCIA_ENTRANTE,
                    descripcion: `Transferencia ${args.via} - ${numero_recibo}`,
                    numero_recibo: numero_recibo,
                },
            });
            logger.info("Movimiento registrado exitosamente");
        }
        catch (movError) {
            logger.warn("Error registrando movimiento (no crítico)", {
                error: movError,
            });
        }
    },
    async contabilizarSalidaOrigen(args) {
        const { origen_id, moneda_id, usuario_id, transferencia, numero_recibo, via, } = args;
        let efectivo = 0;
        let banco = 0;
        if (via === "EFECTIVO") {
            efectivo = args.monto;
        }
        else if (via === "BANCO") {
            banco = args.monto;
        }
        else {
            // MIXTO
            const me = Number(args.monto_efectivo ?? NaN);
            const mb = Number(args.monto_banco ?? NaN);
            if (Number.isFinite(me) &&
                Number.isFinite(mb) &&
                me >= 0 &&
                mb >= 0 &&
                +(me + mb).toFixed(2) <= +args.monto.toFixed(2)) {
                efectivo = +me.toFixed(2);
                banco = +mb.toFixed(2);
            }
            else {
                // Split 50/50 si no viene desglose válido
                const half = Math.round((args.monto / 2) * 100) / 100;
                efectivo = half;
                banco = +(+args.monto - half).toFixed(2);
            }
        }
        // === EFECTIVO (afecta cuadre) - RESTAR del origen
        if (efectivo > 0) {
            const { cantidad: antEf } = await getSaldo(origen_id, moneda_id);
            const nuevoEf = +(antEf - efectivo).toFixed(2);
            await upsertSaldoEfectivo(origen_id, moneda_id, nuevoEf, usuario_id);
            await logMovimientoSaldo({
                punto_atencion_id: origen_id,
                moneda_id,
                tipo_movimiento: "EGRESO",
                monto: efectivo,
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
                monto: banco,
                saldo_anterior: antBk,
                saldo_nuevo: nuevoBk,
                usuario_id,
                referencia_id: transferencia.id,
                tipo_referencia: "TRANSFERENCIA",
                descripcion: `Transferencia (BANCO) ${numero_recibo} - Salida`,
            });
        }
        // Registrar movimiento "operacional" (para listados rápidos)
        try {
            await prisma.movimiento.create({
                data: {
                    punto_atencion_id: origen_id,
                    usuario_id,
                    moneda_id,
                    monto: args.monto,
                    tipo: TipoMovimiento.TRANSFERENCIA_SALIENTE,
                    descripcion: `Transferencia ${args.via} - ${numero_recibo} - Salida`,
                    numero_recibo: numero_recibo,
                },
            });
            logger.info("Movimiento de salida registrado exitosamente");
        }
        catch (movError) {
            logger.warn("Error registrando movimiento de salida (no crítico)", {
                error: movError,
            });
        }
    },
    async createReceipt(data) {
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
        }
        catch (reciboError) {
            logger.warn("Error registrando recibo (no crítico)", {
                error: reciboError,
            });
        }
    },
};
export default transferCreationService;
