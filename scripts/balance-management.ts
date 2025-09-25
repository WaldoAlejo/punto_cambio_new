#!/usr/bin/env tsx

/**
 * Script Maestro de Gestión de Balances
 *
 * Este script proporciona múltiples funcionalidades para la gestión de balances:
 * - Auditoría (solo lectura)
 * - Recálculo completo
 * - Validación de integridad
 * - Análisis de diferencias
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:admin@localhost:5432/punto_cambio_new",
    },
  },
});

function showHelp() {
  console.log(`
🔧 SCRIPT MAESTRO DE GESTIÓN DE BALANCES
========================================

Uso: npx tsx scripts/balance-management.ts [comando] [opciones]

COMANDOS DISPONIBLES:

📊 audit, -a
   Ejecuta una auditoría completa sin modificar datos
   Muestra qué correcciones serían necesarias

🔄 recalculate, -r
   Recalcula y actualiza todos los balances
   ⚠️  MODIFICA LA BASE DE DATOS

🔍 validate, -v
   Valida la integridad de los datos
   Identifica inconsistencias y problemas

📈 analyze, -z
   Analiza diferencias específicas por moneda
   Útil para investigar discrepancias

🆘 help, -h
   Muestra esta ayuda

EJEMPLOS:
   npx tsx scripts/balance-management.ts audit
   npx tsx scripts/balance-management.ts recalculate
   npx tsx scripts/balance-management.ts validate
   npx tsx scripts/balance-management.ts analyze

RECOMENDACIÓN:
   1. Ejecuta 'audit' primero para ver qué cambios se aplicarían
   2. Ejecuta 'validate' para verificar integridad de datos
   3. Si todo está bien, ejecuta 'recalculate' para aplicar cambios
`);
}

async function runAudit() {
  console.log("🔍 EJECUTANDO AUDITORÍA DE BALANCES (SOLO LECTURA)");
  console.log("=".repeat(50));

  // Importar y ejecutar el script de recálculo en modo solo lectura
  const { recalculateBalancesImproved } = await import(
    "./recalculate-balances-improved.js"
  );
  await recalculateBalancesImproved(true); // true = modo solo lectura
}

async function runRecalculate() {
  console.log("⚠️  EJECUTANDO RECÁLCULO COMPLETO DE BALANCES");
  console.log("=".repeat(50));
  console.log("🚨 ADVERTENCIA: Este proceso MODIFICARÁ la base de datos");

  // Confirmar con el usuario (en un entorno real)
  console.log("✅ Procediendo con el recálculo...\n");

  const { recalculateBalancesImproved } = await import(
    "./recalculate-balances-improved.js"
  );
  await recalculateBalancesImproved(false); // false = modo actualización
}

async function runValidation() {
  console.log("🔍 EJECUTANDO VALIDACIÓN DE INTEGRIDAD");
  console.log("=".repeat(50));

  // Ejecutar validaciones de integridad
  await validateDataIntegrity();
}

async function runAnalysis() {
  console.log("📈 EJECUTANDO ANÁLISIS DE DIFERENCIAS");
  console.log("=".repeat(50));

  // Ejecutar análisis detallado
  await analyzeBalanceDifferences();
}

// Funciones de validación e análisis integradas
async function validateDataIntegrity() {
  const results: Array<{ test: string; passed: boolean; details: string }> = [];

  try {
    // Validaciones básicas
    const cambiosSinDivisas = await prisma.cambioDivisa.count({
      where: {
        OR: [
          { divisas_entregadas_total: null },
          { divisas_recibidas_total: null },
        ],
      },
    });

    results.push({
      test: "Cambios con campos de divisas faltantes",
      passed: cambiosSinDivisas === 0,
      details: `${cambiosSinDivisas} cambios encontrados`,
    });

    const balancesNegativos = await prisma.saldo.count({
      where: { cantidad: { lt: 0 } },
    });

    results.push({
      test: "Balances negativos",
      passed: balancesNegativos === 0,
      details: `${balancesNegativos} balances negativos encontrados`,
    });

    // Mostrar resultados
    console.log("📋 RESULTADOS DE VALIDACIÓN:");
    let testsPasados = 0;

    for (const result of results) {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.test}: ${result.details}`);
      if (result.passed) testsPasados++;
    }

    console.log(`\n📊 ${testsPasados}/${results.length} validaciones pasaron`);
  } catch (error) {
    console.error("❌ Error en validación:", error);
  }
}

async function analyzeBalanceDifferences() {
  const monedasProblematicas = ["USD", "COP", "EUR"];

  for (const codigoMoneda of monedasProblematicas) {
    console.log(`\n📊 ANÁLISIS - ${codigoMoneda}`);
    console.log("-".repeat(30));

    const moneda = await prisma.moneda.findFirst({
      where: { codigo: codigoMoneda },
    });

    if (!moneda) continue;

    const balances = await prisma.saldo.findMany({
      where: { moneda_id: moneda.id },
      include: {
        puntoAtencion: { select: { nombre: true } },
      },
    });

    console.log(`Puntos con ${codigoMoneda}: ${balances.length}`);

    let totalBalance = 0;
    for (const balance of balances) {
      totalBalance += Number(balance.cantidad);
    }

    console.log(`Balance total: ${totalBalance.toLocaleString()}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === "help" || command === "-h") {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case "audit":
      case "-a":
        await runAudit();
        break;

      case "recalculate":
      case "-r":
        await runRecalculate();
        break;

      case "validate":
      case "-v":
        await runValidation();
        break;

      case "analyze":
      case "-z":
        await runAnalysis();
        break;

      default:
        console.log(`❌ Comando desconocido: ${command}`);
        console.log("Usa 'help' para ver los comandos disponibles.");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error ejecutando comando:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main().catch(console.error);
