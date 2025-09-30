import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";
async function analizarTransferencias() {
    logger.info("🔍 Analizando todas las transferencias...");
    const transferencias = await prisma.transferencia.findMany({
        where: {
            origen_id: {
                not: null,
            },
        },
        include: {
            origen: {
                select: { nombre: true },
            },
            destino: {
                select: { nombre: true },
            },
            moneda: {
                select: { codigo: true },
            },
        },
        orderBy: {
            fecha: "desc",
        },
    });
    const analisis = [];
    for (const transferencia of transferencias) {
        if (!transferencia.origen_id)
            continue;
        // Buscar movimientos relacionados
        const movimientos = await prisma.movimientoSaldo.findMany({
            where: {
                referencia_id: transferencia.id,
                tipo_referencia: "TRANSFERENCIA",
            },
            select: {
                punto_atencion_id: true,
                tipo_movimiento: true,
                monto: true,
            },
        });
        const movimientoOrigen = movimientos.find((m) => m.punto_atencion_id === transferencia.origen_id &&
            m.tipo_movimiento === "EGRESO");
        const movimientoDestino = movimientos.find((m) => m.punto_atencion_id === transferencia.destino_id &&
            m.tipo_movimiento === "INGRESO");
        let problema = "";
        if (!movimientoOrigen && !movimientoDestino) {
            problema = "Sin movimientos registrados";
        }
        else if (!movimientoOrigen && movimientoDestino) {
            problema = "Falta movimiento de EGRESO en origen";
        }
        else if (movimientoOrigen && !movimientoDestino) {
            problema = "Falta movimiento de INGRESO en destino";
        }
        else {
            problema = "Completa";
        }
        if (problema !== "Completa") {
            analisis.push({
                transferencia_id: transferencia.id,
                numero_recibo: transferencia.numero_recibo,
                fecha: transferencia.fecha,
                origen_nombre: transferencia.origen?.nombre || "N/A",
                destino_nombre: transferencia.destino.nombre,
                moneda_codigo: transferencia.moneda.codigo,
                monto: Number(transferencia.monto),
                via: transferencia.via,
                tiene_movimiento_origen: !!movimientoOrigen,
                tiene_movimiento_destino: !!movimientoDestino,
                problema,
            });
        }
    }
    return analisis;
}
async function generarReporteInconsistencias() {
    logger.info("📊 Generando reporte de inconsistencias de saldos...");
    const inconsistencias = await saldoReconciliationService.generarReporteInconsistencias();
    if (inconsistencias.length > 0) {
        logger.info("\n⚠️ INCONSISTENCIAS DE SALDOS ENCONTRADAS:");
        logger.info("=".repeat(80));
        inconsistencias.forEach((inc) => {
            logger.info(`📍 ${inc.puntoNombre} - ${inc.monedaCodigo}:`);
            logger.info(`   Saldo Registrado: ${inc.saldoRegistrado.toFixed(2)}`);
            logger.info(`   Saldo Calculado:  ${inc.saldoCalculado.toFixed(2)}`);
            logger.info(`   Diferencia:       ${inc.diferencia.toFixed(2)}`);
            logger.info("");
        });
        const totalDiferencia = inconsistencias.reduce((sum, inc) => sum + Math.abs(inc.diferencia), 0);
        logger.info(`💰 Total diferencia absoluta: ${totalDiferencia.toFixed(2)}`);
    }
    else {
        logger.info("✅ No se encontraron inconsistencias de saldos");
    }
    return inconsistencias;
}
async function main() {
    try {
        logger.info("📋 REPORTE DE TRANSFERENCIAS HISTÓRICAS");
        logger.info("=".repeat(60));
        // 1. Analizar transferencias
        const problemasTransferencias = await analizarTransferencias();
        if (problemasTransferencias.length > 0) {
            logger.info("\n🚨 TRANSFERENCIAS CON PROBLEMAS:");
            logger.info("=".repeat(80));
            // Agrupar por tipo de problema
            const porProblema = problemasTransferencias.reduce((acc, t) => {
                if (!acc[t.problema])
                    acc[t.problema] = [];
                acc[t.problema].push(t);
                return acc;
            }, {});
            Object.entries(porProblema).forEach(([problema, transferencias]) => {
                logger.info(`\n📌 ${problema.toUpperCase()} (${transferencias.length} casos):`);
                transferencias.slice(0, 10).forEach((t) => {
                    // Mostrar solo las primeras 10
                    logger.info(`   ${t.numero_recibo || "N/A"} | ${t.fecha.toISOString().split("T")[0]} | ${t.origen_nombre} → ${t.destino_nombre} | ${t.moneda_codigo} ${t.monto} | ${t.via || "N/A"}`);
                });
                if (transferencias.length > 10) {
                    logger.info(`   ... y ${transferencias.length - 10} más`);
                }
                const montoTotal = transferencias.reduce((sum, t) => sum + t.monto, 0);
                logger.info(`   💰 Monto total afectado: ${montoTotal.toFixed(2)}`);
            });
            // Resumen general
            logger.info("\n📊 RESUMEN:");
            logger.info(`   Total transferencias con problemas: ${problemasTransferencias.length}`);
            const montoTotalAfectado = problemasTransferencias.reduce((sum, t) => sum + t.monto, 0);
            logger.info(`   Monto total afectado: ${montoTotalAfectado.toFixed(2)}`);
            const puntosAfectados = new Set(problemasTransferencias.map((t) => t.origen_nombre)).size;
            logger.info(`   Puntos de origen afectados: ${puntosAfectados}`);
        }
        else {
            logger.info("✅ Todas las transferencias están correctamente contabilizadas");
        }
        // 2. Generar reporte de inconsistencias de saldos
        logger.info("\n" + "=".repeat(60));
        await generarReporteInconsistencias();
        logger.info("\n📋 REPORTE COMPLETADO");
        logger.info("=".repeat(60));
    }
    catch (error) {
        logger.error("💥 Error generando reporte", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
// Ejecutar solo si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
        .then(() => {
        logger.info("✅ Reporte completado");
        process.exit(0);
    })
        .catch((error) => {
        logger.error("❌ Reporte falló", { error });
        process.exit(1);
    });
}
export { main as generateTransferReport };
