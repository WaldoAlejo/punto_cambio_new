/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVESTIGACIÓN DETALLADA - ROYAL PACIFIC - 21 DE MARZO 2026
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FECHA_ANALISIS = '2026-03-21';

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║      🔍 INVESTIGACIÓN DETALLADA - ROYAL PACIFIC - 21 MARZO 2026         ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });

  if (!punto) {
    console.log("❌ Punto no encontrado");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (${punto.id})`);
  console.log(`📅 Fecha: ${FECHA_ANALISIS}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ASIGNACIONES DE SALDO INICIAL (Detalle completo)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("1️⃣  ASIGNACIONES DE SALDO INICIAL (Origen y Destino)");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const asignaciones = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      tipo_referencia: 'SALDO_INICIAL',
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: { moneda: true, usuario: true },
    orderBy: { fecha: 'asc' },
  });

  console.log(`Total asignaciones: ${asignaciones.length}\n`);

  for (const asig of asignaciones) {
    console.log(`   🕐 Hora: ${asig.fecha.toISOString()}`);
    console.log(`   💵 Moneda: ${asig.moneda.codigo}`);
    console.log(`   📊 Monto: ${Number(asig.monto).toFixed(2)}`);
    console.log(`   👤 Usuario: ${asig.usuario?.nombre || 'N/A'} (${asig.usuario_id})`);
    console.log(`   📝 Descripción: ${asig.descripcion || 'Sin descripción'}`);
    console.log(`   🔗 ID Movimiento: ${asig.id}`);
    
    // Buscar si hay un cierre diario relacionado
    const cierreRelacionado = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: new Date(`${FECHA_ANALISIS}T00:00:00Z`),
          lt: new Date(`2026-03-22T00:00:00Z`),
        },
      },
    });

    if (cierreRelacionado) {
      console.log(`   📋 Cierre Diario: ${cierreRelacionado.id}`);
      console.log(`      Estado: ${cierreRelacionado.estado}`);
    }
    
    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TRANSFERENCIAS (Detalle completo con origen)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("2️⃣  TRANSFERENCIAS (Origen y Destino detallado)");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  // Transferencias ENTRANTES a Royal Pacific
  console.log("   📥 TRANSFERENCIAS ENTRANTES (hacia Royal Pacific):\n");
  
  const transferenciasEntrantes = await prisma.transferencia.findMany({
    where: {
      destino_id: punto.id,
      estado: 'COMPLETADO',
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: {
      moneda: true,
      origen: true,
      destino: true,
      solicitadoPor: true,
    },
    orderBy: { fecha: 'asc' },
  });

  console.log(`   Total transferencias entrantes: ${transferenciasEntrantes.length}\n`);

  for (const trans of transferenciasEntrantes) {
    console.log(`   🕐 Fecha/Hora: ${trans.fecha.toISOString()}`);
    console.log(`   📄 Número: ${trans.numero_recibo || 'N/A'}`);
    console.log(`   🏦 Origen: ${trans.origen?.nombre || 'N/A'} (${trans.origen_id || 'N/A'})`);
    console.log(`   🏦 Destino: ${trans.destino?.nombre || 'N/A'} (${trans.destino_id})`);
    console.log(`   💵 Moneda: ${trans.moneda.codigo}`);
    console.log(`   💰 Monto: ${Number(trans.monto).toFixed(2)}`);
    console.log(`   👤 Solicitado por: ${trans.solicitadoPor?.nombre || 'N/A'}`);
    console.log(`   📊 Estado: ${trans.estado}`);
    console.log(`   🔗 ID Transferencia: ${trans.id}`);
    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // Transferencias SALIENTES desde Royal Pacific
  console.log("   📤 TRANSFERENCIAS SALIENTES (desde Royal Pacific):\n");
  
  const transferenciasSalientes = await prisma.transferencia.findMany({
    where: {
      origen_id: punto.id,
      estado: 'COMPLETADO',
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: {
      moneda: true,
      origen: true,
      destino: true,
      solicitadoPor: true,
    },
    orderBy: { fecha: 'asc' },
  });

  console.log(`   Total transferencias salientes: ${transferenciasSalientes.length}\n`);

  for (const trans of transferenciasSalientes) {
    console.log(`   🕐 Fecha/Hora: ${trans.fecha.toISOString()}`);
    console.log(`   📄 Número: ${trans.numero_recibo || 'N/A'}`);
    console.log(`   🏦 Origen: ${trans.origen?.nombre || 'N/A'} (${trans.origen_id})`);
    console.log(`   🏦 Destino: ${trans.destino?.nombre || 'N/A'} (${trans.destino_id || 'N/A'})`);
    console.log(`   💵 Moneda: ${trans.moneda.codigo}`);
    console.log(`   💰 Monto: ${Number(trans.monto).toFixed(2)}`);
    console.log(`   👤 Solicitado por: ${trans.solicitadoPor?.nombre || 'N/A'}`);
    console.log(`   📊 Estado: ${trans.estado}`);
    console.log(`   🔗 ID Transferencia: ${trans.id}`);
    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CAMBIOS DE DIVISA (Detalle completo)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("3️⃣  CAMBIOS DE DIVISA (Detalle completo)");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const cambios = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: punto.id,
      estado: 'COMPLETADO',
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
      usuario: true,
    },
    orderBy: { fecha: 'asc' },
  });

  console.log(`Total cambios de divisa: ${cambios.length}\n`);

  for (const cambio of cambios) {
    console.log(`   🕐 Fecha/Hora: ${cambio.fecha.toISOString()}`);
    console.log(`   📄 Recibo: ${cambio.numero_recibo || 'N/A'}`);
    console.log(`   👤 Cliente: ${cambio.cliente || 'N/A'}`);
    console.log(`   👤 Usuario: ${cambio.usuario?.nombre || 'N/A'}`);
    console.log(`   💱 Operación: ${cambio.monedaOrigen.codigo} → ${cambio.monedaDestino.codigo}`);
    console.log(`   💰 Monto Origen: ${Number(cambio.monto_origen).toFixed(2)} ${cambio.monedaOrigen.codigo}`);
    console.log(`   💰 Monto Destino: ${Number(cambio.monto_destino).toFixed(2)} ${cambio.monedaDestino.codigo}`);
    console.log(`   📊 Tasa: ${Number(cambio.tasa_cambio_billetes).toFixed(4)}`);
    console.log(`   💵 Método Pago Origen: ${cambio.metodo_pago_origen}`);
    console.log(`   💵 Método Entrega: ${cambio.metodo_entrega}`);
    console.log(`   💵 USD Recibido Efectivo: ${Number(cambio.usd_recibido_efectivo || 0).toFixed(2)}`);
    console.log(`   💵 USD Entregado Efectivo: ${Number(cambio.usd_entregado_efectivo || 0).toFixed(2)}`);
    console.log(`   🔗 ID Cambio: ${cambio.id}`);

    // Movimientos asociados a este cambio
    const movsCambio = await prisma.movimientoSaldo.findMany({
      where: { referencia_id: cambio.id },
    });

    console.log(`   📊 Movimientos de saldo generados: ${movsCambio.length}`);
    for (const mov of movsCambio) {
      console.log(`      - ${mov.tipo_movimiento}: ${Number(mov.monto).toFixed(2)} (${mov.moneda_id === cambio.moneda_origen_id ? 'Origen' : 'Destino'})`);
    }
    
    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SERVICIOS EXTERNOS (Detalle completo)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("4️⃣  SERVICIOS EXTERNOS (Detalle completo)");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const servicios = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      tipo_referencia: 'SERVICIO_EXTERNO',
      fecha: {
        gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
        lt: new Date(`2026-03-22T05:00:00Z`),
      },
    },
    include: { moneda: true, usuario: true },
    orderBy: { fecha: 'asc' },
  });

  console.log(`Total servicios externos: ${servicios.length}\n`);

  for (const serv of servicios) {
    console.log(`   🕐 Fecha/Hora: ${serv.fecha.toISOString()}`);
    console.log(`   💵 Moneda: ${serv.moneda.codigo}`);
    console.log(`   📊 Tipo: ${serv.tipo_movimiento}`);
    console.log(`   💰 Monto: ${Number(serv.monto).toFixed(2)}`);
    console.log(`   👤 Usuario: ${serv.usuario?.nombre || 'N/A'}`);
    console.log(`   📝 Descripción: ${serv.descripcion || 'Sin descripción'}`);
    console.log(`   🔗 ID Movimiento: ${serv.id}`);
    console.log("   ──────────────────────────────────────────────────────────────────────────\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RESUMEN POR MONEDA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("5️⃣  RESUMEN DETALLADO POR MONEDA");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const monedas = await prisma.moneda.findMany({ where: { activo: true } });

  for (const moneda of monedas) {
    const movs = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: new Date(`${FECHA_ANALISIS}T05:00:00Z`),
          lt: new Date(`2026-03-22T05:00:00Z`),
        },
      },
      orderBy: { fecha: 'asc' },
    });

    if (movs.length === 0) continue;

    console.log(`   💵 ${moneda.codigo} (${movs.length} movimientos):\n`);
    
    let totalIngresos = 0;
    let totalEgresos = 0;

    for (const mov of movs) {
      const monto = Number(mov.monto);
      const hora = mov.fecha.toISOString().substring(11, 19);
      const tipo = mov.tipo_movimiento.padEnd(12);
      const ref = mov.tipo_referencia.padEnd(15);
      
      if (monto > 0) totalIngresos += monto;
      else totalEgresos += Math.abs(monto);
      
      console.log(`      ${hora} | ${tipo} | ${monto.toFixed(2).padStart(10)} | ${ref} | ${mov.descripcion?.substring(0, 30) || ''}`);
    }

    console.log(`      ─────────────────────────────────────────────────────────────────────`);
    console.log(`      Total Ingresos: ${totalIngresos.toFixed(2)}`);
    console.log(`      Total Egresos:  ${totalEgresos.toFixed(2)}`);
    console.log(`      Neto:           ${(totalIngresos - totalEgresos).toFixed(2)}\n`);
  }

  await prisma.$disconnect();
}

main();
