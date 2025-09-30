import { generateTransferReport } from "./report-transfer-issues.js";
import { fixHistoricalTransfers } from "./fix-historical-transfers.js";
import logger from "../utils/logger.js";

/**
 * Menú interactivo para manejar la corrección de transferencias históricas
 */

function mostrarMenu() {
  console.log("\n🔧 HERRAMIENTAS DE CORRECCIÓN DE TRANSFERENCIAS");
  console.log("=".repeat(50));
  console.log("1. 📋 Generar reporte (solo análisis, sin cambios)");
  console.log("2. 🔧 Corregir transferencias históricas");
  console.log("3. ❌ Salir");
  console.log("=".repeat(50));
}

async function ejecutarOpcion(opcion: string): Promise<boolean> {
  switch (opcion.trim()) {
    case "1":
      logger.info("📋 Ejecutando reporte de análisis...");
      await generateTransferReport();
      return true;

    case "2":
      logger.info("🔧 Ejecutando corrección de transferencias históricas...");
      logger.warn("⚠️ ATENCIÓN: Esta operación modificará la base de datos");
      logger.warn("⚠️ Se recomienda hacer un backup antes de continuar");

      // En un entorno real, aquí podrías pedir confirmación
      await fixHistoricalTransfers();
      return true;

    case "3":
      logger.info("👋 Saliendo...");
      return false;

    default:
      logger.warn("❌ Opción no válida. Por favor seleccione 1, 2 o 3.");
      return true;
  }
}

async function main(): Promise<void> {
  try {
    logger.info("🚀 Iniciando herramientas de corrección de transferencias");

    // Por ahora ejecutamos directamente el reporte
    // En un entorno interactivo podrías usar readline para el menú
    logger.info("📋 Ejecutando reporte de análisis automáticamente...");
    await generateTransferReport();

    logger.info("\n💡 Para ejecutar la corrección, use:");
    logger.info("   npm run fix-transfers");
  } catch (error) {
    logger.error("💥 Error en las herramientas de corrección", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

// Ejecutar solo si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      logger.info("✅ Herramientas completadas");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Herramientas fallaron", { error });
      process.exit(1);
    });
}

export { main };
