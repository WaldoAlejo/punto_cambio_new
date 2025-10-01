/**
 * Script para eliminar todos los ajustes y recalcular saldos desde cero
 *
 * PROPÓSITO:
 * - Eliminar todos los movimientos de tipo "AJUSTE" de la base de datos
 * - Recalcular todos los saldos basándose únicamente en movimientos reales
 * - No crear ningún tipo de ajuste, solo sumar y restar movimientos reales
 *
 * PROCESO:
 * 1. Eliminar todos los MovimientoSaldo de tipo "AJUSTE"
 * 2. Para cada punto de atención y moneda:
 *    - Calcular saldo basado en movimientos reales (INGRESO/EGRESO)
 *    - Actualizar tabla Saldo con el valor calculado
 * 3. Reportar diferencias encontradas sin crear ajustes
 */
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
const prisma = new PrismaClient();
async function eliminarTodosLosAjustes() {
    logger.info("🗑️ Eliminando todos los movimientos de tipo AJUSTE...");
    const result = await prisma.movimientoSaldo.deleteMany({
        where: {
            tipo_movimiento: "AJUSTE",
        },
    });
    logger.info(`✅ Eliminados ${result.count} movimientos de tipo AJUSTE`);
    return result.count;
}
async function calcularSaldoReal(puntoAtencionId, monedaId) {
    // Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            activo: true,
        },
    });
    let saldoCalculado = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
    // Obtener todos los movimientos reales (excluyendo AJUSTE)
    const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            tipo_movimiento: {
                in: [
                    "INGRESO",
                    "EGRESO",
                    "TRANSFERENCIA_ENTRANTE",
                    "TRANSFERENCIA_SALIENTE",
                    "CAMBIO_DIVISA",
                ],
            },
        },
        orderBy: {
            fecha: "asc",
        },
    });
    // Calcular saldo basado en movimientos reales
    for (const movimiento of movimientos) {
        const monto = Number(movimiento.monto);
        switch (movimiento.tipo_movimiento) {
            case "INGRESO":
            case "TRANSFERENCIA_ENTRANTE":
                saldoCalculado += monto;
                break;
            case "EGRESO":
            case "TRANSFERENCIA_SALIENTE":
                saldoCalculado -= monto;
                break;
            case "CAMBIO_DIVISA":
                // Para cambios de divisa, verificar la descripción
                if (movimiento.descripcion?.toLowerCase().includes("ingreso por cambio")) {
                    saldoCalculado += monto;
                }
                else if (movimiento.descripcion?.toLowerCase().includes("egreso por cambio")) {
                    saldoCalculado -= monto;
                }
                break;
        }
    }
    return {
        saldoCalculado,
        movimientosCount: movimientos.length,
    };
}
async function recalcularTodosLosSaldos() {
    logger.info("🔄 Recalculando todos los saldos basándose en movimientos reales...");
    // Obtener todos los saldos existentes
    const saldos = await prisma.saldo.findMany({
        include: {
            puntoAtencion: {
                select: { nombre: true },
            },
            moneda: {
                select: { codigo: true },
            },
        },
    });
    const resultados = [];
    for (const saldo of saldos) {
        const { saldoCalculado, movimientosCount } = await calcularSaldoReal(saldo.punto_atencion_id, saldo.moneda_id);
        const saldoRegistrado = Number(saldo.cantidad);
        const diferencia = saldoRegistrado - saldoCalculado;
        // Actualizar el saldo en la base de datos con el valor calculado
        await prisma.saldo.update({
            where: {
                id: saldo.id,
            },
            data: {
                cantidad: saldoCalculado,
            },
        });
        resultados.push({
            punto_atencion_id: saldo.punto_atencion_id,
            moneda_id: saldo.moneda_id,
            punto_nombre: saldo.puntoAtencion.nombre,
            moneda_codigo: saldo.moneda.codigo,
            saldo_registrado: saldoRegistrado,
            saldo_calculado: saldoCalculado,
            diferencia: diferencia,
            movimientos_count: movimientosCount,
        });
        if (Math.abs(diferencia) > 0.01) {
            logger.info(`📊 Saldo corregido: ${saldo.puntoAtencion.nombre} - ${saldo.moneda.codigo}`, {
                saldoAnterior: saldoRegistrado,
                saldoNuevo: saldoCalculado,
                diferencia: diferencia,
                movimientos: movimientosCount,
            });
        }
    }
    return resultados;
}
async function generarReporte(resultados) {
    logger.info("\n" + "=".repeat(80));
    logger.info("📋 REPORTE DE RECÁLCULO DE SALDOS");
    logger.info("=".repeat(80));
    const saldosConDiferencia = resultados.filter((r) => Math.abs(r.diferencia) > 0.01);
    const saldosCuadrados = resultados.filter((r) => Math.abs(r.diferencia) <= 0.01);
    logger.info(`✅ Saldos que ya estaban cuadrados: ${saldosCuadrados.length}`);
    logger.info(`🔧 Saldos corregidos: ${saldosConDiferencia.length}`);
    logger.info(`📊 Total de saldos procesados: ${resultados.length}`);
    if (saldosConDiferencia.length > 0) {
        logger.info("\n📋 DETALLE DE SALDOS CORREGIDOS:");
        logger.info("-".repeat(80));
        let totalDiferencia = 0;
        for (const resultado of saldosConDiferencia) {
            logger.info(`${resultado.punto_nombre} - ${resultado.moneda_codigo}:`);
            logger.info(`  Saldo anterior: ${resultado.saldo_registrado.toFixed(2)}`);
            logger.info(`  Saldo calculado: ${resultado.saldo_calculado.toFixed(2)}`);
            logger.info(`  Diferencia: ${resultado.diferencia.toFixed(2)}`);
            logger.info(`  Movimientos: ${resultado.movimientos_count}`);
            logger.info("");
            if (resultado.moneda_codigo === "USD") {
                totalDiferencia += Math.abs(resultado.diferencia);
            }
        }
        logger.info(`💰 Total diferencia en USD: $${totalDiferencia.toFixed(2)}`);
    }
    logger.info("\n✅ PROCESO COMPLETADO");
    logger.info("- Todos los ajustes han sido eliminados");
    logger.info("- Todos los saldos han sido recalculados basándose en movimientos reales");
    logger.info("- No se han creado nuevos ajustes");
    logger.info("=".repeat(80));
}
async function main() {
    try {
        logger.info("🚀 Iniciando proceso de limpieza y recálculo de saldos");
        // 1. Eliminar todos los ajustes
        const ajustesEliminados = await eliminarTodosLosAjustes();
        // 2. Recalcular todos los saldos
        const resultados = await recalcularTodosLosSaldos();
        // 3. Generar reporte
        await generarReporte(resultados);
        logger.info(`🎉 Proceso completado exitosamente. Eliminados ${ajustesEliminados} ajustes.`);
    }
    catch (error) {
        logger.error("❌ Error en el proceso de limpieza y recálculo:", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Ejecutar el script
main().catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
});
