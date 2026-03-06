import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigate() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const usdId = 'bc4af218-7052-4df2-a04d-912eed63e32e';
  
  console.log('=== INVESTIGACIÓN DE LA DISCREPANCIA DE $390 ===\n');
  
  // Obtener movimientos de los últimos 7 días para ver qué pasó
  const hace7dias = new Date('2026-03-05');
  hace7dias.setDate(hace7dias.getDate() - 7);
  
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: { 
      punto_atencion_id: pointId, 
      moneda_id: usdId,
      fecha: { gte: hace7dias }
    },
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
  
  console.log('MOVIMIENTOS DE LOS ÚLTIMOS 7 DÍAS:\n');
  console.log('Fecha/Hora           | Tipo                | Monto      | Saldo Ant  | Saldo Nue  | Descripción');
  console.log('-'.repeat(150));
  
  for (const m of movimientos) {
    const fecha = m.fecha.toISOString();
    const tipo = m.tipo_movimiento.padEnd(19);
    const monto = Number(m.monto).toFixed(2).padStart(10);
    const saldoAnt = Number(m.saldo_anterior || 0).toFixed(2).padStart(10);
    const saldoNue = Number(m.saldo_nuevo || 0).toFixed(2).padStart(10);
    const desc = (m.descripcion || '').substring(0, 60);
    
    console.log(`${fecha} | ${tipo} | ${monto} | ${saldoAnt} | ${saldoNue} | ${desc}`);
  }
  
  // Buscar movimientos relacionados con "duplicado"
  console.log('\n\n=== MOVIMIENTOS CON "DUPLICADO" EN DESCRIPCIÓN ===');
  const duplicados = await prisma.movimientoSaldo.findMany({
    where: { 
      punto_atencion_id: pointId, 
      moneda_id: usdId,
      descripcion: { contains: 'DUPLICADO', mode: 'insensitive' }
    },
    orderBy: { fecha: 'desc' },
  });
  
  for (const d of duplicados) {
    console.log(`${d.fecha.toISOString()} | ${d.tipo_movimiento} | $${Number(d.monto).toFixed(2)} | ${d.descripcion?.substring(0, 60)}`);
  }
  
  // Buscar movimientos relacionados con "NO SE DESCONTO"
  console.log('\n\n=== MOVIMIENTOS CON "NO SE DESCONTO" EN DESCRIPCIÓN ===');
  const noDescontados = await prisma.movimientoSaldo.findMany({
    where: { 
      punto_atencion_id: pointId, 
      moneda_id: usdId,
      descripcion: { contains: 'NO SE DESCONTO', mode: 'insensitive' }
    },
    orderBy: { fecha: 'desc' },
  });
  
  for (const d of noDescontados) {
    console.log(`${d.fecha.toISOString()} | ${d.tipo_movimiento} | $${Number(d.monto).toFixed(2)} | ${d.descripcion?.substring(0, 60)}`);
  }
  
  // Calcular el impacto neto de estos movimientos
  console.log('\n\n=== ANÁLISIS DE IMPACTO ===');
  
  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: pointId, moneda_id: usdId },
  });
  
  // Separar por descripción para entender mejor
  const porDescripcion: Record<string, { count: number; sum: number }> = {};
  
  for (const m of todosMovimientos) {
    const desc = (m.descripcion || '').toUpperCase();
    const isBancario = /\bbancos?\b/i.test(desc) && !desc.includes('(CAJA)');
    if (isBancario) continue;
    
    // Categorizar por palabras clave
    let categoria = 'OTROS';
    if (desc.includes('DUPLICADO')) categoria = 'DUPLICADO';
    else if (desc.includes('NO SE DESCONTO')) categoria = 'NO_SE_DESCONTO';
    else if (desc.includes('REVERSO')) categoria = 'REVERSO';
    else if (desc.includes('AJUSTE')) categoria = 'AJUSTE';
    else if (desc.includes('CAMBIO')) categoria = 'CAMBIO_DIVISA';
    else if (desc.includes('TRANSFERENCIA')) categoria = 'TRANSFERENCIA';
    
    if (!porDescripcion[categoria]) porDescripcion[categoria] = { count: 0, sum: 0 };
    porDescripcion[categoria].count++;
    
    const monto = Number(m.monto);
    if (m.tipo_movimiento === 'EGRESO' || m.tipo_movimiento === 'TRANSFERENCIA_SALIENTE') {
      porDescripcion[categoria].sum -= Math.abs(monto);
    } else {
      porDescripcion[categoria].sum += monto;
    }
  }
  
  console.log('\nCategoría          | Cantidad | Impacto Neto');
  console.log('-'.repeat(50));
  for (const [cat, data] of Object.entries(porDescripcion)) {
    const sign = data.sum >= 0 ? '+' : '';
    console.log(`${cat.padEnd(18)} | ${data.count.toString().padStart(8)} | ${sign}$${data.sum.toFixed(2)}`);
  }
  
  await prisma.$disconnect();
}

investigate().catch(console.error);
