import { PrismaClient } from '@prisma/client';
import { saldoReconciliationService } from '../server/services/saldoReconciliationService.js';

const prisma = new PrismaClient();

async function debugVistaSaldos() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const monedaId = 'bc4af218-7052-4df2-a04d-912eed63e32e'; // USD
  
  console.log('=== DEBUG VISTA SALDOS (Royal Pacific - USD) ===\n');
  
  // 1. Saldo inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: { punto_atencion_id: pointId, moneda_id: monedaId, activo: true }
  });
  console.log('1. Saldo Inicial:', Number(saldoInicial?.cantidad_inicial || 0));
  
  // 2. Saldo en tabla
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: { punto_atencion_id: pointId, moneda_id: monedaId }
    }
  });
  console.log('2. Saldo Tabla (cantidad):', Number(saldo?.cantidad || 0));
  console.log('   Billetes:', Number(saldo?.billetes || 0));
  console.log('   Monedas:', Number(saldo?.monedas_fisicas || 0));
  
  // 3. Calcular con reconciledMap (como hace vista-saldos-puntos)
  const reconciledMap = new Map<string, number>();
  const key = `${pointId}:${monedaId}`;
  reconciledMap.set(key, Number(saldoInicial?.cantidad_inicial || 0));
  
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: pointId, moneda_id: monedaId },
    orderBy: { fecha: 'asc' }
  });
  
  console.log('\n3. Movimientos encontrados:', movimientos.length);
  
  for (const mov of movimientos) {
    const desc = mov.descripcion?.toLowerCase() || '';
    if (desc.includes('bancos')) continue;
    
    const current = reconciledMap.get(key) ?? 0;
    const delta = saldoReconciliationService._normalizarMonto(
      mov.tipo_movimiento,
      Number(mov.monto),
      mov.descripcion
    );
    reconciledMap.set(key, Number((current + delta).toFixed(2)));
  }
  
  const saldoReconciliado = reconciledMap.get(key) ?? 0;
  console.log('   Saldo reconciliado:', saldoReconciliado);
  
  // 4. Calcular diferencia
  const diferencia = Number((saldoReconciliado - Number(saldoInicial?.cantidad_inicial || 0)).toFixed(2));
  console.log('\n4. Diferencia:', diferencia);
  
  // 5. Verificar con saldoReconciliationService.calcularSaldoReal
  const saldoReal = await saldoReconciliationService.calcularSaldoReal(pointId, monedaId);
  console.log('\n5. Saldo Real (service):', saldoReal);
  
  // 6. Resumen
  console.log('\n=== RESUMEN ===');
  console.log('Saldo Inicial:', Number(saldoInicial?.cantidad_inicial || 0));
  console.log('Saldo Actual (reconciliado):', saldoReconciliado);
  console.log('Diferencia:', diferencia);
  console.log('Saldo Real (service):', saldoReal);
  
  await prisma.$disconnect();
}

debugVistaSaldos().catch(console.error);
