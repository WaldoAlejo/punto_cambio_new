/**
 * Corregir la apertura de caja de SCALA para que muestre el saldo correcto
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function corregir() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CORRECCIÓN DE APERTURA DE CAJA - SCALA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Obtener punto SCALA
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: 'SCALA' },
    select: { id: true, nombre: true },
  });

  if (!punto) {
    console.log('❌ Punto SCALA no encontrado');
    return;
  }

  console.log(`Punto: ${punto.nombre} (${punto.id})\n`);

  // 2. Obtener jornada activa
  const jornada = await prisma.jornada.findFirst({
    where: {
      punto_atencion_id: punto.id,
      estado: { in: ['ACTIVO', 'ALMUERZO'] },
      fecha_salida: null,
    },
    orderBy: { fecha_inicio: 'desc' },
    include: {
      usuario: { select: { id: true, nombre: true } },
    },
  });

  if (!jornada) {
    console.log('❌ No hay jornada activa para SCALA');
    return;
  }

  console.log(`Jornada activa:`);
  console.log(`  ID: ${jornada.id}`);
  console.log(`  Usuario: ${jornada.usuario?.nombre}`);
  console.log(`  Estado: ${jornada.estado}\n`);

  // 3. Buscar apertura de caja existente
  const apertura = await prisma.aperturaCaja.findUnique({
    where: { jornada_id: jornada.id },
  });

  if (!apertura) {
    console.log('ℹ️  No existe apertura de caja para esta jornada');
    console.log('   El operador debe iniciar la apertura normalmente.\n');
    return;
  }

  console.log(`Apertura existente:`);
  console.log(`  ID: ${apertura.id}`);
  console.log(`  Estado: ${apertura.estado}`);
  console.log(`  Fecha: ${apertura.fecha.toISOString()}\n`);

  // 4. Verificar saldo esperado actual
  const saldoEsperadoActual = Array.isArray(apertura.saldo_esperado)
    ? apertura.saldo_esperado
    : [];

  console.log('Saldo esperado actual en apertura:');
  for (const s of saldoEsperadoActual) {
    console.log(`  ${s.codigo}: ${s.cantidad} (billetes: ${s.billetes}, monedas: ${s.monedas})`);
  }
  console.log();

  // 5. Obtener saldo real de EUR
  const monedaEUR = await prisma.moneda.findFirst({
    where: { codigo: 'EUR' },
    select: { id: true, codigo: true, nombre: true, simbolo: true, denominaciones: true },
  });

  const saldoReal = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: monedaEUR.id,
      },
    },
  });

  const cantidadReal = Number(saldoReal?.cantidad || 0);
  const billetesReal = Number(saldoReal?.billetes || cantidadReal);
  const monedasReal = Number(saldoReal?.monedas_fisicas || 0);

  console.log('Saldo real en tabla Saldo:');
  console.log(`  EUR: ${cantidadReal.toFixed(2)}`);
  console.log(`  Billetes: ${billetesReal.toFixed(2)}`);
  console.log(`  Monedas: ${monedasReal.toFixed(2)}\n`);

  // 6. Verificar si necesita corrección
  const saldoEURActual = saldoEsperadoActual.find(s => s.codigo === 'EUR');
  
  if (!saldoEURActual) {
    console.log('⚠️  EUR no está en el saldo esperado de la apertura');
    console.log('   Se debe agregar EUR al saldo esperado.\n');
    
    // Agregar EUR al saldo esperado
    const nuevoSaldoEsperado = [
      ...saldoEsperadoActual,
      {
        moneda_id: monedaEUR.id,
        codigo: monedaEUR.codigo,
        nombre: monedaEUR.nombre,
        simbolo: monedaEUR.simbolo,
        cantidad: cantidadReal,
        billetes: billetesReal,
        monedas: monedasReal,
        denominaciones: monedaEUR.denominaciones || {
          billetes: [500, 200, 100, 50, 20, 10, 5],
          monedas: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
        },
      },
    ];

    await prisma.aperturaCaja.update({
      where: { id: apertura.id },
      data: {
        saldo_esperado: nuevoSaldoEsperado,
      },
    });

    console.log('✅ EUR agregado al saldo esperado de la apertura.\n');
    
  } else if (Math.abs(saldoEURActual.cantidad - cantidadReal) > 0.01) {
    console.log(`⚠️  El saldo esperado (${saldoEURActual.cantidad}) no coincide con el real (${cantidadReal.toFixed(2)})`);
    console.log('   Se debe actualizar el saldo esperado.\n');

    // Actualizar el saldo EUR
    const nuevoSaldoEsperado = saldoEsperadoActual.map(s => {
      if (s.codigo === 'EUR') {
        return {
          ...s,
          cantidad: cantidadReal,
          billetes: billetesReal,
          monedas: monedasReal,
        };
      }
      return s;
    });

    await prisma.aperturaCaja.update({
      where: { id: apertura.id },
      data: {
        saldo_esperado: nuevoSaldoEsperado,
      },
    });

    console.log('✅ Saldo esperado actualizado.\n');
    
  } else {
    console.log('✅ El saldo esperado ya está correcto.\n');
  }

  // 7. Verificar el resultado
  const aperturaActualizada = await prisma.aperturaCaja.findUnique({
    where: { id: apertura.id },
  });

  const saldoEsperadoFinal = Array.isArray(aperturaActualizada.saldo_esperado)
    ? aperturaActualizada.saldo_esperado
    : [];

  const saldoEURFinal = saldoEsperadoFinal.find(s => s.codigo === 'EUR');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('RESULTADO FINAL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (saldoEURFinal) {
    console.log(`✅ EUR ahora aparece en la apertura:`);
    console.log(`   Cantidad: ${saldoEURFinal.cantidad}`);
    console.log(`   Billetes: ${saldoEURFinal.billetes}`);
    console.log(`   Monedas: ${saldoEURFinal.monedas}\n`);
    console.log('El operador ya debería poder ver el saldo en la apertura de caja.');
  } else {
    console.log('❌ EUR sigue sin aparecer en la apertura');
  }

  await prisma.$disconnect();
}

corregir().catch(console.error);
