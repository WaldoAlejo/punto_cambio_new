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
  
  console.log('Punto:', punto.nombre, '(' + punto.id + ')');
  console.log('Moneda:', moneda.codigo, '(' + moneda.id + ')');
  
  // Saldo inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id, activo: true }
  });
  console.log('\n💰 Saldo Inicial activo:', Number(saldoInicial?.cantidad_inicial || 0));
  
  // Movimientos
  const movs = await prisma.movimientoSaldo.findMany({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id },
    orderBy: { fecha: 'asc' }
  });
  
  console.log('\n📋 Movimientos (' + movs.length + '):');
  let total = Number(saldoInicial?.cantidad_inicial || 0);
  console.log('Inicio (saldo inicial):', total.toFixed(2));
  
  for (const m of movs) {
    const monto = Number(m.monto);
    total += monto;
    console.log(
      '  ' + m.tipo_movimiento.padEnd(25) + 
      ' | ' + (monto >= 0 ? '+' : '') + monto.toFixed(2).padStart(10) + 
      ' | Saldo: ' + total.toFixed(2).padStart(10) + 
      ' | ' + (m.descripcion || '').substring(0, 40)
    );
  }
  
  console.log('\n🏁 Saldo final calculado:', total.toFixed(2));
  
  // También mostrar saldo en tabla
  const saldoTabla = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id
      }
    }
  });
  console.log('💾 Saldo en tabla Saldo:', Number(saldoTabla?.cantidad || 0));
  
  await prisma.$disconnect();
}

main().catch(console.error);
