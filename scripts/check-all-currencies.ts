import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAllCurrencies() {
  console.log('=== VALIDACIÓN DE TODAS LAS MONEDAS ===\n');
  
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff'; // Royal Pacific
  
  // 1. Obtener todas las monedas activas
  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    select: { id: true, codigo: true, nombre: true }
  });
  
  console.log('Monedas activas en el sistema:', monedas.length);
  
  // 2. Verificar saldos por moneda
  console.log('\n--- SALDOS POR MONEDA (Royal Pacific) ---');
  console.log('Moneda | Saldo Tabla | Saldo Calculado | Diferencia | Estado');
  console.log('-'.repeat(80));
  
  let allOk = true;
  
  for (const moneda of monedas) {
    // Saldo en tabla
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: pointId,
          moneda_id: moneda.id
        }
      }
    });
    
    // Saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: pointId,
        moneda_id: moneda.id,
        activo: true
      }
    });
    
    // Calcular desde movimientos
    let calculado = Number(saldoInicial?.cantidad_inicial || 0);
    
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: pointId,
        moneda_id: moneda.id
      }
    });
    
    for (const mov of movimientos) {
      const desc = (mov.descripcion || '').toLowerCase();
      if (/\bbancos?\b/i.test(desc) && !desc.includes('(caja)')) continue;
      
      const tipo = mov.tipo_movimiento;
      const monto = Number(mov.monto);
      
      if (tipo === 'SALDO_INICIAL') continue;
      else if (tipo === 'EGRESO' || tipo === 'TRANSFERENCIA_SALIENTE') calculado -= Math.abs(monto);
      else if (tipo === 'INGRESO' || tipo === 'TRANSFERENCIA_ENTRANTE') calculado += Math.abs(monto);
      else if (tipo === 'AJUSTE') calculado += monto;
      else calculado += monto;
    }
    
    const saldoTabla = Number(saldo?.cantidad || 0);
    const diferencia = Number((saldoTabla - calculado).toFixed(2));
    const ok = Math.abs(diferencia) <= 0.02;
    if (!ok) allOk = false;
    const estado = ok ? '✅ OK' : '❌ DIF';
    
    if (Math.abs(saldoTabla) > 0.01 || Math.abs(calculado) > 0.01 || movimientos.length > 0) {
      console.log(
        moneda.codigo.padEnd(6) + ' | ' +
        saldoTabla.toFixed(2).padStart(11) + ' | ' +
        calculado.toFixed(2).padStart(15) + ' | ' +
        (diferencia >= 0 ? '+' : '').padStart(5) + diferencia.toFixed(2).padStart(8) + ' | ' +
        estado
      );
    }
  }
  
  // 3. Verificar si hay movimientos en todas las monedas
  console.log('\n--- MOVIMIENTOS POR MONEDA ---');
  const movsPorMoneda = await prisma.movimientoSaldo.groupBy({
    by: ['moneda_id'],
    where: { punto_atencion_id: pointId },
    _count: { id: true }
  });
  
  for (const m of movsPorMoneda) {
    const moneda = monedas.find(mo => mo.id === m.moneda_id);
    if (moneda) {
      console.log(moneda.codigo.padEnd(6) + ': ' + m._count.id + ' movimientos');
    }
  }
  
  console.log('\n' + (allOk ? '✅ TODAS LAS MONEDAS ESTÁN CUADRADAS' : '❌ HAY DIFERENCIAS'));
  
  await prisma.$disconnect();
}

checkAllCurrencies().catch(console.error);
