import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('════════════════════════════════════════════════════════════════════════════');
  console.log('VERIFICACIÓN DE SALDOS - ROYAL PACIFIC');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  const royalPacific = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });

  const cop = await prisma.moneda.findFirst({ where: { codigo: 'COP' } });
  const cad = await prisma.moneda.findFirst({ where: { codigo: 'CAD' } });

  // COP - Detalle de movimientos
  console.log('1. COP - Detalle de movimientos:\n');
  const movsCOP = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific!.id,
      moneda_id: cop!.id,
    },
    orderBy: { fecha: 'asc' },
  });

  let saldoCOP = 0;
  for (const m of movsCOP) {
    saldoCOP += Number(m.monto);
    const fecha = m.fecha.toISOString().substring(0, 10);
    console.log(`   ${fecha} | ${m.tipo_movimiento.padEnd(12)} | ${Number(m.monto).toFixed(2).padStart(12)} | ${m.tipo_referencia}`);
  }
  console.log(`   ──────────────────────────────────────────────────────────────────────────`);
  console.log(`   SALDO FINAL COP: ${saldoCOP.toFixed(2)}\n`);

  // CAD - Detalle de movimientos
  console.log('2. CAD - Detalle de movimientos:\n');
  const movsCAD = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: royalPacific!.id,
      moneda_id: cad!.id,
    },
    orderBy: { fecha: 'asc' },
  });

  let saldoCAD = 0;
  for (const m of movsCAD) {
    saldoCAD += Number(m.monto);
    const fecha = m.fecha.toISOString().substring(0, 10);
    console.log(`   ${fecha} | ${m.tipo_movimiento.padEnd(12)} | ${Number(m.monto).toFixed(2).padStart(12)} | ${m.tipo_referencia}`);
  }
  console.log(`   ──────────────────────────────────────────────────────────────────────────`);
  console.log(`   SALDO FINAL CAD: ${saldoCAD.toFixed(2)}\n`);

  // Verificar que coincidan con tabla Saldo
  console.log('3. COMPARACIÓN CON TABLA SALDO:\n');
  
  const saldoTablaCOP = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: royalPacific!.id,
        moneda_id: cop!.id,
      },
    },
  });

  const saldoTablaCAD = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: royalPacific!.id,
        moneda_id: cad!.id,
      },
    },
  });

  console.log(`   COP: Tabla=${Number(saldoTablaCOP?.cantidad).toFixed(2)} | Calculado=${saldoCOP.toFixed(2)} | ${Number(saldoTablaCOP?.cantidad) === saldoCOP ? '✅ OK' : '🔴 DIFERENCIA'}`);
  console.log(`   CAD: Tabla=${Number(saldoTablaCAD?.cantidad).toFixed(2)} | Calculado=${saldoCAD.toFixed(2)} | ${Number(saldoTablaCAD?.cantidad) === saldoCAD ? '✅ OK' : '🔴 DIFERENCIA'}`);

  await prisma.$disconnect();
}

main();
