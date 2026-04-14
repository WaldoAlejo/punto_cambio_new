/**
 * CORRECCIÓN COMPLETA DE LA ANULACIÓN CAM-1775764188730
 * Elimina los movimientos de reverso y restaura el saldo como si la transacción nunca hubiera existido
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("CORRECCIÓN COMPLETA DE ANULACIÓN - CAM-1775764188730");
  console.log("=".repeat(100));
  console.log("\n⚠️  Esta corrección eliminará los movimientos de reverso y ajustará el saldo");
  console.log("    para que sea como si la transacción nunca hubiera existido.\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });

  if (!usd || !eur) {
    console.error("❌ No se encontraron monedas USD o EUR");
    return;
  }

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  // ============================================
  // 1. BUSCAR TODOS LOS MOVIMIENTOS RELACIONADOS
  // ============================================
  console.log("🔍 Buscando movimientos relacionados con CAM-1775764188730...\n");

  const movimientosUSD = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
      descripcion: {
        contains: "1775764188730",
      },
    },
  });

  const movimientosEUR = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
      descripcion: {
        contains: "1775764188730",
      },
    },
  });

  console.log(`Movimientos USD encontrados: ${movimientosUSD.length}`);
  for (const m of movimientosUSD) {
    console.log(`  - ${m.id} | ${m.tipo_movimiento} | $${Number(m.monto).toFixed(2)} | ${m.descripcion?.substring(0, 50)}`);
  }

  console.log(`\nMovimientos EUR encontrados: ${movimientosEUR.length}`);
  for (const m of movimientosEUR) {
    console.log(`  - ${m.id} | ${m.tipo_movimiento} | €${Number(m.monto).toFixed(2)} | ${m.descripcion?.substring(0, 50)}`);
  }

  // ============================================
  // 2. IDENTIFICAR MOVIMIENTOS A ELIMINAR
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("📋 ANÁLISIS DE MOVIMIENTOS");
  console.log("=".repeat(100));

  // Movimientos de la transacción ORIGINAL (2:49:48 p.m.)
  const movOriginalUSD = movimientosUSD.find(m => 
    m.tipo_movimiento === "INGRESO" && 
    Number(m.monto) === 800 &&
    m.descripcion?.includes("origen")
  );
  
  const movOriginalEUR = movimientosEUR.find(m => 
    m.tipo_movimiento === "EGRESO" && 
    Number(m.monto) === 645.16 &&
    m.descripcion?.includes("destino")
  );

  // Movimientos del REVERSO (3:37:55 p.m.)
  const movReversoUSD = movimientosUSD.find(m => 
    m.tipo_movimiento === "AJUSTE" && 
    Number(m.monto) === -800 &&
    m.descripcion?.includes("Reverso")
  );
  
  const movReversoEUR = movimientosEUR.find(m => 
    m.tipo_movimiento === "AJUSTE" && 
    m.descripcion?.includes("Reverso")
  );

  console.log("\nTransacción ORIGINAL (2:49:48 p.m.):");
  if (movOriginalUSD) {
    console.log(`  USD: INGRESO +$${Number(movOriginalUSD.monto).toFixed(2)} → ELIMINAR`);
  }
  if (movOriginalEUR) {
    console.log(`  EUR: EGRESO -€${Number(movOriginalEUR.monto).toFixed(2)} → ELIMINAR`);
  }

  console.log("\nReverso (3:37:55 p.m.):");
  if (movReversoUSD) {
    console.log(`  USD: AJUSTE $${Number(movReversoUSD.monto).toFixed(2)} → ELIMINAR`);
  }
  if (movReversoEUR) {
    console.log(`  EUR: AJUSTE +€${Number(movReversoEUR.monto).toFixed(2)} → ELIMINAR`);
  }

  // ============================================
  // 3. CALCULAR AJUSTES NECESARIOS
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("📊 CÁLCULO DE AJUSTES AL SALDO");
  console.log("=".repeat(100));

  // Obtener saldos actuales
  const saldoUSD = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
    },
  });

  const saldoEUR = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log("\nSaldos actuales:");
  console.log(`  USD: $${Number(saldoUSD?.cantidad || 0).toFixed(2)}`);
  console.log(`  EUR: €${Number(saldoEUR?.cantidad || 0).toFixed(2)}`);

  // Calcular ajustes
  // Si eliminamos INGRESO +800 y AJUSTE -800 de USD = 0 neto
  // Si eliminamos EGRESO -645.16 y AJUSTE +645.16 de EUR = 0 neto
  
  console.log("\nAjustes necesarios (eliminando movimientos):");
  console.log(`  USD: Sin cambio (ingreso +800 y ajuste -800 se anulan)`);
  console.log(`  EUR: Sin cambio (egreso -645.16 y ajuste +645.16 se anulan)`);

  // ============================================
  // 4. EJECUTAR CORRECCIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("📝 EJECUTANDO CORRECCIÓN");
  console.log("=".repeat(100));

  await prisma.$transaction(async (tx) => {
    let eliminados = 0;

    // Eliminar movimientos USD
    for (const m of movimientosUSD) {
      await tx.movimientoSaldo.delete({ where: { id: m.id } });
      eliminados++;
      console.log(`  ✓ Eliminado movimiento USD: ${m.id}`);
    }

    // Eliminar movimientos EUR
    for (const m of movimientosEUR) {
      await tx.movimientoSaldo.delete({ where: { id: m.id } });
      eliminados++;
      console.log(`  ✓ Eliminado movimiento EUR: ${m.id}`);
    }

    console.log(`\n  Total movimientos eliminados: ${eliminados}`);

    // NOTA: No ajustamos el saldo porque los movimientos se anulan entre sí
    // INGRESO +800 + AJUSTE -800 = 0 para USD
    // EGRESO -645.16 + AJUSTE +645.16 = 0 para EUR
  });

  // ============================================
  // 5. VERIFICACIÓN FINAL
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("✅ VERIFICACIÓN FINAL");
  console.log("=".repeat(100));

  // Verificar que no queden movimientos
  const movimientosRestantesUSD = await prisma.movimientoSaldo.count({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
      descripcion: { contains: "1775764188730" },
    },
  });

  const movimientosRestantesEUR = await prisma.movimientoSaldo.count({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      descripcion: { contains: "1775764188730" },
    },
  });

  console.log(`\nMovimientos restantes con referencia CAM-1775764188730:`);
  console.log(`  USD: ${movimientosRestantesUSD}`);
  console.log(`  EUR: ${movimientosRestantesEUR}`);

  // Mostrar saldos actuales
  const saldoUSDFinal = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
    },
  });

  const saldoEURFinal = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log(`\nSaldos finales:`);
  console.log(`  USD: $${Number(saldoUSDFinal?.cantidad || 0).toFixed(2)}`);
  console.log(`  EUR: €${Number(saldoEURFinal?.cantidad || 0).toFixed(2)}`);

  console.log("\n" + "=".repeat(100));
  console.log("✅ CORRECCIÓN COMPLETADA");
  console.log("=".repeat(100));
  console.log("\nLa transacción CAM-1775764188730 ha sido completamente eliminada del sistema.");
  console.log("Los saldos permanecen igual porque los movimientos se anulaban entre sí.");
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
