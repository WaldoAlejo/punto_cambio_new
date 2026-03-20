/**
 * ✅ VERIFICACIÓN FINAL COMPLETA - Royal Pacific
 * Verifica consistencia en BD, saldos, movimientos y cuadre
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║           ✅ VERIFICACIÓN FINAL COMPLETA - ROYAL PACIFIC                  ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  
  if (!punto) {
    console.log("❌ PUNTO NO ENCONTRADO");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (${punto.id})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. VERIFICAR SALDO USD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("1️⃣  SALDO USD");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const usd = await prisma.moneda.findFirst({ where: { codigo: 'USD' } });
  
  const saldoTabla = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: usd!.id,
      },
    },
  });

  const movimientosUSD = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd!.id,
    },
  });

  const saldoCalculado = movimientosUSD.reduce((s, m) => s + Number(m.monto), 0);
  const saldoBD = Number(saldoTabla?.cantidad || 0);

  console.log(`💵 Saldo en tabla Saldo: ${saldoBD.toFixed(2)}`);
  console.log(`💵 Saldo calculado desde movimientos: ${saldoCalculado.toFixed(2)}`);
  console.log(`🎯 Objetivo esperado: 745.71`);
  
  if (Math.abs(saldoBD - 745.71) < 0.01 && Math.abs(saldoCalculado - 745.71) < 0.01) {
    console.log("✅ SALDO USD CORRECTO\n");
  } else {
    console.log("❌ SALDO USD INCORRECTO\n");
    console.log(`   Diferencia tabla: ${(saldoBD - 745.71).toFixed(2)}`);
    console.log(`   Diferencia calculado: ${(saldoCalculado - 745.71).toFixed(2)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VERIFICAR MOVIMIENTOS DEL 19 DE MARZO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("2️⃣  MOVIMIENTOS USD DEL 19 DE MARZO");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const inicio19 = new Date('2026-03-19T05:00:00Z');
  const fin19 = new Date('2026-03-20T05:00:00Z');

  const movs19 = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd!.id,
      fecha: { gte: inicio19, lt: fin19 },
    },
    orderBy: { fecha: 'asc' },
    include: {
      moneda: true,
    },
  });

  console.log(`Total movimientos del 19: ${movs19.length}\n`);
  console.log("Hora     | Tipo        | Monto      | Saldo Acum | Referencia  | Descripción");
  console.log("─────────┼─────────────┼────────────┼────────────┼─────────────┼──────────────────────────────");

  let saldoAcum = 0;
  let ingresos19 = 0;
  let egresos19 = 0;

  for (const m of movs19) {
    saldoAcum += Number(m.monto);
    if (Number(m.monto) > 0) ingresos19 += Number(m.monto);
    else egresos19 += Math.abs(Number(m.monto));

    const hora = m.fecha.toISOString().split('T')[1].substring(0, 8);
    const tipo = m.tipo_movimiento.padEnd(11);
    const monto = m.monto.toString().padStart(10);
    const saldoStr = saldoAcum.toFixed(2).padStart(10);
    const ref = (m.referencia_id || 'N/A').substring(0, 11);
    const desc = (m.descripcion || '').substring(0, 28);
    console.log(`${hora} | ${tipo} | ${monto} | ${saldoStr} | ${ref} | ${desc}`);
  }

  console.log(`\n📊 Resumen 19 de marzo:`);
  console.log(`   Ingresos: ${ingresos19.toFixed(2)}`);
  console.log(`   Egresos: ${egresos19.toFixed(2)}`);
  console.log(`   Neto: ${(ingresos19 - egresos19).toFixed(2)}`);

  // Verificar que cada cambio tenga sus 2 movimientos
  const cambios19 = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: { gte: inicio19, lt: fin19 },
    },
  });

  console.log(`\n📋 Verificación de cambios del 19:`);
  let cambiosCorrectos = 0;
  
  for (const c of cambios19) {
    const movsCambio = movs19.filter(m => m.referencia_id === c.id);
    const tieneIngreso = movsCambio.some(m => Number(m.monto) > 0);
    const tieneEgreso = movsCambio.some(m => Number(m.monto) < 0);
    const completo = tieneIngreso && tieneEgreso;
    
    if (completo) cambiosCorrectos++;
    
    console.log(`   ${c.id.substring(0, 8)}: ING:${tieneIngreso ? '✅' : '❌'} EGR:${tieneEgreso ? '✅' : '❌'} ${completo ? '✅' : '❌'}`);
  }

  console.log(`\n   Cambios correctos: ${cambiosCorrectos}/${cambios19.length}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. VERIFICAR OTRAS MONEDAS IMPORTANTES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("3️⃣  OTRAS MONEDAS - CONSISTENCIA");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const monedas = await prisma.moneda.findMany({ where: { activo: true } });
  
  console.log("Moneda | En Tabla   | Calculado  | Diferencia | Estado");
  console.log("───────┼────────────┼────────────┼────────────┼─────────");

  for (const moneda of monedas) {
    const saldoM = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
    });

    const movsM = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
    });

    const calcM = movsM.reduce((s, m) => s + Number(m.monto), 0);
    const tablaM = Number(saldoM?.cantidad || 0);
    const diffM = Math.abs(tablaM - calcM);
    const estadoM = diffM < 0.01 ? '✅' : '❌';

    if (tablaM !== 0 || calcM !== 0) {
      console.log(
        `${moneda.codigo.padEnd(6)} | ${tablaM.toFixed(2).padStart(10)} | ${calcM.toFixed(2).padStart(10)} | ${diffM.toFixed(2).padStart(10)} | ${estadoM}`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. VERIFICAR CUADRE DE CAJA DEL 19
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("4️⃣  CUADRE DE CAJA DEL 19 DE MARZO");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const cuadre19 = await prisma.cuadreCaja.findFirst({
    where: {
      punto_atencion_id: punto.id,
      fecha: { gte: inicio19, lt: fin19 },
    },
    include: {
      detalles: {
        include: { moneda: true },
      },
    },
  });

  if (cuadre19) {
    console.log(`Estado: ${cuadre19.estado}`);
    console.log(`Total ingresos: ${cuadre19.total_ingresos}`);
    console.log(`Total egresos: ${cuadre19.total_egresos}`);
    
    const detalleUSD = cuadre19.detalles.find(d => d.moneda?.codigo === 'USD');
    if (detalleUSD) {
      console.log(`\n📋 Detalle USD:`);
      console.log(`   Saldo apertura: ${detalleUSD.saldo_apertura}`);
      console.log(`   Saldo cierre (teórico): ${detalleUSD.saldo_cierre}`);
      console.log(`   Conteo físico: ${detalleUSD.conteo_fisico}`);
      console.log(`   Diferencia: ${detalleUSD.diferencia}`);
    }
  } else {
    console.log("⚠️  No hay cuadre de caja para el 19 de marzo");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. VERIFICAR TOTALES GLOBALES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("5️⃣  TOTALES GLOBALES");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const totalMovs = await prisma.movimientoSaldo.count({
    where: { punto_atencion_id: punto.id },
  });

  const totalCambios = await prisma.cambioDivisa.count({
    where: { punto_atencion_id: punto.id },
  });

  const totalTransferencias = await prisma.transferencia.count({
    where: { OR: [{ origen_id: punto.id }, { destino_id: punto.id }] },
  });

  console.log(`Total movimientos de saldo: ${totalMovs}`);
  console.log(`Total cambios de divisa: ${totalCambios}`);
  console.log(`Total transferencias: ${totalTransferencias}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                         📊 RESUMEN FINAL                                  ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const todoCorrecto = 
    Math.abs(saldoBD - 745.71) < 0.01 && 
    Math.abs(saldoCalculado - 745.71) < 0.01 &&
    cambiosCorrectos === cambios19.length;

  console.log(`✅ Saldo USD en tabla: ${saldoBD.toFixed(2)}`);
  console.log(`✅ Saldo USD calculado: ${saldoCalculado.toFixed(2)}`);
  console.log(`✅ Objetivo: 745.71`);
  console.log(`✅ Cambios del 19 correctos: ${cambiosCorrectos}/${cambios19.length}`);

  if (todoCorrecto) {
    console.log("\n🎉 TODO ESTÁ CORRECTO - El sistema está listo para usar");
    console.log("💵 El operador verá: $745.71 en su saldo USD");
  } else {
    console.log("\n⚠️  HAY PROBLEMAS PENDIENTES - Revisar arriba");
  }

  console.log("\n════════════════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main();
