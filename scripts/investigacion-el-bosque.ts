import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigarElBosque() {
  console.log('╔' + '═'.repeat(100) + '╗');
  console.log('║' + ' '.repeat(25) + 'INVESTIGACIÓN - PUNTO EL BOSQUE' + ' '.repeat(43) + '║');
  console.log('╚' + '═'.repeat(100) + '╝');
  console.log();

  // 1. Buscar el punto de atención "El Bosque"
  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: { contains: 'Bosque', mode: 'insensitive' }
    }
  });

  if (!punto) {
    console.log('❌ No se encontró el punto "El Bosque"');
    // Buscar todos los puntos para ver cuáles existen
    const puntos = await prisma.puntoAtencion.findMany({
      select: { id: true, nombre: true, codigo: true }
    });
    console.log('\nPuntos disponibles:');
    puntos.forEach(p => console.log(`  - ${p.nombre} (${p.codigo}) - ID: ${p.id}`));
    await prisma.$disconnect();
    return;
  }

  console.log('📍 PUNTO ENCONTRADO:');
  console.log(`   Nombre: ${punto.nombre}`);
  console.log(`   Código: ${punto.codigo}`);
  console.log(`   ID: ${punto.id}`);
  console.log();

  const puntoId = punto.id;

  // 2. Obtener saldo de USD
  const monedaUSD = await prisma.moneda.findFirst({
    where: { codigo: 'USD' }
  });

  if (!monedaUSD) {
    console.log('❌ No se encontró la moneda USD');
    await prisma.$disconnect();
    return;
  }

  const saldoUSD = await prisma.saldo.findFirst({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id
    }
  });

  console.log('💰 SALDO USD ACTUAL EN EL SISTEMA:');
  console.log('─'.repeat(100));
  if (saldoUSD) {
    console.log(`   Total (cantidad):  $${saldoUSD.cantidad}`);
    console.log(`   Billetes:          $${saldoUSD.billetes}`);
    console.log(`   Monedas:           $${saldoUSD.monedas_fisicas}`);
    console.log(`   Bancos:            $${saldoUSD.bancos}`);
    console.log(`   Diferencia:        $${Number(saldoUSD.billetes) + Number(saldoUSD.monedas_fisicas) + Number(saldoUSD.bancos) - Number(saldoUSD.cantidad)}`);
  } else {
    console.log('   ❌ No se encontró registro de saldo para USD');
  }
  console.log();

  // 3. Verificar consistencia de buckets
  console.log('🔍 VERIFICACIÓN DE CONSISTENCIA:');
  console.log('─'.repeat(100));
  if (saldoUSD) {
    const sumaBuckets = Number(saldoUSD.billetes) + Number(saldoUSD.monedas_fisicas) + Number(saldoUSD.bancos);
    const diferencia = sumaBuckets - Number(saldoUSD.cantidad);
    
    console.log(`   Suma buckets:      $${sumaBuckets.toFixed(2)}`);
    console.log(`   Total saldo:       $${Number(saldoUSD.cantidad).toFixed(2)}`);
    console.log(`   Diferencia:        $${diferencia.toFixed(2)}`);
    
    if (Math.abs(diferencia) > 0.01) {
      console.log('   ⚠️  ALERTA: Los buckets NO cuadran con el total!');
    } else {
      console.log('   ✅ Los buckets cuadran correctamente');
    }
  }
  console.log();

  // 4. Buscar movimientos recientes (últimos 30 días)
  const fechaInicio = new Date();
  fechaInicio.setDate(fechaInicio.getDate() - 30);

  console.log(`📋 MOVIMIENTOS DE SALDO RECIENTES (desde ${fechaInicio.toISOString().split('T')[0]}):`);
  console.log('─'.repeat(100));

  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      fecha: { gte: fechaInicio }
    },
    include: { moneda: true },
    orderBy: { fecha: 'desc' }
  });

  console.log(`   Total de movimientos encontrados: ${movimientos.length}`);
  console.log();

  // Mostrar los últimos 20 movimientos
  const ultimosMovimientos = movimientos.slice(0, 20);
  
  for (const m of ultimosMovimientos) {
    const fecha = new Date(m.fecha);
    fecha.setHours(fecha.getHours() - 5); // Ecuador
    const tipo = Number(m.monto) > 0 ? 'INGRESO' : Number(m.monto) < 0 ? 'EGRESO' : 'AJUSTE';
    
    console.log(`   ${fecha.toISOString().slice(0, 16).replace('T', ' ')} │ ${tipo.padEnd(8)} │ ${m.monto.toString().padStart(10)} │ ${(m.descripcion || 'Sin descripción').substring(0, 50)}`);
  }

  if (movimientos.length > 20) {
    console.log(`   ... y ${movimientos.length - 20} movimientos más`);
  }
  console.log();

  // 5. Buscar movimientos que afecten específicamente MONEDAS
  console.log('🔎 BUSCANDO MOVIMIENTOS QUE AFECTEN MONEDAS:');
  console.log('─'.repeat(100));
  
  // Buscar en historial de saldos
  const historial = await prisma.historialSaldo.findMany({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: monedaUSD.id,
      fecha: { gte: fechaInicio }
    },
    orderBy: { fecha: 'desc' }
  });

  console.log(`   Registros en historial de saldos: ${historial.length}`);
  
  if (historial.length > 0) {
    console.log('\n   Últimos cambios en buckets:');
    const ultimosHist = historial.slice(0, 10);
    for (const h of ultimosHist) {
      const fecha = new Date(h.fecha);
      fecha.setHours(fecha.getHours() - 5);
      console.log(`   ${fecha.toISOString().slice(0, 16).replace('T', ' ')} │ B:${h.billetes_anterior}→${h.billetes_nuevo} │ M:${h.monedas_anterior}→${h.monedas_nuevo} │ ${h.razon?.substring(0, 30)}`);
    }
  }
  console.log();

  // 6. Buscar cambios de divisa recientes
  console.log('💱 CAMBIOS DE DIVISA RECIENTES:');
  console.log('─'.repeat(100));

  const cambios = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: puntoId,
      fecha: { gte: fechaInicio }
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
      usuario: true
    },
    orderBy: { fecha: 'desc' }
  });

  console.log(`   Total cambios: ${cambios.length}`);
  
  cambios.slice(0, 10).forEach((c, idx) => {
    const fecha = new Date(c.fecha);
    fecha.setHours(fecha.getHours() - 5);
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${fecha.toISOString().slice(0, 16).replace('T', ' ')} │ ${c.monto_origen} ${c.monedaOrigen?.codigo} → ${c.monto_destino} ${c.monedaDestino?.codigo} │ ${c.usuario?.username || 'N/A'}`);
  });

  if (cambios.length > 10) {
    console.log(`   ... y ${cambios.length - 10} cambios más`);
  }
  console.log();

  // 7. Análisis específico del problema
  console.log('📊 ANÁLISIS DEL PROBLEMA:');
  console.log('─'.repeat(100));
  
  if (saldoUSD) {
    const monedasActuales = Number(saldoUSD.monedas_fisicas);
    console.log(`   Monedas actuales en sistema: $${monedasActuales.toFixed(2)}`);
    
    if (monedasActuales > 0) {
      console.log(`   ❌ El usuario dice que NO debería haber monedas, pero hay $${monedasActuales.toFixed(2)}`);
      console.log(`   Billetes en sistema: $${Number(saldoUSD.billetes).toFixed(2)}`);
      console.log(`   Total: $${Number(saldoUSD.cantidad).toFixed(2)}`);
      console.log();
      console.log('   POSIBLES CAUSAS:');
      console.log('   1. Algún cambio o movimiento se registró incorrectamente asignando a monedas');
      console.log('   2. Un ajuste manual movió fondos a monedas por error');
      console.log('   3. Una transferencia se recibió/aceptó con asignación a monedas');
    }
  }
  console.log();

  console.log('╔' + '═'.repeat(100) + '╗');
  console.log('║  INVESTIGACIÓN COMPLETADA - NO SE REALIZARON CAMBIOS' + ' '.repeat(50) + '║');
  console.log('╚' + '═'.repeat(100) + '╝');

  await prisma.$disconnect();
}

investigarElBosque().catch(console.error);
