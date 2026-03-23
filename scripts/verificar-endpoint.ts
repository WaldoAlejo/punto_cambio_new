import { PrismaClient } from '@prisma/client';
import { saldoReconciliationService } from '../server/services/saldoReconciliationService.js';

const prisma = new PrismaClient();

async function main() {
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  
  if (!punto) {
    console.log('Punto no encontrado');
    return;
  }
  
  console.log('=== VERIFICANDO DATOS DEL ENDPOINT ===\n');
  console.log(`Punto: ${punto.nombre} (${punto.id})\n`);
  
  const monedas = await prisma.moneda.findMany({ where: { activo: true } });
  
  for (const moneda of monedas) {
    // 1. Saldo en tabla
    const saldoTabla = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id
        }
      }
    });
    
    // 2. SaldoInicial activo
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: { punto_atencion_id: punto.id, moneda_id: moneda.id, activo: true }
    });
    
    // 3. Calcular desde movimientos (sin SALDO_INICIAL)
    const saldoCalculado = await saldoReconciliationService.calcularSaldoReal(
      punto.id,
      moneda.id
    );
    
    const valorTabla = Number(saldoTabla?.cantidad || 0);
    const diferencia = Number((valorTabla - saldoCalculado).toFixed(2));
    
    if (moneda.codigo === 'EUR' || moneda.codigo === 'USD' || Math.abs(diferencia) > 0.01) {
      console.log(`${moneda.codigo}:`);
      console.log(`  Saldo tabla: ${valorTabla.toFixed(2)}`);
      console.log(`  Saldo inicial: ${Number(saldoInicial?.cantidad_inicial || 0).toFixed(2)}`);
      console.log(`  Saldo calculado: ${saldoCalculado.toFixed(2)}`);
      console.log(`  Diferencia: ${diferencia.toFixed(2)}`);
      
      if (Math.abs(diferencia) > 0.01) {
        console.log(`  ❌ DESCUADRADO`);
      } else {
        console.log(`  ✅ OK`);
      }
      console.log('');
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
