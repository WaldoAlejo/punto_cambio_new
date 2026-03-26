/**
 * Script para ajustar el saldo de Servientrega en EL BOSQUE
 * Objetivo: Dejar el saldo en 5.92 (5.00 en billetes, 0.92 en monedas)
 */

import prisma from "../server/lib/prisma.js";
import { pool } from "../server/lib/database.js";
import { ServicioExterno } from "@prisma/client";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AJUSTE SALDO SERVIENTREGA - EL BOSQUE");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Buscar punto EL BOSQUE
  const punto = await prisma.puntoAtencion.findFirst({
    where: { 
      nombre: { contains: "BOSQUE", mode: "insensitive" }
    }
  });
  
  if (!punto) {
    console.log("❌ No se encontró punto EL BOSQUE");
    return;
  }
  console.log(`✓ Punto encontrado: ${punto.nombre} (ID: ${punto.id})`);

  // 2. Buscar moneda USD
  const monedaUSD = await prisma.moneda.findFirst({
    where: { codigo: "USD" }
  });

  if (!monedaUSD) {
    console.log("❌ No se encontró moneda USD");
    return;
  }
  console.log(`✓ Moneda USD encontrada (ID: ${monedaUSD.id})`);

  // 3. Buscar saldo actual de Servientrega
  const saldoActual = await prisma.servicioExternoSaldo.findFirst({
    where: {
      punto_atencion_id: punto.id,
      servicio: ServicioExterno.SERVIENTREGA,
      moneda_id: monedaUSD.id
    }
  });

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("SALDO ACTUAL SERVIENTREGA:");
  console.log("───────────────────────────────────────────────────────────");
  
  if (saldoActual) {
    console.log(`  ID: ${saldoActual.id}`);
    console.log(`  Billetes: ${saldoActual.billetes} (tipo: ${typeof saldoActual.billetes})`);
    console.log(`  Monedas físicas: ${saldoActual.monedas_fisicas} (tipo: ${typeof saldoActual.monedas_fisicas})`);
    console.log(`  Cantidad: ${saldoActual.cantidad} (tipo: ${typeof saldoActual.cantidad})`);
  } else {
    console.log("  No existe registro de saldo");
  }

  // 4. Convertir valores a números
  const billetesActuales = Number(saldoActual?.billetes ?? 0);
  const monedasActuales = Number(saldoActual?.monedas_fisicas ?? 0);
  const totalActual = billetesActuales + monedasActuales;

  const billetesDeseados = 5.00;
  const monedasDeseadas = 0.92;
  const totalDeseado = billetesDeseados + monedasDeseadas;

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("AJUSTE REQUERIDO:");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Actual: ${totalActual.toFixed(2)} (Billetes: ${billetesActuales.toFixed(2)}, Monedas: ${monedasActuales.toFixed(2)})`);
  console.log(`  Deseado: ${totalDeseado.toFixed(2)} (Billetes: ${billetesDeseados.toFixed(2)}, Monedas: ${monedasDeseadas.toFixed(2)})`);
  console.log(`  Diferencia: ${(totalDeseado - totalActual).toFixed(2)}`);

  // 5. Realizar el ajuste
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("REALIZANDO AJUSTE...");
  console.log("───────────────────────────────────────────────────────────");

  if (saldoActual) {
    // Actualizar saldo existente
    const saldoActualizado = await prisma.servicioExternoSaldo.update({
      where: { id: saldoActual.id },
      data: {
        billetes: billetesDeseados,
        monedas_fisicas: monedasDeseadas,
        cantidad: totalDeseado,
        updated_at: new Date()
      }
    });

    console.log("✓ Saldo actualizado correctamente");
    console.log(`  Nuevos billetes: ${saldoActualizado.billetes}`);
    console.log(`  Nuevas monedas físicas: ${saldoActualizado.monedas_fisicas}`);
    console.log(`  Nueva cantidad: ${saldoActualizado.cantidad}`);
  } else {
    // Crear nuevo saldo
    const nuevoSaldo = await prisma.servicioExternoSaldo.create({
      data: {
        punto_atencion_id: punto.id,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: monedaUSD.id,
        billetes: billetesDeseados,
        monedas_fisicas: monedasDeseadas,
        cantidad: totalDeseado,
        updated_at: new Date()
      }
    });

    console.log("✓ Nuevo saldo creado correctamente");
    console.log(`  ID: ${nuevoSaldo.id}`);
    console.log(`  Billetes: ${nuevoSaldo.billetes}`);
    console.log(`  Monedas físicas: ${nuevoSaldo.monedas_fisicas}`);
    console.log(`  Cantidad: ${nuevoSaldo.cantidad}`);
  }

  // 6. Verificar resultado
  const saldoFinal = await prisma.servicioExternoSaldo.findFirst({
    where: {
      punto_atencion_id: punto.id,
      servicio: ServicioExterno.SERVIENTREGA,
      moneda_id: monedaUSD.id
    }
  });

  const billetesFinal = Number(saldoFinal?.billetes ?? 0);
  const monedasFinal = Number(saldoFinal?.monedas_fisicas ?? 0);
  const totalFinal = billetesFinal + monedasFinal;

  console.log("\n───────────────────────────────────────────────────────────");
  console.log("RESULTADO FINAL:");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Billetes: ${billetesFinal.toFixed(2)}`);
  console.log(`  Monedas: ${monedasFinal.toFixed(2)}`);
  console.log(`  Total: ${totalFinal.toFixed(2)}`);
  
  if (Math.abs(totalFinal - totalDeseado) < 0.01) {
    console.log("\n✅ Saldo ajustado correctamente a 5.92");
  } else {
    console.log("\n⚠️ El saldo no coincide con el valor deseado");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
