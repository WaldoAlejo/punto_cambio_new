#!/usr/bin/env tsx

/**
 * Script de Validación de Integridad de Datos (Corregido)
 *
 * Este script verifica la consistencia e integridad de los datos
 * relacionados con balances y transacciones.
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

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
  count?: number;
  severity: "ERROR" | "WARNING" | "INFO";
}

async function validateDataIntegrity() {
  console.log("🔍 Iniciando validación de integridad de datos...\n");

  const results: ValidationResult[] = [];

  try {
    // 1. Validar cambios de divisas con problemas potenciales
    console.log("1️⃣ Validando cambios de divisas...");

    // Cambios donde tanto entregadas como recibidas son 0 (posible error)
    const cambiosSinMovimiento = await prisma.cambioDivisa.count({
      where: {
        AND: [{ divisas_entregadas_total: 0 }, { divisas_recibidas_total: 0 }],
      },
    });

    results.push({
      test: "Cambios sin movimiento de divisas",
      passed: cambiosSinMovimiento === 0,
      details: `${cambiosSinMovimiento} cambios sin divisas entregadas ni recibidas`,
      count: cambiosSinMovimiento,
      severity: cambiosSinMovimiento > 0 ? "WARNING" : "INFO",
    });

    // Cambios con montos negativos
    const cambiosConMontosNegativos = await prisma.cambioDivisa.count({
      where: {
        OR: [
          { monto_origen: { lt: 0 } },
          { monto_destino: { lt: 0 } },
          { divisas_entregadas_total: { lt: 0 } },
          { divisas_recibidas_total: { lt: 0 } },
        ],
      },
    });

    results.push({
      test: "Cambios con montos negativos",
      passed: cambiosConMontosNegativos === 0,
      details: `${cambiosConMontosNegativos} cambios con montos negativos encontrados`,
      count: cambiosConMontosNegativos,
      severity: cambiosConMontosNegativos > 0 ? "ERROR" : "INFO",
    });

    // 2. Validar saldos negativos
    console.log("2️⃣ Validando saldos...");

    const saldosNegativos = await prisma.saldo.count({
      where: {
        OR: [
          { cantidad: { lt: 0 } },
          { billetes: { lt: 0 } },
          { monedas_fisicas: { lt: 0 } },
          { bancos: { lt: 0 } },
        ],
      },
    });

    results.push({
      test: "Saldos negativos",
      passed: saldosNegativos === 0,
      details: `${saldosNegativos} saldos con valores negativos`,
      count: saldosNegativos,
      severity: saldosNegativos > 0 ? "ERROR" : "INFO",
    });

    // 3. Validar consistencia de saldos (cantidad = billetes + monedas_fisicas + bancos)
    console.log("3️⃣ Validando consistencia de saldos...");

    // Verificación manual de consistencia
    const todosSaldos = await prisma.saldo.findMany({
      select: {
        id: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    const saldosInconsistentesManual = todosSaldos.filter((saldo) => {
      const calculado =
        Number(saldo.billetes) +
        Number(saldo.monedas_fisicas) +
        Number(saldo.bancos);
      const actual = Number(saldo.cantidad);
      return Math.abs(calculado - actual) > 0.01; // Tolerancia para decimales
    });

    results.push({
      test: "Consistencia de saldos (cantidad = billetes + monedas + bancos)",
      passed: saldosInconsistentesManual.length === 0,
      details: `${saldosInconsistentesManual.length} saldos inconsistentes encontrados`,
      count: saldosInconsistentesManual.length,
      severity: saldosInconsistentesManual.length > 0 ? "ERROR" : "INFO",
    });

    // 4. Validar transferencias
    console.log("4️⃣ Validando transferencias...");

    const transferenciasConMontosNegativos = await prisma.transferencia.count({
      where: {
        monto: { lt: 0 },
      },
    });

    results.push({
      test: "Transferencias con montos negativos",
      passed: transferenciasConMontosNegativos === 0,
      details: `${transferenciasConMontosNegativos} transferencias con montos negativos`,
      count: transferenciasConMontosNegativos,
      severity: transferenciasConMontosNegativos > 0 ? "ERROR" : "INFO",
    });

    // 5. Validar registros huérfanos
    console.log("5️⃣ Validando registros huérfanos...");

    // Obtener todos los IDs de puntos de atención válidos
    const puntosAtencionValidos = await prisma.puntoAtencion.findMany({
      select: { id: true },
    });
    const idsValidos = puntosAtencionValidos.map((p) => p.id);

    // Cambios con puntos de atención inexistentes
    const cambiosHuerfanos = await prisma.cambioDivisa.count({
      where: {
        punto_atencion_id: {
          notIn: idsValidos,
        },
      },
    });

    results.push({
      test: "Cambios huérfanos (sin punto de atención)",
      passed: cambiosHuerfanos === 0,
      details: `${cambiosHuerfanos} cambios sin punto de atención válido`,
      count: cambiosHuerfanos,
      severity: cambiosHuerfanos > 0 ? "ERROR" : "INFO",
    });

    // 6. Validar campos USD específicos
    console.log("6️⃣ Validando campos USD...");

    const cambiosUSDConCamposInconsistentes = await prisma.cambioDivisa.count({
      where: {
        AND: [
          {
            OR: [
              { monedaOrigen: { codigo: "USD" } },
              { monedaDestino: { codigo: "USD" } },
            ],
          },
          {
            OR: [
              { usd_entregado_efectivo: { lt: 0 } },
              { usd_entregado_transfer: { lt: 0 } },
            ],
          },
        ],
      },
    });

    results.push({
      test: "Cambios USD con campos negativos",
      passed: cambiosUSDConCamposInconsistentes === 0,
      details: `${cambiosUSDConCamposInconsistentes} cambios USD con campos negativos`,
      count: cambiosUSDConCamposInconsistentes,
      severity: cambiosUSDConCamposInconsistentes > 0 ? "WARNING" : "INFO",
    });

    // Mostrar resultados
    console.log("\n📊 RESULTADOS DE VALIDACIÓN:");
    console.log("=".repeat(50));

    let errores = 0;
    let advertencias = 0;

    results.forEach((result, index) => {
      const icon = result.passed
        ? "✅"
        : result.severity === "ERROR"
        ? "❌"
        : result.severity === "WARNING"
        ? "⚠️"
        : "ℹ️";

      console.log(`${icon} ${result.test}`);
      console.log(`   ${result.details}`);

      if (!result.passed) {
        if (result.severity === "ERROR") errores++;
        else if (result.severity === "WARNING") advertencias++;
      }

      console.log();
    });

    console.log("📈 RESUMEN:");
    console.log(`   Total de pruebas: ${results.length}`);
    console.log(
      `   Pruebas exitosas: ${results.filter((r) => r.passed).length}`
    );
    console.log(`   Errores críticos: ${errores}`);
    console.log(`   Advertencias: ${advertencias}`);

    if (errores > 0) {
      console.log(
        "\n🚨 Se encontraron errores críticos que requieren atención inmediata."
      );
    } else if (advertencias > 0) {
      console.log(
        "\n⚠️ Se encontraron advertencias que deberían ser revisadas."
      );
    } else {
      console.log(
        "\n🎉 ¡Todos los datos pasaron las validaciones de integridad!"
      );
    }
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDataIntegrity()
    .then(() => {
      console.log("\n✅ Validación completada.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Error fatal:", error);
      process.exit(1);
    });
}

export { validateDataIntegrity };
