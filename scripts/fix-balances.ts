#!/usr/bin/env tsx

/**
 * Script Maestro para Corrección de Balances
 *
 * Ejecuta el proceso completo de corrección de balances:
 * 1. Validación inicial
 * 2. Generación de reporte de auditoría
 * 3. Recálculo y corrección de balances
 * 4. Validación final
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  console.log("🚀 INICIANDO PROCESO DE CORRECCIÓN DE BALANCES");
  console.log("=".repeat(80));
  console.log("Este proceso realizará los siguientes pasos:");
  console.log("1. ✅ Validación inicial de balances");
  console.log("2. 📋 Generación de reporte de auditoría");
  console.log("3. 🔄 Recálculo y corrección de balances");
  console.log("4. ✅ Validación final");
  console.log("=".repeat(80));

  // Crear directorio de reportes si no existe
  const reportsDir = join(process.cwd(), "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
    console.log("📁 Directorio de reportes creado");
  }

  try {
    // Paso 1: Validación inicial
    console.log("\n🔍 PASO 1: VALIDACIÓN INICIAL");
    console.log("-".repeat(50));

    try {
      execSync("tsx scripts/validate-balances.ts", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error) {
      console.log(
        "⚠️  Validación inicial completada con inconsistencias detectadas"
      );
    }

    // Pausa para que el usuario pueda revisar
    console.log(
      "\n⏸️  Presiona ENTER para continuar con el reporte de auditoría..."
    );
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise((resolve) => process.stdin.once("data", resolve));
    process.stdin.setRawMode(false);
    process.stdin.pause();

    // Paso 2: Reporte de auditoría
    console.log("\n📋 PASO 2: GENERACIÓN DE REPORTE DE AUDITORÍA");
    console.log("-".repeat(50));

    execSync("tsx scripts/balance-audit-report.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Pausa para que el usuario pueda revisar los reportes
    console.log('\n⏸️  Revisa los reportes generados en la carpeta "reports".');
    console.log(
      "   Presiona ENTER para continuar con la corrección de balances..."
    );
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise((resolve) => process.stdin.once("data", resolve));
    process.stdin.setRawMode(false);
    process.stdin.pause();

    // Paso 3: Recálculo de balances
    console.log("\n🔄 PASO 3: RECÁLCULO Y CORRECCIÓN DE BALANCES");
    console.log("-".repeat(50));
    console.log(
      "⚠️  ATENCIÓN: Este paso modificará los balances en la base de datos."
    );
    console.log("   ¿Estás seguro de que quieres continuar? (y/N): ");

    process.stdin.setRawMode(true);
    process.stdin.resume();
    const confirmation = await new Promise<string>((resolve) => {
      process.stdin.once("data", (data) => {
        const key = data.toString().toLowerCase();
        resolve(key);
      });
    });
    process.stdin.setRawMode(false);
    process.stdin.pause();

    if (confirmation.trim() === "y") {
      console.log("\n🔄 Ejecutando recálculo de balances...");
      execSync("tsx scripts/recalculate-balances.ts", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } else {
      console.log("\n❌ Recálculo cancelado por el usuario.");
      console.log(
        '   Los reportes de auditoría están disponibles en la carpeta "reports".'
      );
      return;
    }

    // Paso 4: Validación final
    console.log("\n✅ PASO 4: VALIDACIÓN FINAL");
    console.log("-".repeat(50));

    execSync("tsx scripts/validate-balances.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Resumen final
    console.log("\n" + "=".repeat(80));
    console.log("🎉 PROCESO DE CORRECCIÓN COMPLETADO");
    console.log("=".repeat(80));
    console.log("✅ Validación inicial ejecutada");
    console.log("✅ Reporte de auditoría generado");
    console.log("✅ Balances recalculados y corregidos");
    console.log("✅ Validación final ejecutada");
    console.log('\n📁 Los reportes están disponibles en la carpeta "reports"');
    console.log("📊 Revisa los archivos CSV y JSON para análisis detallado");

    console.log("\n🔍 PRÓXIMOS PASOS RECOMENDADOS:");
    console.log("1. Revisar los reportes de auditoría generados");
    console.log("2. Verificar algunos balances manualmente en la aplicación");
    console.log("3. Hacer commit de los cambios si todo está correcto");
    console.log("4. Hacer push al servidor y pull en producción");
  } catch (error) {
    console.error("\n❌ Error durante el proceso de corrección:", error);
    console.log("\n🔧 ACCIONES RECOMENDADAS:");
    console.log("1. Revisar los logs de error arriba");
    console.log("2. Verificar la conexión a la base de datos");
    console.log("3. Asegurarse de que todas las dependencias están instaladas");
    console.log(
      "4. Ejecutar los scripts individuales para identificar el problema"
    );
    process.exit(1);
  }
}

// Ejecutar el script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
