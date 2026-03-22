/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVESTIGACIÓN TRANSFERENCIAS FALTANTES - COP Y CAD
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║      🔍 INVESTIGACIÓN TRANSFERENCIAS FALTANTES - COP Y CAD              ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const royalPacific = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  
  const amazonas = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'AMAZONAS', mode: 'insensitive' } }
  });

  const cop = await prisma.moneda.findFirst({ where: { codigo: 'COP' } });
  const cad = await prisma.moneda.findFirst({ where: { codigo: 'CAD' } });

  console.log(`📍 Royal Pacific ID: ${royalPacific?.id}`);
  console.log(`📍 Amazonas ID: ${amazonas?.id}\n`);

  // 1. BUSCAR TRANSFERENCIA COP 250000 DESDE AMAZONAS
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("1️⃣  BUSCANDO TRANSFERENCIA COP 250,000 DESDE AMAZONAS");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const transferenciasCOP = await prisma.transferencia.findMany({
    where: {
      origen_id: amazonas?.id,
      destino_id: royalPacific?.id,
      moneda_id: cop?.id,
      monto: 250000,
      fecha: {
        gte: new Date('2026-03-21T05:00:00Z'),
        lt: new Date('2026-03-22T05:00:00Z'),
      },
    },
    include: { moneda: true, origen: true, destino: true },
  });

  console.log(`   Transferencias COP 250000 encontradas: ${transferenciasCOP.length}\n`);

  if (transferenciasCOP.length === 0) {
    console.log("   🔴 NO SE ENCONTRÓ LA TRANSFERENCIA EN LA TABLA Transferencia\n");
    
    // Buscar cualquier transferencia COP desde Amazonas ese día
    const todasCOP = await prisma.transferencia.findMany({
      where: {
        origen_id: amazonas?.id,
        moneda_id: cop?.id,
        fecha: {
          gte: new Date('2026-03-21T05:00:00Z'),
          lt: new Date('2026-03-22T05:00:00Z'),
        },
      },
      include: { moneda: true },
    });
    
    console.log(`   Otras transferencias COP desde Amazonas: ${todasCOP.length}`);
    for (const t of todasCOP) {
      console.log(`      - ${t.numero_recibo}: ${Number(t.monto).toFixed(2)} - Estado: ${t.estado} - Destino: ${t.destino_id}`);
    }
  } else {
    for (const t of transferenciasCOP) {
      console.log(`   ✅ Encontrada: ${t.numero_recibo}`);
      console.log(`      Estado: ${t.estado}`);
      console.log(`      Monto: ${Number(t.monto).toFixed(2)}`);
    }
  }

  // Ver movimientos de saldo COP
  const movsCOP = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific?.id,
      moneda_id: cop?.id,
      tipo_referencia: { in: ['TRANSFERENCIA', 'TRANSFER'] },
      fecha: {
        gte: new Date('2026-03-21T05:00:00Z'),
        lt: new Date('2026-03-22T05:00:00Z'),
      },
    },
  });

  console.log(`\n   Movimientos de saldo COP encontrados: ${movsCOP.length}`);
  for (const m of movsCOP) {
    console.log(`      - ${m.tipo_movimiento}: ${Number(m.monto).toFixed(2)} - Ref: ${m.referencia_id?.substring(0,20)}...`);
  }

  // 2. BUSCAR TRANSFERENCIA CAD 140 DESDE AMAZONAS
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("2️⃣  BUSCANDO TRANSFERENCIA CAD 140 DESDE AMAZONAS");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const transferenciasCAD = await prisma.transferencia.findMany({
    where: {
      origen_id: amazonas?.id,
      destino_id: royalPacific?.id,
      moneda_id: cad?.id,
      monto: 140,
      fecha: {
        gte: new Date('2026-03-21T05:00:00Z'),
        lt: new Date('2026-03-22T05:00:00Z'),
      },
    },
    include: { moneda: true, origen: true, destino: true },
  });

  console.log(`   Transferencias CAD 140 encontradas: ${transferenciasCAD.length}\n`);

  if (transferenciasCAD.length === 0) {
    console.log("   🔴 NO SE ENCONTRÓ LA TRANSFERENCIA EN LA TABLA Transferencia\n");
    
    // Buscar cualquier transferencia CAD desde Amazonas ese día
    const todasCAD = await prisma.transferencia.findMany({
      where: {
        origen_id: amazonas?.id,
        moneda_id: cad?.id,
        fecha: {
          gte: new Date('2026-03-21T05:00:00Z'),
          lt: new Date('2026-03-22T05:00:00Z'),
        },
      },
      include: { moneda: true },
    });
    
    console.log(`   Otras transferencias CAD desde Amazonas: ${todasCAD.length}`);
    for (const t of todasCAD) {
      console.log(`      - ${t.numero_recibo}: ${Number(t.monto).toFixed(2)} - Estado: ${t.estado} - Destino: ${t.destino_id}`);
    }
  } else {
    for (const t of transferenciasCAD) {
      console.log(`   ✅ Encontrada: ${t.numero_recibo}`);
      console.log(`      Estado: ${t.estado}`);
      console.log(`      Monto: ${Number(t.monto).toFixed(2)}`);
    }
  }

  // Ver movimientos de saldo CAD
  const movsCAD = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific?.id,
      moneda_id: cad?.id,
      tipo_referencia: { in: ['TRANSFERENCIA', 'TRANSFER'] },
      fecha: {
        gte: new Date('2026-03-21T05:00:00Z'),
        lt: new Date('2026-03-22T05:00:00Z'),
      },
    },
  });

  console.log(`\n   Movimientos de saldo CAD encontrados: ${movsCAD.length}`);
  for (const m of movsCAD) {
    console.log(`      - ${m.tipo_movimiento}: ${Number(m.monto).toFixed(2)} - Ref: ${m.referencia_id?.substring(0,20)}...`);
  }

  // 3. VERIFICAR SALDOS ACTUALES
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("3️⃣  SALDOS ACTUALES EN ROYAL PACIFIC");
  console.log("════════════════════════════════════════════════════════════════════════════\n");

  const saldoCOP = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: royalPacific!.id,
        moneda_id: cop!.id,
      },
    },
  });

  const saldoCAD = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: royalPacific!.id,
        moneda_id: cad!.id,
      },
    },
  });

  // Calcular desde movimientos
  const todosMovsCOP = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific?.id,
      moneda_id: cop?.id,
    },
  });

  const todosMovsCAD = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific?.id,
      moneda_id: cad?.id,
    },
  });

  const calculadoCOP = todosMovsCOP.reduce((s, m) => s + Number(m.monto), 0);
  const calculadoCAD = todosMovsCAD.reduce((s, m) => s + Number(m.monto), 0);

  console.log("   COP:");
  console.log(`      Saldo en tabla: ${Number(saldoCOP?.cantidad).toFixed(2)}`);
  console.log(`      Saldo calculado: ${calculadoCOP.toFixed(2)}`);
  console.log(`      Diferencia: ${(Number(saldoCOP?.cantidad) - calculadoCOP).toFixed(2)}`);

  console.log("\n   CAD:");
  console.log(`      Saldo en tabla: ${Number(saldoCAD?.cantidad).toFixed(2)}`);
  console.log(`      Saldo calculado: ${calculadoCAD.toFixed(2)}`);
  console.log(`      Diferencia: ${(Number(saldoCAD?.cantidad) - calculadoCAD).toFixed(2)}`);

  await prisma.$disconnect();
}

main();
