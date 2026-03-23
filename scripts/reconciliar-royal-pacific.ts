import { PrismaClient } from '@prisma/client';
import { saldoReconciliationService } from '../server/services/saldoReconciliationService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('=== RECONCILIANDO SALDOS DE ROYAL PACIFIC ===\n');

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });

  if (!punto) {
    console.log('❌ Punto Royal Pacific no encontrado');
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (${punto.id})\n`);

  const monedas = await prisma.moneda.findMany({ where: { activo: true } });

  for (const moneda of monedas) {
    const resultado = await saldoReconciliationService.reconciliarSaldo(
      punto.id,
      moneda.id
    );

    if (resultado.movimientosCount > 0 || resultado.saldoCalculado !== 0) {
      console.log(`💰 ${moneda.codigo}:`);
      console.log(`   Saldo anterior: ${resultado.saldoAnterior.toFixed(2)}`);
      console.log(`   Saldo calculado: ${resultado.saldoCalculado.toFixed(2)}`);
      console.log(`   Diferencia: ${resultado.diferencia.toFixed(2)}`);
      console.log(`   Movimientos: ${resultado.movimientosCount}`);
      
      if (resultado.corregido) {
        console.log(`   ✅ CORREGIDO`);
      } else if (resultado.error) {
        console.log(`   ❌ ERROR: ${resultado.error}`);
      } else {
        console.log(`   ✓ OK (sin cambios)`);
      }
      console.log('');
    }
  }

  console.log('=== RECONCILIACIÓN COMPLETADA ===');
  await prisma.$disconnect();
}

main().catch(console.error);
