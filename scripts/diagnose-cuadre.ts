import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnoseCuadre() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const fechaStr = '2026-03-05';
  
  console.log('=== DIAGNÓSTICO CUADRE CAJA ===\n');
  
  // Calcular rango de fechas (como lo hace el endpoint)
  const fechaBase = new Date(`${fechaStr}T00:00:00.000Z`);
  const { gte, lt } = {
    gte: new Date(fechaBase.getTime() + 5 * 60 * 60 * 1000), // Ajuste Ecuador
    lt: new Date(fechaBase.getTime() + 29 * 60 * 60 * 1000)  // +24h
  };
  
  console.log('Rango de fechas para consulta:');
  console.log('  gte:', gte.toISOString());
  console.log('  lt:', lt.toISOString());
  
  // Contar movimientos
  const count = await prisma.movimientoSaldo.count({
    where: {
      punto_atencion_id: pointId,
      fecha: { gte, lt }
    }
  });
  console.log('\nMovimientos encontrados:', count);
  
  // Obtener movimientos por moneda
  const monedas = await prisma.moneda.findMany({ where: { activo: true } });
  
  console.log('\n--- MOVIMIENTOS POR MONEDA ---');
  for (const moneda of monedas) {
    const movs = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: pointId,
        moneda_id: moneda.id,
        fecha: { gte, lt }
      }
    });
    
    if (movs.length > 0) {
      let ingresos = 0;
      let egresos = 0;
      
      for (const mov of movs) {
        const monto = Number(mov.monto);
        if (mov.tipo_movimiento === 'INGRESO' || mov.tipo_movimiento === 'TRANSFERENCIA_ENTRANTE') {
          ingresos += Math.abs(monto);
        } else if (mov.tipo_movimiento === 'EGRESO' || mov.tipo_movimiento === 'TRANSFERENCIA_SALIENTE') {
          egresos += Math.abs(monto);
        } else {
          // Para otros tipos, usar el signo del monto
          if (monto > 0) ingresos += monto;
          else egresos += Math.abs(monto);
        }
      }
      
      console.log(`\n${moneda.codigo}:`);
      console.log(`  Movimientos: ${movs.length}`);
      console.log(`  Ingresos: $${ingresos.toFixed(2)}`);
      console.log(`  Egresos: $${egresos.toFixed(2)}`);
    }
  }
  
  // Verificar fechas de movimientos recientes
  console.log('\n--- ÚLTIMOS 5 MOVIMIENTOS ---');
  const ultimos = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: pointId },
    orderBy: { fecha: 'desc' },
    take: 5
  });
  
  for (const m of ultimos) {
    console.log(`  ${m.fecha.toISOString()} | ${m.tipo_movimiento.padEnd(20)} | $${Number(m.monto).toFixed(2).padStart(10)}`);
  }
  
  await prisma.$disconnect();
}

diagnoseCuadre().catch(console.error);
