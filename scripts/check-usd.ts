import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  const moneda = await prisma.moneda.findFirst({ where: { codigo: 'USD' } });
  
  // Saldo inicial
  const si = await prisma.saldoInicial.findFirst({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id, activo: true }
  });
  
  // Movimientos (sin SALDO_INICIAL)
  const movs = await prisma.movimientoSaldo.findMany({
    where: { 
      punto_atencion_id: punto.id, 
      moneda_id: moneda.id,
      tipo_movimiento: { not: 'SALDO_INICIAL' }
    }
  });
  
  let total = Number(si?.cantidad_inicial || 0);
  for (const m of movs) total += Number(m.monto);
  
  console.log('USD - Royal Pacific');
  console.log('SaldoInicial:', Number(si?.cantidad_inicial || 0).toFixed(2));
  console.log('Movimientos (sin inicial):', movs.length);
  console.log('Suma movimientos:', (total - Number(si?.cantidad_inicial || 0)).toFixed(2));
  console.log('Total calculado:', total.toFixed(2));
  
  await prisma.$disconnect();
}

main();
