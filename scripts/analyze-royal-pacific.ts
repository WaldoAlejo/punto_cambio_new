import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyze() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const usdId = 'bc4af218-7052-4df2-a04d-912eed63e32e';
  
  console.log('=== ANÁLISIS DETALLADO ROYAL PACIFIC ===\n');
  
  // 1. Obtener saldo actual
  const saldo = await prisma.saldo.findUnique({
    where: { punto_atencion_id_moneda_id: { punto_atencion_id: pointId, moneda_id: usdId } }
  });
  
  console.log('1. SALDO EN TABLA:');
  console.log('   cantidad:', Number(saldo?.cantidad || 0));
  console.log('   billetes:', Number(saldo?.billetes || 0));
  console.log('   monedas:', Number(saldo?.monedas_fisicas || 0));
  console.log('   bancos:', Number(saldo?.bancos || 0));
  console.log('   updated_at:', saldo?.updated_at);
  
  // 2. Obtener saldo inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: { punto_atencion_id: pointId, moneda_id: usdId, activo: true },
    orderBy: { fecha_asignacion: 'desc' }
  });
  
  console.log('\n2. SALDO INICIAL ACTIVO:');
  console.log('   cantidad_inicial:', Number(saldoInicial?.cantidad_inicial || 0));
  console.log('   fecha_asignacion:', saldoInicial?.fecha_asignacion);
  
  // 3. Obtener TODOS los movimientos
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: pointId, moneda_id: usdId },
    orderBy: { fecha: 'asc' },
    select: {
      id: true,
      tipo_movimiento: true,
      monto: true,
      descripcion: true,
      fecha: true,
      saldo_anterior: true,
      saldo_nuevo: true
    }
  });
  
  console.log('\n3. MOVIMIENTOS ENCONTRADOS:', movimientos.length);
  
  // 4. Calcular saldo paso a paso
  let calculado = Number(saldoInicial?.cantidad_inicial || 0);
  console.log('\n4. CÁLCULO PASO A PASO:');
  console.log('   Inicio (saldo inicial):', calculado.toFixed(2));
  
  const detalle = [];
  
  for (const m of movimientos) {
    const monto = Number(m.monto);
    const tipo = m.tipo_movimiento;
    const desc = m.descripcion || '';
    
    let delta = 0;
    
    // Verificar si es bancario
    const isBancario = /\bbancos?\b/i.test(desc.toLowerCase()) && !desc.toLowerCase().includes('(caja)');
    
    if (isBancario) {
      delta = 0;
    } else if (tipo === 'SALDO_INICIAL') {
      delta = 0;
    } else if (tipo === 'EGRESO' || tipo === 'TRANSFERENCIA_SALIENTE' || tipo === 'TRANSFERENCIA_SALIDA') {
      delta = -Math.abs(monto);
    } else if (tipo === 'INGRESO' || tipo === 'TRANSFERENCIA_ENTRANTE' || tipo === 'TRANSFERENCIA_ENTRADA') {
      delta = Math.abs(monto);
    } else if (tipo === 'AJUSTE') {
      delta = monto;
    } else {
      delta = monto;
    }
    
    calculado += delta;
    
    detalle.push({
      fecha: m.fecha.toISOString().split('T')[0],
      tipo,
      monto: monto.toFixed(2),
      delta: delta.toFixed(2),
      calculado: calculado.toFixed(2),
      desc: desc.substring(0, 50),
      isBancario
    });
  }
  
  console.log('   Resultado final calculado:', calculado.toFixed(2));
  console.log('   Diferencia con tabla:', (calculado - Number(saldo?.cantidad || 0)).toFixed(2));
  
  // 5. Mostrar últimos 20 movimientos
  console.log('\n5. ÚLTIMOS 20 MOVIMIENTOS:');
  console.log('   Fecha       | Tipo                | Monto    | Delta    | Acumulado | Banc? | Descripción');
  console.log('   ' + '-'.repeat(130));
  
  for (const d of detalle.slice(-20)) {
    const bancoMark = d.isBancario ? 'SÍ' : 'no';
    console.log(`   ${d.fecha} | ${d.tipo.padEnd(19)} | ${d.monto.padStart(8)} | ${d.delta.padStart(8)} | ${d.calculado.padStart(9)} | ${bancoMark.padStart(5)} | ${d.desc}`);
  }
  
  // 6. Análisis de totales por tipo
  console.log('\n6. TOTALES POR TIPO DE MOVIMIENTO (excluyendo bancarios):');
  const totales: Record<string, { count: number; sum: number }> = {};
  for (const m of movimientos) {
    const tipo = m.tipo_movimiento;
    if (!totales[tipo]) totales[tipo] = { count: 0, sum: 0 };
    totales[tipo].count++;
    
    const desc = m.descripcion || '';
    const isBancario = /\bbancos?\b/i.test(desc.toLowerCase()) && !desc.toLowerCase().includes('(caja)');
    if (!isBancario) {
      const monto = Number(m.monto);
      if (tipo === 'EGRESO' || tipo === 'TRANSFERENCIA_SALIENTE') {
        totales[tipo].sum -= Math.abs(monto);
      } else {
        totales[tipo].sum += Math.abs(monto);
      }
    }
  }
  
  for (const [tipo, data] of Object.entries(totales)) {
    const sign = data.sum >= 0 ? '+' : '';
    console.log(`   ${tipo.padEnd(25)}: ${data.count} movs, total ${sign}$${data.sum.toFixed(2)}`);
  }
  
  // 7. Buscar movimientos sospechosos (grandes montos)
  console.log('\n7. MOVIMIENTOS CON MONTOS > $100 (últimos 30 días):');
  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);
  
  const grandes = movimientos.filter(m => 
    Math.abs(Number(m.monto)) > 100 && 
    m.fecha >= hace30dias
  );
  
  for (const m of grandes) {
    console.log(`   ${m.fecha.toISOString().split('T')[0]} | ${m.tipo_movimiento.padEnd(20)} | $${Number(m.monto).toFixed(2).padStart(10)} | ${(m.descripcion || '').substring(0, 40)}`);
  }
  
  await prisma.$disconnect();
}

analyze().catch(console.error);
