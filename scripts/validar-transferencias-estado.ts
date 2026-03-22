/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VALIDACIÓN DE TRANSFERENCIAS - ESTADO Y MOVIMIENTOS
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FECHA_ANALISIS = '2026-03-21';

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║      🔍 VALIDACIÓN DE TRANSFERENCIAS - ROYAL PACIFIC - 21 MARZO          ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });

  if (!punto) {
    console.log("❌ Punto no encontrado");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre}\n`);

  // 1. TODAS LAS TRANSFERENCIAS HACIA ROYAL PACIFIC (sin importar estado)
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("1️⃣  TODAS LAS TRANSFERENCIAS HACIA ROYAL PACIFIC (21 de marzo)");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const todasTransferencias = await prisma.transferencia.findMany({
    where: {
      destino_id: punto.id,
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: {
      moneda: true,
      origen: true,
    },
    orderBy: { fecha: 'asc' },
  });

  console.log(`Total transferencias encontradas: ${todasTransferencias.length}\n`);

  for (const trans of todasTransferencias) {
    console.log(`   🕐 Fecha/Hora: ${trans.fecha.toISOString()}`);
    console.log(`   📄 Número: ${trans.numero_recibo || 'N/A'}`);
    console.log(`   🏦 Origen: ${trans.origen?.nombre || 'N/A'}`);
    console.log(`   💵 Moneda: ${trans.moneda.codigo}`);
    console.log(`   💰 Monto: ${Number(trans.monto).toFixed(2)}`);
    console.log(`   📊 ESTADO: ${trans.estado}`);
    console.log(`   👤 Solicitado por: ${trans.solicitado_por}`);
    console.log(`   👤 Aprobado por: ${trans.aprobado_por || 'N/A'}`);
    console.log(`   👤 Aceptado por: ${trans.aceptado_por || 'N/A'}`);
    console.log(`   🔗 ID: ${trans.id}`);

    // Verificar si tiene movimientos de saldo asociados
    const movs = await prisma.movimientoSaldo.findMany({
      where: { referencia_id: trans.id },
    });

    console.log(`   💼 Movimientos de saldo: ${movs.length}`);
    if (movs.length > 0) {
      for (const mov of movs) {
        console.log(`      - ${mov.tipo_movimiento}: ${Number(mov.monto).toFixed(2)} (${mov.fecha.toISOString()})`);
      }
    }

    // Verificar inconsistencias
    if (trans.estado === 'COMPLETADO' && movs.length === 0) {
      console.log(`   🔴 INCONSISTENCIA: Transferencia COMPLETADA pero SIN movimientos de saldo`);
    } else if (trans.estado === 'PENDIENTE' && movs.length > 0) {
      console.log(`   🔴 INCONSISTENCIA: Transferencia PENDIENTE pero CON movimientos de saldo`);
    } else if (trans.estado === 'COMPLETADO' && movs.length > 0) {
      console.log(`   ✅ OK: Transferencia completada con movimientos`);
    }

    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // 2. TRANSFERENCIAS QUE DEBERÍAN APARECER PARA ACEPTAR
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("2️⃣  TRANSFERENCIAS QUE DEBERÍAN APARECER PARA ACEPTAR");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const paraAceptar = await prisma.transferencia.findMany({
    where: {
      destino_id: punto.id,
      estado: { in: ['PENDIENTE', 'APROBADO', 'EN_TRANSITO'] },
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: {
      moneda: true,
      origen: true,
    },
    orderBy: { fecha: 'asc' },
  });

  if (paraAceptar.length === 0) {
    console.log("   No hay transferencias pendientes de aceptar.\n");
  } else {
    console.log(`   Total: ${paraAceptar.length}\n`);
    for (const trans of paraAceptar) {
      console.log(`   📄 ${trans.numero_recibo} - ${trans.moneda.codigo} ${Number(trans.monto).toFixed(2)} - Estado: ${trans.estado}`);
    }
  }

  // 3. RESUMEN POR ESTADO
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("3️⃣  RESUMEN POR ESTADO");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const porEstado: Record<string, typeof todasTransferencias> = {};
  for (const t of todasTransferencias) {
    if (!porEstado[t.estado]) porEstado[t.estado] = [];
    porEstado[t.estado].push(t);
  }

  for (const [estado, transferencias] of Object.entries(porEstado)) {
    console.log(`   ${estado}: ${transferencias.length}`);
    for (const t of transferencias) {
      console.log(`      - ${t.numero_recibo}: ${t.moneda.codigo} ${Number(t.monto).toFixed(2)}`);
    }
  }

  await prisma.$disconnect();
}

main();
