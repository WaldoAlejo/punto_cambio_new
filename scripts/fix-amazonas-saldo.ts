/**
 * Script para corregir el saldo del punto Amazonas
 * Fecha: 2026-04-01
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CORRECCIÓN DE SALDO - PUNTO AMAZONAS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // 1. Encontrar el punto Amazonas
    const puntoAmazonas = await prisma.puntoAtencion.findFirst({
      where: { 
        nombre: { contains: "AMAZONAS", mode: "insensitive" },
        activo: true 
      },
      select: { id: true, nombre: true },
    });

    if (!puntoAmazonas) {
      console.log("❌ No se encontró el punto Amazonas");
      return;
    }

    console.log(`📍 Punto: ${puntoAmazonas.nombre} (${puntoAmazonas.id})\n`);

    // 2. Obtener moneda USD
    const usd = await prisma.moneda.findUnique({
      where: { codigo: "USD" },
      select: { id: true, codigo: true },
    });

    if (!usd) {
      console.log("❌ No se encontró la moneda USD");
      return;
    }

    // 3. Obtener saldo inicial activo
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda_id: usd.id,
        activo: true,
      },
      select: { cantidad_inicial: true },
    });

    const saldoInicialNum = Number(saldoInicial?.cantidad_inicial || 0);
    console.log(`🏁 Saldo inicial activo: $${saldoInicialNum.toFixed(2)}`);

    // 4. Calcular saldo basado en movimientos (excluyendo SALDO_INICIAL)
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAmazonas.id,
        moneda_id: usd.id,
        tipo_movimiento: { not: "SALDO_INICIAL" },
      },
      select: { monto: true, tipo_movimiento: true, descripcion: true },
    });

    let saldoCalculado = saldoInicialNum;
    let totalIngresos = 0;
    let totalEgresos = 0;

    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      const desc = (mov.descripcion ?? "").toString().toLowerCase();
      
      // Solo contar movimientos de caja (no bancarios)
      if (!/\bbancos?\b/i.test(desc)) {
        saldoCalculado += monto;
        if (monto > 0) totalIngresos += monto;
        else totalEgresos += Math.abs(monto);
      }
    }

    console.log(`📊 Movimientos procesados: ${movimientos.length}`);
    console.log(`   Total ingresos caja: +$${totalIngresos.toFixed(2)}`);
    console.log(`   Total egresos caja: -$${totalEgresos.toFixed(2)}`);
    console.log(`   Saldo calculado: $${saldoCalculado.toFixed(2)}\n`);

    // 5. Obtener saldo actual en tabla
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoAmazonas.id,
          moneda_id: usd.id,
        },
      },
    });

    const saldoTabla = Number(saldoActual?.cantidad || 0);
    console.log(`💰 Saldo actual en tabla: $${saldoTabla.toFixed(2)}`);
    console.log(`   Diferencia: $${(saldoTabla - saldoCalculado).toFixed(2)}\n`);

    // 6. Corregir el saldo
    if (Math.abs(saldoTabla - saldoCalculado) > 0.01) {
      console.log("🔄 Corrigiendo saldo...\n");

      await prisma.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAmazonas.id,
            moneda_id: usd.id,
          },
        },
        update: {
          cantidad: saldoCalculado,
          billetes: saldoCalculado,
          monedas_fisicas: 0,
          updated_at: new Date(),
        },
        create: {
          punto_atencion_id: puntoAmazonas.id,
          moneda_id: usd.id,
          cantidad: saldoCalculado,
          billetes: saldoCalculado,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });

      console.log("✅ Saldo corregido exitosamente:");
      console.log(`   Nuevo saldo: $${saldoCalculado.toFixed(2)}`);
      console.log(`   Billetes: $${saldoCalculado.toFixed(2)}`);
      console.log(`   Monedas: $0.00`);
    } else {
      console.log("✅ El saldo ya está correcto, no se requiere corrección.");
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  CORRECCIÓN COMPLETADA");
    console.log("═══════════════════════════════════════════════════════════════");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
