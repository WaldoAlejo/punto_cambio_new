import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
/**
 * Servicio de Auto-Reconciliación de Saldos
 *
 * Este servicio garantiza que los saldos siempre estén cuadrados con los movimientos registrados,
 * evitando inconsistencias como la encontrada en el punto AMAZONAS.
 */
export const saldoReconciliationService = {
    /**
     * Calcula el saldo correcto basado en todos los movimientos registrados
     * Incluye: saldos iniciales, ingresos, egresos, transferencias y cambios de divisa
     */
    async calcularSaldoReal(puntoAtencionId, monedaId) {
        try {
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
                            "SALDO_INICIAL",
                        ],
                    },
                },
                select: {
                    monto: true,
                    tipo_movimiento: true,
                    descripcion: true,
                },
                orderBy: {
                    fecha: "asc",
                },
            });
            // Verificar si hay movimientos SALDO_INICIAL
            const tieneSaldoInicialMovimiento = movimientos.some((mov) => mov.tipo_movimiento === "SALDO_INICIAL");
            let saldoCalculado = 0;
            // Si hay movimientos SALDO_INICIAL, usar esos como base
            // Si no, usar la tabla saldoInicial
            if (!tieneSaldoInicialMovimiento) {
                const saldoInicial = await prisma.saldoInicial.findFirst({
                    where: {
                        punto_atencion_id: puntoAtencionId,
                        moneda_id: monedaId,
                        activo: true,
                    },
                });
                saldoCalculado = saldoInicial
                    ? Number(saldoInicial.cantidad_inicial)
                    : 0;
            }
            // Calcular saldo basado en movimientos reales
            for (const mov of movimientos) {
                const monto = Number(mov.monto);
                switch (mov.tipo_movimiento) {
                    case "SALDO_INICIAL":
                        // Los movimientos SALDO_INICIAL establecen el saldo base
                        saldoCalculado += monto;
                        break;
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
                        if (mov.descripcion?.toLowerCase().includes("ingreso por cambio")) {
                            saldoCalculado += monto;
                        }
                        else if (mov.descripcion?.toLowerCase().includes("egreso por cambio")) {
                            saldoCalculado -= monto;
                        }
                        break;
                }
            }
            return Number(saldoCalculado.toFixed(2));
        }
        catch (error) {
            logger.error("Error calculando saldo real", {
                error: error instanceof Error ? error.message : "Unknown error",
                puntoAtencionId,
                monedaId,
            });
            throw error;
        }
    },
    /**
     * Reconcilia automáticamente un saldo específico
     */
    async reconciliarSaldo(puntoAtencionId, monedaId, usuarioId) {
        try {
            logger.info("🔄 Iniciando reconciliación automática de saldo", {
                puntoAtencionId,
                monedaId,
                usuarioId,
            });
            // Obtener saldo actual registrado
            const saldoActual = await prisma.saldo.findUnique({
                where: {
                    punto_atencion_id_moneda_id: {
                        punto_atencion_id: puntoAtencionId,
                        moneda_id: monedaId,
                    },
                },
                select: {
                    cantidad: true,
                },
            });
            const saldoRegistrado = Number(saldoActual?.cantidad ?? 0);
            // Calcular saldo real basado en movimientos
            const saldoCalculado = await this.calcularSaldoReal(puntoAtencionId, monedaId);
            // Contar movimientos para contexto
            const movimientosCount = await prisma.movimientoSaldo.count({
                where: {
                    punto_atencion_id: puntoAtencionId,
                    moneda_id: monedaId,
                },
            });
            const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
            const requiereCorreccion = Math.abs(diferencia) > 0.01; // Tolerancia de 1 centavo
            let corregido = false;
            if (requiereCorreccion) {
                logger.warn("⚠️ Inconsistencia detectada en saldo", {
                    puntoAtencionId,
                    monedaId,
                    saldoRegistrado,
                    saldoCalculado,
                    diferencia,
                    movimientosCount,
                });
                // Corregir el saldo directamente sin crear ajustes
                await prisma.saldo.upsert({
                    where: {
                        punto_atencion_id_moneda_id: {
                            punto_atencion_id: puntoAtencionId,
                            moneda_id: monedaId,
                        },
                    },
                    update: {
                        cantidad: saldoCalculado,
                        updated_at: new Date(),
                    },
                    create: {
                        punto_atencion_id: puntoAtencionId,
                        moneda_id: monedaId,
                        cantidad: saldoCalculado,
                        billetes: 0,
                        monedas_fisicas: 0,
                        bancos: 0,
                    },
                });
                // NO crear movimientos de ajuste - solo actualizar el saldo
                corregido = true;
                logger.info("✅ Saldo corregido automáticamente", {
                    puntoAtencionId,
                    monedaId,
                    saldoAnterior: saldoRegistrado,
                    saldoNuevo: saldoCalculado,
                    diferencia,
                    usuarioId,
                });
            }
            else {
                logger.info("✅ Saldo ya está cuadrado", {
                    puntoAtencionId,
                    monedaId,
                    saldo: saldoCalculado,
                    movimientosCount,
                });
            }
            return {
                success: true,
                saldoAnterior: saldoRegistrado,
                saldoCalculado,
                diferencia,
                corregido,
                movimientosCount,
            };
        }
        catch (error) {
            logger.error("❌ Error en reconciliación automática", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                puntoAtencionId,
                monedaId,
                usuarioId,
            });
            return {
                success: false,
                saldoAnterior: 0,
                saldoCalculado: 0,
                diferencia: 0,
                corregido: false,
                movimientosCount: 0,
                error: error instanceof Error ? error.message : "Error desconocido",
            };
        }
    },
    /**
     * Reconcilia todos los saldos de un punto de atención
     */
    async reconciliarTodosPuntoAtencion(puntoAtencionId, usuarioId) {
        try {
            logger.info("🔄 Reconciliando todos los saldos del punto", {
                puntoAtencionId,
            });
            // Obtener todas las monedas que tienen saldo en este punto
            const saldos = await prisma.saldo.findMany({
                where: { punto_atencion_id: puntoAtencionId },
                select: { moneda_id: true },
            });
            const resultados = [];
            for (const saldo of saldos) {
                const resultado = await this.reconciliarSaldo(puntoAtencionId, saldo.moneda_id, usuarioId);
                resultados.push(resultado);
            }
            const corregidos = resultados.filter((r) => r.corregido).length;
            logger.info(`✅ Reconciliación completa: ${corregidos} saldos corregidos de ${resultados.length}`, {
                puntoAtencionId,
                usuarioId,
            });
            return resultados;
        }
        catch (error) {
            logger.error("Error en reconciliación masiva", {
                error: error instanceof Error ? error.message : "Unknown error",
                puntoAtencionId,
                usuarioId,
            });
            throw error;
        }
    },
    /**
     * Genera un reporte de inconsistencias en todos los puntos
     */
    async generarReporteInconsistencias() {
        try {
            logger.info("📊 Generando reporte de inconsistencias");
            const saldos = await prisma.saldo.findMany({
                include: {
                    puntoAtencion: {
                        select: { id: true, nombre: true },
                    },
                    moneda: {
                        select: { id: true, codigo: true },
                    },
                },
            });
            const reporte = [];
            for (const saldo of saldos) {
                const saldoRegistrado = Number(saldo.cantidad);
                const saldoCalculado = await this.calcularSaldoReal(saldo.punto_atencion_id, saldo.moneda_id);
                const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
                const requiereCorreccion = Math.abs(diferencia) > 0.01;
                if (requiereCorreccion) {
                    reporte.push({
                        puntoAtencionId: saldo.punto_atencion_id,
                        puntoNombre: saldo.puntoAtencion.nombre,
                        monedaId: saldo.moneda_id,
                        monedaCodigo: saldo.moneda.codigo,
                        saldoRegistrado,
                        saldoCalculado,
                        diferencia,
                        requiereCorreccion,
                    });
                }
            }
            logger.info(`📊 Reporte generado: ${reporte.length} inconsistencias encontradas`);
            return reporte;
        }
        catch (error) {
            logger.error("Error generando reporte de inconsistencias", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            throw error;
        }
    },
    /**
     * Función de utilidad para verificar si un saldo está cuadrado
     */
    async verificarSaldoCuadrado(puntoAtencionId, monedaId) {
        try {
            const resultado = await this.reconciliarSaldo(puntoAtencionId, monedaId);
            return Math.abs(resultado.diferencia) <= 0.01;
        }
        catch (error) {
            logger.error("Error verificando saldo cuadrado", {
                error: error instanceof Error ? error.message : "Unknown error",
                puntoAtencionId,
                monedaId,
            });
            return false;
        }
    },
};
export default saldoReconciliationService;
