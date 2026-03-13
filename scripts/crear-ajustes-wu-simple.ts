import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function crearAjustes() {
  console.log('╔' + '═'.repeat(100) + '╗');
  console.log('║' + ' '.repeat(35) + 'CREAR AJUSTES WU' + ' '.repeat(48) + '║');
  console.log('╚' + '═'.repeat(100) + '╝');
  console.log();

  const puntoId = '3f13bb4e-181b-4026-b1bf-4ae00f1d1391';
  const monedaUSD = await prisma.moneda.findFirst({ where: { codigo: 'USD' } });
  const usuarioId = '0357b702-8a0d-4d16-b825-f25760e4c757';
  
  if (!monedaUSD) return;

  // Calcular
  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      servicio: 'WESTERN'
    }
  });

  let totalCalculado = 0;
  let monedasCalculado = 0;
  
  movimientos.forEach(m => {
    const factor = m.tipo_movimiento === 'EGRESO' ? -1 : 1;
    totalCalculado += Number(m.monto) * factor;
    monedasCalculado += Number(m.monedas_fisicas || 0) * factor;
  });

  const diferencia = 368.71 - totalCalculado;

  console.log('📊 DATOS:');
  console.log(`   Total actual:   $${totalCalculado.toFixed(2)}`);
  console.log(`   Total Western:  $368.71`);
  console.log(`   Diferencia:     $${diferencia.toFixed(2)}`);
  console.log(`   Monedas:        $${monedasCalculado.toFixed(2)}`);
  console.log();

  // Crear ajustes
  console.log('🔧 CREANDO AJUSTES:');
  console.log('─'.repeat(100));
  
  try {
    // Ajuste 1: Cuadre
    const ajuste1 = await prisma.servicioExternoMovimiento.create({
      data: {
        monto: 559.14,
        billetes: 559.14,
        monedas_fisicas: 0,
        bancos: 0,
        tipo_movimiento: 'INGRESO',
        fecha: new Date(),
        descripcion: 'AJUSTE AUDITORIA - Cuadre con Rianxeira. Diferencia detectada en reconciliation.',
        metodo_ingreso: 'EFECTIVO',
        servicio: 'WESTERN',
        moneda: { connect: { id: monedaUSD.id } },
        puntoAtencion: { connect: { id: puntoId } },
        usuario: { connect: { id: usuarioId } }
      }
    });
    console.log(`   ✅ Ajuste cuadre: $559.14 | ID: ${ajuste1.id.substring(0, 8)}`);

    // Ajuste 2: Buckets
    const ajuste2 = await prisma.servicioExternoMovimiento.create({
      data: {
        monto: 0,
        billetes: 140.92,
        monedas_fisicas: -140.92,
        bancos: 0,
        tipo_movimiento: 'INGRESO',
        fecha: new Date(),
        descripcion: 'AJUSTE BUCKETS - Mover monedas a billetes. Correccion distribucion.',
        metodo_ingreso: 'EFECTIVO',
        servicio: 'WESTERN',
        moneda: { connect: { id: monedaUSD.id } },
        puntoAtencion: { connect: { id: puntoId } },
        usuario: { connect: { id: usuarioId } }
      }
    });
    console.log(`   ✅ Ajuste buckets: $140.92 | ID: ${ajuste2.id.substring(0, 8)}`);
    
    console.log('   ✅ Ambos ajustes creados');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    await prisma.$disconnect();
    return;
  }
  console.log();

  // Recalcular
  console.log('🔄 RECALCULANDO:');
  console.log('─'.repeat(100));
  
  const movsFinales = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      servicio: 'WESTERN'
    }
  });

  let total = 0, billetes = 0, monedas = 0;
  movsFinales.forEach(m => {
    const factor = m.tipo_movimiento === 'EGRESO' ? -1 : 1;
    total += Number(m.monto) * factor;
    billetes += Number(m.billetes || 0) * factor;
    monedas += Number(m.monedas_fisicas || 0) * factor;
  });

  console.log(`   Total:    $${total.toFixed(2)}`);
  console.log(`   Billetes: $${billetes.toFixed(2)}`);
  console.log(`   Monedas:  $${monedas.toFixed(2)}`);
  console.log(`   Movs:     ${movsFinales.length}`);
  console.log();

  // Actualizar saldo
  const saldo = await prisma.servicioExternoSaldo.findFirst({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      servicio: 'WESTERN'
    }
  });

  if (saldo) {
    await prisma.servicioExternoSaldo.update({
      where: { id: saldo.id },
      data: {
        cantidad: total,
        billetes: billetes,
        monedas_fisicas: monedas,
        bancos: 0,
        updated_at: new Date()
      }
    });
    console.log('   ✅ Tabla actualizada');
  }
  console.log();

  // Verificar
  console.log('✅ RESULTADO:');
  console.log('─'.repeat(100));
  
  const final = await prisma.servicioExternoSaldo.findFirst({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      servicio: 'WESTERN'
    }
  });

  if (final) {
    console.log(`   Total:    $${final.cantidad}`);
    console.log(`   Billetes: $${final.billetes}`);
    console.log(`   Monedas:  $${final.monedas_fisicas}`);
    console.log();
    
    const diff = Number(final.cantidad) - 368.71;
    console.log(`   Dif Western: $${diff.toFixed(2)}`);
    console.log(`   ${Math.abs(diff) < 0.1 ? '✅ CUADRA' : '❌ NO CUADRA'}`);
    console.log(`   ${Number(final.monedas_fisicas) < 0.1 ? '✅ MONEDAS OK' : '❌ MONEDAS PENDIENTES'}`);
  }
  console.log();

  console.log('╔' + '═'.repeat(100) + '╗');
  console.log('║  PROCESO COMPLETADO' + ' '.repeat(80) + '║');
  console.log('╚' + '═'.repeat(100) + '╝');

  await prisma.$disconnect();
}

crearAjustes().catch(console.error);
