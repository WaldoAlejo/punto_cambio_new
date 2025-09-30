import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";

/**
 * Script para corregir transferencias históricas mal contabilizadas
 *
 * PROBLEMA:
 * - Las transferencias anteriores solo registraron INGRESO en el destino
 * - Nunca registraron EGRESO en el origen
 * - Esto causó saldos inflados artificialmente
 *
 * SOLUCIÓN:
 * - Identificar transferencias que solo tienen movimiento de destino
 * - Crear movimientos de EGRESO faltantes en el origen
 * - Ejecutar auto-reconciliación para corregir saldos
 */

interface TransferenciaIncompleta {
  id: string;
  numero_recibo: string | null;
  origen_id: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  via: string | null;
  fecha: Date;
  movimientosExistentes: {
    origen: boolean;
    destino: boolean;
  };
}

async function analizarTransferenciasHistoricas(): Promise<
  TransferenciaIncompleta[]
> {
  logger.info("🔍 Analizando transferencias históricas...");

  // Obtener todas las transferencias que tienen origen_id (transferencias entre puntos)
  const transferencias = await prisma.transferencia.findMany({
    where: {
      origen_id: {
        not: null,
      },
    },
    select: {
      id: true,
      numero_recibo: true,
      origen_id: true,
      destino_id: true,
      moneda_id: true,
      monto: true,
      via: true,
      fecha: true,
    },
    orderBy: {
      fecha: "asc",
    },
  });

  logger.info(
    `📊 Encontradas ${transferencias.length} transferencias con origen`
  );

  const transferenciasIncompletas: TransferenciaIncompleta[] = [];

  for (const transferencia of transferencias) {
    if (!transferencia.origen_id) continue;

    // Verificar qué movimientos existen para esta transferencia
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

    // Verificar si existe movimiento de origen (EGRESO) y destino (INGRESO)
    const movimientoOrigen = movimientos.find(
      (m) =>
        m.punto_atencion_id === transferencia.origen_id &&
        m.tipo_movimiento === "EGRESO"
    );

    const movimientoDestino = movimientos.find(
      (m) =>
        m.punto_atencion_id === transferencia.destino_id &&
        m.tipo_movimiento === "INGRESO"
    );

    // Si falta el movimiento de origen, es una transferencia incompleta
    if (!movimientoOrigen && movimientoDestino) {
      transferenciasIncompletas.push({
        ...transferencia,
        monto: Number(transferencia.monto),
        movimientosExistentes: {
          origen: !!movimientoOrigen,
          destino: !!movimientoDestino,
        },
      });
    }
  }

  logger.info(
    `⚠️ Encontradas ${transferenciasIncompletas.length} transferencias incompletas`
  );

  return transferenciasIncompletas;
}

async function corregirTransferenciaIncompleta(
  transferencia: TransferenciaIncompleta
): Promise<void> {
  if (!transferencia.origen_id) return;

  logger.info(
    `🔧 Corrigiendo transferencia ${transferencia.numero_recibo || "N/A"}`,
    {
      transferencia_id: transferencia.id,
      origen_id: transferencia.origen_id,
      destino_id: transferencia.destino_id,
      monto: transferencia.monto,
      moneda_id: transferencia.moneda_id,
    }
  );

  try {
    // Buscar un usuario administrador para usar como usuario del sistema
    const adminUser = await prisma.usuario.findFirst({
      where: {
        rol: "ADMIN",
      },
    });

    if (!adminUser) {
      throw new Error(
        "No se encontró un usuario administrador para la corrección"
      );
    }

    // Obtener información del punto de origen para el saldo anterior
    const saldoOrigen = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: transferencia.origen_id,
          moneda_id: transferencia.moneda_id,
        },
      },
    });

    const saldoAnterior = Number(saldoOrigen?.cantidad || 0);
    const saldoNuevo = saldoAnterior - transferencia.monto;

    // Crear el movimiento de EGRESO faltante en el origen
    await prisma.movimientoSaldo.create({
      data: {
        punto_atencion_id: transferencia.origen_id,
        moneda_id: transferencia.moneda_id,
        tipo_movimiento: "EGRESO",
        monto: transferencia.monto,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        usuario_id: adminUser.id, // Usuario administrador para corrección histórica
        referencia_id: transferencia.id,
        tipo_referencia: "TRANSFERENCIA",
        descripcion: `CORRECCIÓN HISTÓRICA: Transferencia ${
          transferencia.numero_recibo || "N/A"
        } - Salida (${transferencia.via || "N/A"})`,
        fecha: transferencia.fecha, // Mantener la fecha original
      },
    });

    logger.info(
      `✅ Movimiento de EGRESO creado para transferencia ${
        transferencia.numero_recibo || "N/A"
      }`
    );
  } catch (error) {
    logger.error(
      `❌ Error corrigiendo transferencia ${
        transferencia.numero_recibo || "N/A"
      }`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        transferencia_id: transferencia.id,
      }
    );
    throw error;
  }
}

