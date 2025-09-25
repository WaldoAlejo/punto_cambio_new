#!/usr/bin/env tsx

/**
 * Script para calcular el balance total completo del sistema
 * Incluye: Cambios de divisas, Servicios externos y Transferencias
 *
 * Uso: npx tsx scripts/calcular-balance-completo.ts
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

interface BalanceMoneda {
  monedaId: string;
  codigo: string;
  nombre: string;
  balance: Decimal;
  detalles: {
    cambiosDivisasOrigen: Decimal;
    cambiosDivisasDestino: Decimal;
    serviciosExternosIngresos: Decimal;
    serviciosExternosEgresos: Decimal;
    transferenciasNetas: Decimal;
  };
}

interface ResumenGeneral {
  totalCambiosDivisas: number;
  totalServiciosExternos: number;
  totalTransferencias: number;
  totalPuntosActivos: number;
  totalMonedasActivas: number;
}

async function obtenerResumenGeneral(): Promise<ResumenGeneral> {
  console.log("📊 Calculando resumen general...");

  const [
    cambiosDivisas,
    serviciosExternos,
    transferencias,
    puntosActivos,
    monedasActivas,
  ] = await Promise.all([
    prisma.cambioDivisa.count({
      where: { estado: "COMPLETADO" },
    }),
    prisma.servicioExternoMovimiento.count(),
    prisma.transferencia.count({
      where: { estado: "APROBADO" },
    }),
    prisma.puntoAtencion.count({
      where: { activo: true },
    }),
    prisma.moneda.count({
      where: { activo: true },
    }),
  ]);

  return {
    totalCambiosDivisas: cambiosDivisas,
    totalServiciosExternos: serviciosExternos,
    totalTransferencias: transferencias,
    totalPuntosActivos: puntosActivos,
    totalMonedasActivas: monedasActivas,
  };
}

async function calcularBalancePorMoneda(): Promise<BalanceMoneda[]> {
  console.log("💰 Calculando balance por moneda...");

  // Obtener todas las monedas activas
  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    orderBy: { codigo: "asc" },
  });

  const balances: BalanceMoneda[] = [];

  for (const moneda of monedas) {
    console.log(`   Procesando ${moneda.codigo}...`);

    // 1. Cambios de divisas - moneda origen (salidas)
    const cambiosOrigen = await prisma.cambioDivisa.aggregate({
      where: {
        moneda_origen_id: moneda.id,
        estado: "COMPLETADO",
      },
      _sum: {
        monto_origen: true,
      },
    });

    // 2. Cambios de divisas - moneda destino (entradas)
    const cambiosDestino = await prisma.cambioDivisa.aggregate({
      where: {
        moneda_destino_id: moneda.id,
        estado: "COMPLETADO",
      },
      _sum: {
        monto_destino: true,
      },
    });

    // 3. Servicios externos - ingresos
    const serviciosIngresos = await prisma.servicioExternoMovimiento.aggregate({
      where: {
        moneda_id: moneda.id,
        tipo_movimiento: "INGRESO",
      },
      _sum: {
        monto: true,
      },
    });

    // 4. Servicios externos - egresos
    const serviciosEgresos = await prisma.servicioExternoMovimiento.aggregate({
      where: {
        moneda_id: moneda.id,
        tipo_movimiento: "EGRESO",
      },
      _sum: {
        monto: true,
      },
    });

    // 5. Transferencias (no afectan balance total, solo redistribuyen)
    // Las incluimos para completitud pero suman 0 al balance total
    const transferenciasNetas = new Decimal(0);

    // Calcular totales
    const cambiosDivisasOrigen =
      cambiosOrigen._sum.monto_origen || new Decimal(0);
    const cambiosDivisasDestino =
      cambiosDestino._sum.monto_destino || new Decimal(0);
    const serviciosExternosIngresos =
      serviciosIngresos._sum.monto || new Decimal(0);
    const serviciosExternosEgresos =
      serviciosEgresos._sum.monto || new Decimal(0);

    // Balance total = -salidas + entradas + ingresos - egresos
    const balance = cambiosDivisasDestino
      .minus(cambiosDivisasOrigen)
      .plus(serviciosExternosIngresos)
      .minus(serviciosExternosEgresos);

    // Solo incluir monedas con movimientos
    if (
      !balance.equals(0) ||
      !cambiosDivisasOrigen.equals(0) ||
      !cambiosDivisasDestino.equals(0) ||
      !serviciosExternosIngresos.equals(0) ||
      !serviciosExternosEgresos.equals(0)
    ) {
      balances.push({
        monedaId: moneda.id,
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        balance,
        detalles: {
          cambiosDivisasOrigen: cambiosDivisasOrigen.negated(), // Mostrar como negativo
          cambiosDivisasDestino,
          serviciosExternosIngresos,
          serviciosExternosEgresos: serviciosExternosEgresos.negated(), // Mostrar como negativo
          transferenciasNetas,
        },
      });
    }
  }

  return balances.sort((a, b) => b.balance.minus(a.balance).toNumber());
}

async function calcularBalancePorPunto() {
  console.log("🏢 Calculando balance por punto de atención...");

  const puntos = await prisma.puntoAtencion.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  const balancesPorPunto = [];

  for (const punto of puntos) {
    console.log(`   Procesando ${punto.nombre}...`);

    // Cambios de divisas en este punto
    const cambiosDivisas = await prisma.cambioDivisa.count({
      where: {
        punto_atencion_id: punto.id,
        estado: "COMPLETADO",
      },
    });

    // Servicios externos en este punto
    const serviciosExternos = await prisma.servicioExternoMovimiento.count({
      where: {
        punto_atencion_id: punto.id,
      },
    });

    // Transferencias desde este punto
    const transferenciasOrigen = await prisma.transferencia.count({
      where: {
        origen_id: punto.id,
        estado: "APROBADO",
      },
    });

    // Transferencias hacia este punto
    const transferenciasDestino = await prisma.transferencia.count({
      where: {
        destino_id: punto.id,
        estado: "APROBADO",
      },
    });

    if (
      cambiosDivisas > 0 ||
      serviciosExternos > 0 ||
      transferenciasOrigen > 0 ||
      transferenciasDestino > 0
    ) {
      balancesPorPunto.push({
        punto: punto.nombre,
        cambiosDivisas,
        serviciosExternos,
        transferenciasOrigen,
        transferenciasDestino,
        totalMovimientos:
          cambiosDivisas +
          serviciosExternos +
          transferenciasOrigen +
          transferenciasDestino,
      });
    }
  }

  return balancesPorPunto.sort(
    (a, b) => b.totalMovimientos - a.totalMovimientos
  );
}

function mostrarResumenGeneral(resumen: ResumenGeneral) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN GENERAL DEL SISTEMA");
  console.log("=".repeat(60));
  console.log(
    `📈 Total cambios de divisas completados: ${resumen.totalCambiosDivisas}`
  );
  console.log(`🔄 Total servicios externos: ${resumen.totalServiciosExternos}`);
  console.log(
    `↔️  Total transferencias aprobadas: ${resumen.totalTransferencias}`
  );
  console.log(`🏢 Puntos de atención activos: ${resumen.totalPuntosActivos}`);
  console.log(`💱 Monedas configuradas: ${resumen.totalMonedasActivas}`);
}

function mostrarBalancePorMoneda(balances: BalanceMoneda[]) {
  console.log("\n" + "=".repeat(60));
  console.log("💰 BALANCE FINAL POR MONEDA");
  console.log("=".repeat(60));

  let totalPositivo = new Decimal(0);
  let totalNegativo = new Decimal(0);

  balances.forEach((balance) => {
    const estado = balance.balance.greaterThan(0)
      ? "🟢 GANANCIA"
      : balance.balance.lessThan(0)
      ? "🔴 PÉRDIDA"
      : "⚪ NEUTRO";

    console.log(`\n${balance.codigo} (${balance.nombre})`);
    console.log(`   Balance Total: ${balance.balance.toFixed(2)} - ${estado}`);

    if (
      !balance.detalles.cambiosDivisasOrigen.equals(0) ||
      !balance.detalles.cambiosDivisasDestino.equals(0)
    ) {
      console.log(`   📊 Cambios de divisas:`);
      console.log(
        `      Salidas (origen): ${balance.detalles.cambiosDivisasOrigen.toFixed(
          2
        )}`
      );
      console.log(
        `      Entradas (destino): ${balance.detalles.cambiosDivisasDestino.toFixed(
          2
        )}`
      );
    }

    if (
      !balance.detalles.serviciosExternosIngresos.equals(0) ||
      !balance.detalles.serviciosExternosEgresos.equals(0)
    ) {
      console.log(`   🔄 Servicios externos:`);
      console.log(
        `      Ingresos: ${balance.detalles.serviciosExternosIngresos.toFixed(
          2
        )}`
      );
      console.log(
        `      Egresos: ${balance.detalles.serviciosExternosEgresos.toFixed(2)}`
      );
    }

    if (balance.balance.greaterThan(0)) {
      totalPositivo = totalPositivo.plus(balance.balance);
    } else if (balance.balance.lessThan(0)) {
      totalNegativo = totalNegativo.plus(balance.balance.abs());
    }
  });

  console.log("\n" + "-".repeat(40));
  console.log(`🟢 Total ganancias: ${totalPositivo.toFixed(2)}`);
  console.log(`🔴 Total pérdidas: ${totalNegativo.negated().toFixed(2)}`);
  console.log(
    `📊 Balance neto: ${totalPositivo.minus(totalNegativo).toFixed(2)}`
  );
}

function mostrarBalancePorPunto(balancesPorPunto: any[]) {
  console.log("\n" + "=".repeat(60));
  console.log("🏢 ACTIVIDAD POR PUNTO DE ATENCIÓN");
  console.log("=".repeat(60));

  balancesPorPunto.forEach((punto) => {
    console.log(`\n${punto.punto}:`);
    console.log(`   📈 Cambios de divisas: ${punto.cambiosDivisas}`);
    console.log(`   🔄 Servicios externos: ${punto.serviciosExternos}`);
    console.log(
      `   ↗️  Transferencias enviadas: ${punto.transferenciasOrigen}`
    );
    console.log(
      `   ↘️  Transferencias recibidas: ${punto.transferenciasDestino}`
    );
    console.log(`   📊 Total movimientos: ${punto.totalMovimientos}`);
  });
}

async function main() {
  try {
    console.log("🚀 Iniciando cálculo de balance completo...\n");

    // 1. Resumen general
    const resumenGeneral = await obtenerResumenGeneral();
    mostrarResumenGeneral(resumenGeneral);

    // 2. Balance por moneda (lo más importante)
    const balancesPorMoneda = await calcularBalancePorMoneda();
    mostrarBalancePorMoneda(balancesPorMoneda);

    // 3. Balance por punto
    const balancesPorPunto = await calcularBalancePorPunto();
    mostrarBalancePorPunto(balancesPorPunto);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Cálculo completado exitosamente");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error al calcular el balance:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

export { main as calcularBalanceCompleto };
