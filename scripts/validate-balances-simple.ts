#!/usr/bin/env tsx

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

async function validarBalancesSimple() {
  console.log(
    "🔍 Validando consistencia de balances (versión simplificada)...\n"
  );

  try {
    // Obtener todos los balances actuales
    console.log("📊 Obteniendo balances...");
    const balances = await prisma.saldo.findMany({
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true, nombre: true } },
      },
    });

    console.log(`📊 Encontrados ${balances.length} balances...\n`);

    let problemasEncontrados = 0;
    let balancesAnalizados = 0;

    for (const balance of balances.slice(0, 10)) {
      // Solo los primeros 10 para prueba
      balancesAnalizados++;
      console.log(
        `🏢 ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}`
      );

      const saldoActual = Number(balance.cantidad);
      console.log(`   💰 Saldo actual: ${saldoActual.toLocaleString()}`);

      // 1. Verificar saldo inicial
      console.log("   🔍 Verificando saldo inicial...");
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
        },
      });

      let saldoEsperado = Number(saldoInicial?.cantidad || 0);
      console.log(`   📈 Saldo inicial: ${saldoEsperado.toLocaleString()}`);

      // 2. Verificar cambios de divisas (solo contar)
      console.log("   🔍 Contando cambios de divisas...");
      const cambiosCount = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_destino_id: balance.moneda_id,
          estado: "COMPLETADO",
        },
      });
      console.log(`   🔄 Cambios encontrados: ${cambiosCount}`);

      // 3. Verificar transferencias (solo contar)
      console.log("   🔍 Contando transferencias...");
      const transferenciasOutCount = await prisma.transferencia.count({
        where: {
          origen_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "COMPLETADA",
        },
      });

      const transferenciasInCount = await prisma.transferencia.count({
        where: {
          destino_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "COMPLETADA",
        },
      });

      console.log(`   📤 Transferencias salientes: ${transferenciasOutCount}`);
      console.log(`   📥 Transferencias entrantes: ${transferenciasInCount}`);

      console.log(`   ✅ Balance analizado\n`);
    }

    console.log(`\n📋 Resumen:`);
    console.log(`   - Balances analizados: ${balancesAnalizados}`);
    console.log(`   - Total en BD: ${balances.length}`);
    console.log(`   - Problemas encontrados: ${problemasEncontrados}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error durante la validación:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

validarBalancesSimple();