async function ejecutarReconciliacionMasiva(): Promise<void> {
  logger.info("🔄 Ejecutando reconciliación masiva de todos los puntos...");

  // Buscar un usuario administrador para usar como usuario del sistema
  const adminUser = await prisma.usuario.findFirst({
    where: {
      rol: "ADMIN",
    },
  });

  if (!adminUser) {
    throw new Error(
      "No se encontró un usuario administrador para la reconciliación"
    );
  }

  // Obtener todos los puntos de atención
  const puntos = await prisma.puntoAtencion.findMany({
    select: {
      id: true,
      nombre: true,
    },
  });

  let totalCorregidos = 0;

  for (const punto of puntos) {
    try {
      logger.info(`🔄 Reconciliando punto: ${punto.nombre}`);

      const resultados =
        await saldoReconciliationService.reconciliarTodosPuntoAtencion(
          punto.id,
          adminUser.id // Usuario administrador
        );

      const corregidos = resultados.filter((r) => r.corregido).length;
      totalCorregidos += corregidos;

      if (corregidos > 0) {
        logger.info(
          `✅ Punto ${punto.nombre}: ${corregidos} saldos corregidos`
        );
      }
    } catch (error) {
      logger.error(`❌ Error reconciliando punto ${punto.nombre}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        punto_id: punto.id,
      });
    }
  }

  logger.info(
    `🎯 Reconciliación masiva completada: ${totalCorregidos} saldos corregidos en total`
  );
}

async function generarReporteAntes(): Promise<void> {
  logger.info(
    "📊 Generando reporte de inconsistencias ANTES de la corrección..."
  );

  const inconsistencias =
    await saldoReconciliationService.generarReporteInconsistencias();

  if (inconsistencias.length > 0) {
    logger.info("⚠️ INCONSISTENCIAS ENCONTRADAS ANTES DE LA CORRECCIÓN:");
    inconsistencias.forEach((inc) => {
      logger.info(
        `  - ${inc.puntoNombre} (${inc.monedaCodigo}): Registrado ${inc.saldoRegistrado}, Real ${inc.saldoCalculado}, Diferencia ${inc.diferencia}`
      );
    });
  } else {
    logger.info("✅ No se encontraron inconsistencias antes de la corrección");
  }
}

async function generarReporteDespues(): Promise<void> {
  logger.info(
    "📊 Generando reporte de inconsistencias DESPUÉS de la corrección..."
  );

  const inconsistencias =
    await saldoReconciliationService.generarReporteInconsistencias();

  if (inconsistencias.length > 0) {
    logger.warn("⚠️ INCONSISTENCIAS RESTANTES DESPUÉS DE LA CORRECCIÓN:");
    inconsistencias.forEach((inc) => {
      logger.warn(
        `  - ${inc.puntoNombre} (${inc.monedaCodigo}): Registrado ${inc.saldoRegistrado}, Real ${inc.saldoCalculado}, Diferencia ${inc.diferencia}`
      );
    });
  } else {
    logger.info("🎉 ¡Todas las inconsistencias han sido corregidas!");
  }
}

async function main(): Promise<void> {
  try {
    console.log("🚀 INICIANDO CORRECCIÓN DE TRANSFERENCIAS HISTÓRICAS");
    logger.info("🚀 INICIANDO CORRECCIÓN DE TRANSFERENCIAS HISTÓRICAS");
    logger.info("=".repeat(60));

    // 1. Generar reporte inicial
    await generarReporteAntes();

    // 2. Analizar transferencias históricas
    const transferenciasIncompletas = await analizarTransferenciasHistoricas();

    if (transferenciasIncompletas.length === 0) {
      logger.info(
        "✅ No se encontraron transferencias incompletas. El sistema ya está correcto."
      );
      return;
    }

    // 3. Mostrar resumen de lo que se va a corregir
    logger.info("📋 RESUMEN DE CORRECCIONES A REALIZAR:");
    logger.info(
      `  - ${transferenciasIncompletas.length} transferencias incompletas encontradas`
    );

    const montoTotal = transferenciasIncompletas.reduce(
      (sum, t) => sum + t.monto,
      0
    );
    logger.info(`  - Monto total afectado: ${montoTotal.toFixed(2)}`);

    const puntosAfectados = new Set(
      transferenciasIncompletas.map((t) => t.origen_id)
    ).size;
    logger.info(`  - ${puntosAfectados} puntos de origen afectados`);

    // 4. Corregir cada transferencia incompleta
    logger.info("\n🔧 INICIANDO CORRECCIONES...");

    for (let i = 0; i < transferenciasIncompletas.length; i++) {
      const transferencia = transferenciasIncompletas[i];
      logger.info(
        `[${i + 1}/${transferenciasIncompletas.length}] Corrigiendo ${
          transferencia.numero_recibo || "N/A"
        }...`
      );

      await corregirTransferenciaIncompleta(transferencia);
    }

    // 5. Ejecutar reconciliación masiva
    logger.info("\n🔄 EJECUTANDO RECONCILIACIÓN MASIVA...");
    await ejecutarReconciliacionMasiva();

    // 6. Generar reporte final
    logger.info("\n📊 GENERANDO REPORTE FINAL...");
    await generarReporteDespues();

    logger.info("\n🎉 CORRECCIÓN COMPLETADA EXITOSAMENTE");
    logger.info("=".repeat(60));
  } catch (error) {
    logger.error(
      "💥 Error durante la corrección de transferencias históricas",
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
    throw error;
  }
}

// Ejecutar el script directamente
(async () => {
  try {
    console.log("🚀 Iniciando corrección de transferencias históricas...");
    await main();
    console.log("✅ Script completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("❌ Script falló:", error);
    logger.error("❌ Script falló", { error });
    process.exit(1);
  }
})();

export { main as fixHistoricalTransfers };
