import { PrismaClient } from "@prisma/client";
import saldoReconciliationService from "../services/saldoReconciliationService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

async function ejecutarReconciliacionMasiva(): Promise<void> {
  logger.info("🔄 Ejecutando reconciliación masiva de todos los puntos...");
  console.log("🔄 Ejecutando reconciliación masiva de todos los puntos...");

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

  logger.info(
    `👤 Usuario administrador encontrado: ${adminUser.nombre} (${adminUser.id})`
  );
  console.log(
    `👤 Usuario administrador encontrado: ${adminUser.nombre} (${adminUser.id})`
  );

  // Obtener todos los puntos de atención
  const puntos = await prisma.puntoAtencion.findMany({
    select: {
      id: true,
      nombre: true,
    },
  });

  logger.info(
    `📍 Encontrados ${puntos.length} puntos de atención para reconciliar`
  );
  console.log(
    `📍 Encontrados ${puntos.length} puntos de atención para reconciliar`
  );

  let totalCorregidos = 0;
  let totalProcesados = 0;

  for (const punto of puntos) {
    try {
      logger.info(`🔄 Reconciliando punto: ${punto.nombre}`);
      console.log(`🔄 Reconciliando punto: ${punto.nombre}`);

      // Obtener saldos del punto para tener información de monedas
      const saldos = await prisma.saldo.findMany({
        where: { punto_atencion_id: punto.id },
        include: {
          moneda: {
            select: { codigo: true },
          },
        },
      });

      const resultados =
        await saldoReconciliationService.reconciliarTodosPuntoAtencion(
          punto.id,
          adminUser.id // Usuario administrador
        );

      const corregidos = resultados.filter((r) => r.corregido).length;
      totalCorregidos += corregidos;
      totalProcesados += resultados.length;

      logger.info(
        `✅ Punto ${punto.nombre}: ${corregidos}/${resultados.length} saldos corregidos`
      );
      console.log(
        `✅ Punto ${punto.nombre}: ${corregidos}/${resultados.length} saldos corregidos`
      );

      // Mostrar detalles de las correcciones
      for (let i = 0; i < resultados.length; i++) {
        const resultado = resultados[i];
        if (resultado.corregido && saldos[i]) {
          const monedaCodigo = saldos[i].moneda.codigo;
          logger.info(
            `   💰 ${monedaCodigo}: ${resultado.saldoAnterior} → ${resultado.saldoCalculado} (diferencia: ${resultado.diferencia})`
          );
          console.log(
            `   💰 ${monedaCodigo}: ${resultado.saldoAnterior} → ${resultado.saldoCalculado} (diferencia: ${resultado.diferencia})`
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      logger.error(`❌ Error reconciliando punto ${punto.nombre}:`, {
        error: errorMessage,
      });
      console.error(`❌ Error reconciliando punto ${punto.nombre}:`, error);
    }
  }

  logger.info("============================================================");
  logger.info(`🎉 RECONCILIACIÓN MASIVA COMPLETADA`);
  logger.info(`📊 Resumen:`);
  logger.info(`   - Puntos procesados: ${puntos.length}`);
  logger.info(`   - Saldos procesados: ${totalProcesados}`);
  logger.info(`   - Saldos corregidos: ${totalCorregidos}`);
  logger.info("============================================================");

  console.log("============================================================");
  console.log(`🎉 RECONCILIACIÓN MASIVA COMPLETADA`);
  console.log(`📊 Resumen:`);
  console.log(`   - Puntos procesados: ${puntos.length}`);
  console.log(`   - Saldos procesados: ${totalProcesados}`);
  console.log(`   - Saldos corregidos: ${totalCorregidos}`);
  console.log("============================================================");
}

async function main(): Promise<void> {
  try {
    logger.info("🚀 INICIANDO RECONCILIACIÓN MASIVA");
    logger.info("============================================================");
    console.log("🚀 INICIANDO RECONCILIACIÓN MASIVA");
    console.log("============================================================");

    await ejecutarReconciliacionMasiva();

    logger.info("✅ Reconciliación masiva completada exitosamente");
    console.log("✅ Reconciliación masiva completada exitosamente");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    logger.error("💥 Error durante la reconciliación masiva:", {
      error: errorMessage,
    });
    console.error("💥 Error durante la reconciliación masiva:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
(async () => {
  try {
    await main();
    console.log("✅ Script completado exitosamente");
  } catch (error) {
    console.error("❌ Script falló:", error);
    process.exit(1);
  }
})();
