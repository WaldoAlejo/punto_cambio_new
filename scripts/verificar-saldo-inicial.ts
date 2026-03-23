import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  const moneda = await prisma.moneda.findFirst({ where: { codigo: 'EUR' } });
  
  if (!punto || !moneda) {
    console.log('Punto o moneda no encontrados');
    return;
  }
  
  console.log('Punto:', punto.nombre);
  console.log('Moneda:', moneda.codigo);
  
  // TODOS los saldos iniciales (activos e inactivos)
  const todosSaldosIniciales = await prisma.saldoInicial.findMany({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id },
    orderBy: { fecha_asignacion: 'desc' }
  });
  
  console.log('\n📋 Todos los registros de SaldoInicial:');
  for (const si of todosSaldosIniciales) {
    console.log(`  ID: ${si.id}`);
    console.log(`  Cantidad: ${Number(si.cantidad_inicial).toFixed(2)}`);
    console.log(`  Activo: ${si.activo}`);
    console.log(`  Fecha: ${si.fecha_asignacion}`);
    console.log(`  Observaciones: ${si.observaciones || 'N/A'}`);
    console.log('  ---');
  }
  
  // Calcular cuál debería ser el saldo inicial correcto
  // para que el resultado final sea 811.09
  const movsNoInicial = await prisma.movimientoSaldo.findMany({
    where: { 
      punto_atencion_id: punto.id, 
      moneda_id: moneda.id,
      tipo_movimiento: { not: 'SALDO_INICIAL' }
    }
  });
  
  let totalMovs = 0;
  for (const m of movsNoInicial) {
    totalMovs += Number(m.monto);
  }
  
  const saldoEsperado = 811.09;
  const saldoInicialCorrecto = saldoEsperado - totalMovs;
  
  console.log('\n🧮 Cálculo para obtener saldo final de 811.09 €:');
  console.log(`  Suma de movimientos (sin SALDO_INICIAL): ${totalMovs.toFixed(2)}`);
  console.log(`  Saldo esperado: ${saldoEsperado.toFixed(2)}`);
  console.log(`  => Saldo inicial necesario: ${saldoInicialCorrecto.toFixed(2)}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
