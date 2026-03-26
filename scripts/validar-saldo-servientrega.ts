/**
 * Script para validar y ajustar el saldo de Servientrega
 * Objetivo: Dejar el saldo en 5.92 (5.00 en billetes, 0.92 en monedas)
 */

import prisma from "../server/lib/prisma.js";
import { pool } from "../server/lib/database.js";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VALIDACIÓN SALDO SERVIENTREGA");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Buscar la moneda Servientrega
  const monedaServientrega = await prisma.moneda.findFirst({
    where: { codigo: "SERVIENTREGA" }
  });

  if (!monedaServientrega) {
    console.log("❌ No se encontró la moneda SERVIENTREGA");
    return;
  }

  console.log(`✓ Moneda Servientrega encontrada: ID ${monedaServientrega.id}`);
  console.log(`  Nombre: ${monedaServientrega.nombre}`);
  console.log(`  Símbo: ${monedaServientrega.simbolo}\n`);

  // 2. Buscar el punto de atención donde se hizo la prueba
  // Buscar guías de Servientrega del 25 de marzo de 2026
  const fechaInicio = new Date("2026-03-25T00:00:00.000Z");
  const fechaFin = new Date("2026-03-26T00:00:00.000Z");

  const guias = await prisma.servientregaGuia.findMany({
    where: {
      created_at: {
        gte: fechaInicio,
        lt: fechaFin
      }
    },
    include: {
      puntoAtencion: true
    }
  });

  console.log(`Guías encontradas el 25 de marzo: ${guias.length}`);
  
  for (const guia of guias) {
    console.log(`\n  Guía: ${guia.numero_guia}`);
    console.log(`  Valor: $${guia.valor}`);
    console.log(`  Estado: ${guia.estado}`);
    console.log(`  Punto: ${guia.puntoAtencion?.nombre}`);
    console.log(`  Fecha: ${guia.created_at.toISOString()}`);
  }

  // 3. Buscar saldos de Servientrega en todos los puntos
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("SALDOS ACTUALES DE SERVIENTREGA:");
  console.log("───────────────────────────────────────────────────────────");

  const saldos = await prisma.saldoDivisa.findMany({
    where: { moneda_id: monedaServientrega.id },
    include: { puntoAtencion: true }
  });

  for (const saldo of saldos) {
    console.log(`\n  Punto: ${saldo.puntoAtencion?.nombre || "N/A"}`);
    console.log(`  Saldo: $${saldo.cantidad}`);
    console.log(`  ID: ${saldo.id}`);
  }

  // 4. Buscar movimientos de Servientrega del 25 de marzo
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("MOVIMIENTOS DE SERVIENTREGA (25 de marzo):");
  console.log("───────────────────────────────────────────────────────────");

  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    where: {
      moneda_id: monedaServientrega.id,
      fecha: {
        gte: fechaInicio,
        lt: fechaFin
      }
    },
    include: {
      puntoAtencion: true
    },
    orderBy: { fecha: "asc" }
  });

  console.log(`Total movimientos: ${movimientos.length}\n`);

  for (const mov of movimientos) {
    console.log(`  Tipo: ${mov.tipo}`);
    console.log(`  Monto: $${mov.monto}`);
    console.log(`  Punto: ${mov.puntoAtencion?.nombre}`);
    console.log(`  Descripción: ${mov.descripcion}`);
    console.log(`  Fecha: ${mov.fecha.toISOString()}`);
    console.log("");
  }

  // 5. Calcular el saldo esperado
  console.log("───────────────────────────────────────────────────────────");
  console.log("CÁLCULO DE SALDO ESPERADO:");
  console.log("───────────────────────────────────────────────────────────");
  
  // Buscar movimientos relacionados con la guía de 4.63
  const movimientosGuia = await prisma.servicioExternoMovimiento.findMany({
    where: {
      moneda_id: monedaServientrega.id,
      descripcion: {
        contains: "4.63"
      }
    },
    include: { puntoAtencion: true },
    orderBy: { fecha: "desc" }
  });

  console.log(`\nMovimientos relacionados con guía de 4.63: ${movimientosGuia.length}`);
  
  for (const mov of movimientosGuia) {
    console.log(`\n  Tipo: ${mov.tipo}`);
    console.log(`  Monto: $${mov.monto}`);
    console.log(`  Punto: ${mov.puntoAtencion?.nombre}`);
    console.log(`  Descripción: ${mov.descripcion}`);
    console.log(`  Fecha: ${mov.fecha.toISOString()}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
