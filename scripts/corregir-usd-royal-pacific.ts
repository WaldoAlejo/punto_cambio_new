import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific', mode: 'insensitive' } }
  });
  const moneda = await prisma.moneda.findFirst({ where: { codigo: 'USD' } });
  
  if (!punto || !moneda) {
    console.log('Punto o moneda no encontrados');
    return;
  }
  
  console.log('Punto:', punto.nombre);
  console.log('Moneda:', moneda.codigo);
  
  // Calcular saldo inicial necesario para obtener 910.79
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
  
  const saldoEsperado = 910.79;
  const saldoInicialCorrecto = saldoEsperado - totalMovs;
  
  console.log('\n📊 Cálculo:');
  console.log(`  Suma de movimientos (sin SALDO_INICIAL): ${totalMovs.toFixed(2)}`);
  console.log(`  Saldo esperado: ${saldoEsperado.toFixed(2)}`);
  console.log(`  => Saldo inicial necesario: ${saldoInicialCorrecto.toFixed(2)}`);
  
  // Actualizar el saldo inicial
  const saldoInicialActual = await prisma.saldoInicial.findFirst({
    where: { punto_atencion_id: punto.id, moneda_id: moneda.id, activo: true }
  });
  
  if (saldoInicialActual) {
    console.log(`\n📝 Actualizando SaldoInicial...`);
    console.log(`  Anterior: ${Number(saldoInicialActual.cantidad_inicial).toFixed(2)}`);
    console.log(`  Nuevo: ${saldoInicialCorrecto.toFixed(2)}`);
    
    await prisma.saldoInicial.update({
      where: { id: saldoInicialActual.id },
      data: { 
        cantidad_inicial: saldoInicialCorrecto,
        observaciones: `Ajustado para cuadrar a saldo real de ${saldoEsperado.toFixed(2)} USD`
      }
    });
    
    console.log('✅ SaldoInicial actualizado correctamente');
  }
  
  // Recalcular y actualizar tabla Saldo
  const saldoCalculado = saldoInicialCorrecto + totalMovs;
  console.log(`\n💰 Nuevo saldo calculado: ${saldoCalculado.toFixed(2)}`);
  
  const saldoTabla = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id
      }
    }
  });
  
  if (saldoTabla) {
    await prisma.saldo.update({
      where: { id: saldoTabla.id },
      data: { 
        cantidad: saldoCalculado,
        billetes: saldoCalculado,
        updated_at: new Date()
      }
    });
    console.log(`✅ Tabla Saldo actualizada: ${Number(saldoTabla.cantidad).toFixed(2)} -> ${saldoCalculado.toFixed(2)}`);
  } else {
    await prisma.saldo.create({
      data: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        cantidad: saldoCalculado,
        billetes: saldoCalculado,
        monedas_fisicas: 0,
        bancos: 0
      }
    });
    console.log(`✅ Tabla Saldo creada con: ${saldoCalculado.toFixed(2)}`);
  }
  
  await prisma.$disconnect();
  console.log('\n🎉 Corrección completada!');
}

main().catch(console.error);
