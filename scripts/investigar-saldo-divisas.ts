/**
 * Script para investigar problemas en asignación de saldos de divisas
 * Específicamente para el caso de Plaza del Valle reportado
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const puntoNombre = process.argv[2] || "Plaza del Valle";
  
  console.log(`🔍 Investigando saldos de divisas para: ${puntoNombre}\n`);

  // 1. Buscar el punto
  const punto = await prisma.puntoAtencion.findFirst({
    where: { 
      nombre: { contains: puntoNombre, mode: 'insensitive' }
    },
  });

  if (!punto) {
    console.error(`❌ No se encontró el punto: ${puntoNombre}`);
    console.log("\nPuntos disponibles:");
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { nombre: true },
      orderBy: { nombre: 'asc' }
    });
    puntos.forEach(p => console.log(`  - ${p.nombre}`));
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Punto encontrado: ${punto.nombre} (ID: ${punto.id})\n`);

  // 2. Buscar moneda EUR
  const eur = await prisma.moneda.findFirst({
    where: { codigo: "EUR" },
  });

  if (!eur) {
    console.error("❌ No se encontró la moneda EUR");
    await prisma.$disconnect();
    return;
  }

  console.log(`💶 Moneda EUR: ${eur.nombre} (ID: ${eur.id})\n`);

  // 3. Obtener saldo actual
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log("📊 Saldo en tabla Saldo:");
  console.log(`   Cantidad: ${saldo ? Number(saldo.cantidad).toFixed(2) : "NO EXISTE"}`);
  console.log(`   Billetes: ${saldo ? Number(saldo.billetes).toFixed(2) : "N/A"}`);
  console.log(`   Monedas: ${saldo ? Number(saldo.monedas_fisicas).toFixed(2) : "N/A"}`);
  console.log(`   Última actualización: ${saldo?.updated_at?.toISOString() || "N/A"}\n`);

  // 4. Obtener saldo inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      activo: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  console.log("📋 Saldo Inicial (activo):");
  console.log(`   Cantidad: ${saldoInicial ? Number(saldoInicial.cantidad_inicial).toFixed(2) : "NO EXISTE"}`);
  console.log(`   Fecha asignación: ${saldoInicial?.fecha_asignacion?.toISOString() || "N/A"}\n`);

  // 5. Obtener historial de saldos (todas las asignaciones)
  const historial = await prisma.historialSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log("📜 Historial de asignaciones:");
  if (historial.length === 0) {
    console.log("   No hay registros");
  } else {
    historial.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h.fecha.toISOString()} - Tipo: ${h.tipo_movimiento} - Anterior: ${Number(h.cantidad_anterior).toFixed(2)} - Incremento: ${Number(h.cantidad_incrementada).toFixed(2)} - Nuevo: ${Number(h.cantidad_nueva).toFixed(2)}`);
      if (h.descripcion) console.log(`      Descripción: ${h.descripcion}`);
    });
  }
  console.log();

  // 6. Obtener movimientos de saldo
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log("📝 Movimientos de saldo:");
  if (movimientos.length === 0) {
    console.log("   No hay registros");
  } else {
    let saldoCalculado = 0;
    movimientos.forEach((m, i) => {
      const desc = m.descripcion || "";
      const esBanco = /\bbancos?\b/i.test(desc.toLowerCase());
      const esCaja = desc.toLowerCase().includes("(caja)");
      
      if (m.tipo_movimiento === "SALDO_INICIAL") {
        saldoCalculado = Number(m.monto);
      } else if (!esBanco || esCaja) {
        saldoCalculado += Number(m.monto);
      }
      
      console.log(`   ${i + 1}. ${m.fecha.toISOString()} - Tipo: ${m.tipo_movimiento} - Monto: ${Number(m.monto).toFixed(2)} - Saldo Ant: ${Number(m.saldo_anterior).toFixed(2)} - Saldo Nuevo: ${Number(m.saldo_nuevo).toFixed(2)}${esBanco && !esCaja ? " [BANCO]" : ""}`);
      if (m.descripcion) console.log(`      Descripción: ${m.descripcion}`);
    });
    console.log(`\n   💰 Saldo calculado desde movimientos: ${saldoCalculado.toFixed(2)} EUR`);
  }
  console.log();

  // 7. Verificar transferencias
  const transferenciasSalida = await prisma.transferencia.findMany({
    where: {
      origen_id: punto.id,
      moneda_id: eur.id,
      estado: { in: ["APROBADO", "EN_TRANSITO"] },
    },
    orderBy: { fecha: "asc" },
  });

  const transferenciasEntrada = await prisma.transferencia.findMany({
    where: {
      destino_id: punto.id,
      moneda_id: eur.id,
      estado: { in: ["APROBADO", "EN_TRANSITO"] },
    },
    orderBy: { fecha: "asc" },
  });

  console.log("🔄 Transferencias:");
  console.log(`   Salidas: ${transferenciasSalida.length}`);
  transferenciasSalida.forEach((t, i) => {
    console.log(`      ${i + 1}. ${t.fecha.toISOString()} - Monto: ${Number(t.monto).toFixed(2)} - Estado: ${t.estado}`);
  });
  
  console.log(`   Entradas: ${transferenciasEntrada.length}`);
  transferenciasEntrada.forEach((t, i) => {
    console.log(`      ${i + 1}. ${t.fecha.toISOString()} - Monto: ${Number(t.monto).toFixed(2)} - Estado: ${t.estado}`);
  });
  console.log();

  // 8. Calcular saldo esperado
  const totalAsignaciones = historial
    .filter(h => h.tipo_movimiento === "INGRESO")
    .reduce((sum, h) => sum + Number(h.cantidad_incrementada), 0);
  
  const totalTransferenciasSalida = transferenciasSalida
    .reduce((sum, t) => sum + Number(t.monto), 0);
    
  const totalTransferenciasEntrada = transferenciasEntrada
    .reduce((sum, t) => sum + Number(t.monto), 0);

  console.log("📊 Resumen:");
  console.log(`   Total asignaciones (historial): ${totalAsignaciones.toFixed(2)} EUR`);
  console.log(`   Total transferencias salida: ${totalTransferenciasSalida.toFixed(2)} EUR`);
  console.log(`   Total transferencias entrada: ${totalTransferenciasEntrada.toFixed(2)} EUR`);
  console.log(`   Saldo esperado: ${(totalAsignaciones - totalTransferenciasSalida + totalTransferenciasEntrada).toFixed(2)} EUR`);
  console.log(`   Saldo en tabla Saldo: ${saldo ? Number(saldo.cantidad).toFixed(2) : "NO EXISTE"} EUR`);
  
  const diferencia = (totalAsignaciones - totalTransferenciasSalida + totalTransferenciasEntrada) - (saldo ? Number(saldo.cantidad) : 0);
  if (Math.abs(diferencia) > 0.01) {
    console.log(`   ⚠️  DIFERENCIA: ${diferencia.toFixed(2)} EUR`);
  } else {
    console.log(`   ✅ Saldos coinciden`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
