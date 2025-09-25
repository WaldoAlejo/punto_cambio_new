#!/usr/bin/env tsx

/**
 * Script de Validación de Integridad de Datos
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
}

async function validateDataIntegrity() {
  console.log("🔍 Iniciando validación de integridad de datos...\n");

  const results: ValidationResult[] = [];

  try {
    // 1. Validar que todos los cambios de divisas tengan campos requeridos
    console.log("1️⃣ Validando cambios de divisas...");

    const cambiosSinDivisasEntregadas = await prisma.cambioDivisa.count({
      where: {
        OR: [
          { divisas_entregadas_total: null },
          { divisas_entregadas_total: 0 },
        ],
      },
    });

    results.push({
      test: "Cambios sin divisas_entregadas_total",
      passed: cambiosSinDivisasEntregadas === 0,
      details: `${cambiosSinDivisasEntregadas} cambios encontrados`,
      count: cambiosSinDivisasEntregadas,
    });

    const cambiosSinDivisasRecibidas = await prisma.cambioDivisa.count({
      where: {
        OR: [{ divisas_recibidas_total: null }, { divisas_recibidas_total: 0 }],
      },
    });

    results.push({
      test: "Cambios sin divisas_recibidas_total",
      passed: cambiosSinDivisasRecibidas === 0,
      details: `${cambiosSinDivisasRecibidas} cambios encontrados`,
      count: cambiosSinDivisasRecibidas,
    });

    // 2. Validar consistencia entre campos USD específicos y divisas_recibidas
    console.log("2️⃣ Validando consistencia de campos USD...");

    const cambiosUSDInconsistentes = await prisma.cambioDivisa.findMany({
      where: {
        AND: [
          {
            OR: [
              { usd_entregado_efectivo: { not: null } },
              { usd_entregado_transfer: { not: null } },
            ],
          },
          {
            NOT: {
              divisas_recibidas_total: {
                equals: prisma.$queryRaw`COALESCE(usd_entregado_efectivo, 0) + COALESCE(usd_entregado_transfer, 0)`,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        numero_recibo: true,
        usd_entregado_efectivo: true,
        usd_entregado_transfer: true,
        divisas_recibidas_total: true,
      },
    });

    results.push({
      test: "Consistencia campos USD vs divisas_recibidas_total",
      passed: cambiosUSDInconsistentes.length === 0,
      details: `${cambiosUSDInconsistentes.length} inconsistencias encontradas`,
      count: cambiosUSDInconsistentes.length,
    });

    // 3. Validar que no haya balances negativos
    console.log("3️⃣ Validando balances negativos...");

    const balancesNegativos = await prisma.saldo.findMany({
      where: {
        OR: [
          { cantidad: { lt: 0 } },
          { billetes: { lt: 0 } },
          { monedas_fisicas: { lt: 0 } },
          { bancos: { lt: 0 } },
        ],
      },
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    results.push({
      test: "Balances negativos",
      passed: balancesNegativos.length === 0,
      details: `${balancesNegativos.length} balances negativos encontrados`,
      count: balancesNegativos.length,
    });

    // 4. Validar transferencias huérfanas
    console.log("4️⃣ Validando transferencias huérfanas...");

    const transferenciasHuerfanas = await prisma.transferencia.count({
      where: {
        OR: [{ origen_id: null }, { destino_id: null }, { moneda_id: null }],
      },
    });

    results.push({
      test: "Transferencias huérfanas",
      passed: transferenciasHuerfanas === 0,
      details: `${transferenciasHuerfanas} transferencias con datos faltantes`,
      count: transferenciasHuerfanas,
    });

    // 5. Validar saldos iniciales duplicados
    console.log("5️⃣ Validando saldos iniciales duplicados...");

    const saldosDuplicados = await prisma.$queryRaw<
      Array<{ punto_atencion_id: string; moneda_id: string; count: bigint }>
    >`
      SELECT punto_atencion_id, moneda_id, COUNT(*) as count
      FROM "SaldoInicial"
      WHERE activo = true
      GROUP BY punto_atencion_id, moneda_id
      HAVING COUNT(*) > 1
    `;

    results.push({
      test: "Saldos iniciales duplicados",
      passed: saldosDuplicados.length === 0,
      details: `${saldosDuplicados.length} combinaciones punto-moneda con múltiples saldos activos`,
      count: saldosDuplicados.length,
    });

    // 6. Validar recibos duplicados
    console.log("6️⃣ Validando recibos duplicados...");

    const recibosDuplicados = await prisma.$queryRaw<
      Array<{ numero_recibo: string; count: bigint }>
    >`
      SELECT numero_recibo, COUNT(*) as count
      FROM "CambioDivisa"
      WHERE numero_recibo IS NOT NULL
      GROUP BY numero_recibo
      HAVING COUNT(*) > 1
    `;

    results.push({
      test: "Recibos duplicados",
      passed: recibosDuplicados.length === 0,
      details: `${recibosDuplicados.length} números de recibo duplicados`,
      count: recibosDuplicados.length,
    });

    // 7. Validar monedas y puntos de atención activos
    console.log("7️⃣ Validando referencias activas...");

    const cambiosConMonedasInactivas = await prisma.cambioDivisa.count({
      where: {
        OR: [
          { monedaOrigen: { activo: false } },
          { monedaDestino: { activo: false } },
        ],
      },
    });

    results.push({
      test: "Cambios con monedas inactivas",
      passed: cambiosConMonedasInactivas === 0,
      details: `${cambiosConMonedasInactivas} cambios con monedas inactivas`,
      count: cambiosConMonedasInactivas,
    });

    const cambiosConPuntosInactivos = await prisma.cambioDivisa.count({
      where: {
        puntoAtencion: { activo: false },
      },
    });

    results.push({
      test: "Cambios con puntos inactivos",
      passed: cambiosConPuntosInactivos === 0,
      details: `${cambiosConPuntosInactivos} cambios con puntos de atención inactivos`,
      count: cambiosConPuntosInactivos,
    });

    // Generar reporte
    console.log("\n" + "=".repeat(80));
    console.log("📋 REPORTE DE VALIDACIÓN DE INTEGRIDAD");
    console.log("=".repeat(80));

    let testsPasados = 0;
    let testsTotal = results.length;

    for (const result of results) {
      const status = result.passed ? "✅ PASÓ" : "❌ FALLÓ";
      console.log(`${status} - ${result.test}`);
      console.log(`   ${result.details}`);

      if (result.passed) {
        testsPasados++;
      } else if (result.count && result.count > 0) {
        console.log(`   ⚠️  Se requiere atención`);
      }
      console.log("");
    }

    console.log(`📊 RESUMEN: ${testsPasados}/${testsTotal} pruebas pasaron`);

    if (testsPasados === testsTotal) {
      console.log("🎉 ¡Todos los tests de integridad pasaron exitosamente!");
    } else {
      console.log(
        "⚠️  Se encontraron problemas de integridad que requieren atención."
      );
    }

    // Mostrar detalles de problemas específicos
    if (balancesNegativos.length > 0) {
      console.log("\n🔍 BALANCES NEGATIVOS ENCONTRADOS:");
      for (const balance of balancesNegativos.slice(0, 10)) {
        console.log(
          `   • ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}:`
        );
        console.log(
          `     Cantidad: ${Number(balance.cantidad).toLocaleString()}`
        );
        console.log(
          `     Billetes: ${Number(balance.billetes).toLocaleString()}`
        );
        console.log(
          `     Monedas: ${Number(balance.monedas_fisicas).toLocaleString()}`
        );
        console.log(`     Bancos: ${Number(balance.bancos).toLocaleString()}`);
      }
    }

    if (cambiosUSDInconsistentes.length > 0) {
      console.log("\n🔍 INCONSISTENCIAS USD ENCONTRADAS:");
      for (const cambio of cambiosUSDInconsistentes.slice(0, 5)) {
        const usdTotal =
          Number(cambio.usd_entregado_efectivo || 0) +
          Number(cambio.usd_entregado_transfer || 0);
        console.log(`   • Recibo: ${cambio.numero_recibo}`);
        console.log(`     USD Total: ${usdTotal.toLocaleString()}`);
        console.log(
          `     Divisas Recibidas: ${Number(
            cambio.divisas_recibidas_total
          ).toLocaleString()}`
        );
        console.log(
          `     Diferencia: ${(
            Number(cambio.divisas_recibidas_total) - usdTotal
          ).toLocaleString()}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar validación
validateDataIntegrity().catch(console.error);
