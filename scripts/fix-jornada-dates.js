#!/usr/bin/env node
/**
 * Script para corregir fechas de jornadas con desfase de 5 horas
 * Ejecutar: node scripts/fix-jornada-dates.js --dry-run (para ver sin cambiar)
 * Ejecutar: node scripts/fix-jornada-dates.js --fix (para aplicar cambios)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HOY = new Date();
const HORAS_DIFERENCIA = 5;
const MS_DIFERENCIA = HORAS_DIFERENCIA * 60 * 60 * 1000;

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || (!args.includes('--fix'));
  const isFix = args.includes('--fix');

  console.log('=== CORRECCIÓN DE FECHAS DE JORNADA ===\n');
  console.log(`Modo: ${isDryRun ? 'SIMULACIÓN (dry-run)' : 'CORRECCIÓN REAL'}\n`);

  if (isDryRun && !isFix) {
    console.log('⚠️  Esto es una simulación. Para aplicar cambios, usa: --fix\n');
  }

  // 1. Buscar jornadas con fecha_salida en el futuro (indicativo del bug)
  const unaHoraDespues = new Date(HOY.getTime() + 60 * 60 * 1000);
  
  const jornadasConDesfase = await prisma.jornada.findMany({
    where: {
      fecha_salida: {
        gt: unaHoraDespues
      }
    },
    include: {
      usuario: { select: { nombre: true, username: true } },
      puntoAtencion: { select: { nombre: true } }
    },
    orderBy: { fecha_salida: 'desc' }
  });

  console.log(`📊 Encontradas ${jornadasConDesfase.length} jornadas con fecha_salida en el futuro`);
  console.log('');

  if (jornadasConDesfase.length === 0) {
    console.log('✅ No hay jornadas para corregir');
    await prisma.$disconnect();
    return;
  }

  // Mostrar las jornadas afectadas
  console.log('Jornadas a corregir:');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  for (const j of jornadasConDesfase) {
    const fechaSalidaActual = j.fecha_salida;
    const fechaSalidaCorregida = new Date(fechaSalidaActual.getTime() - MS_DIFERENCIA);
    
    console.log(`\n👤 ${j.usuario?.nombre || 'N/A'} (${j.usuario?.username || 'N/A'})`);
    console.log(`📍 Punto: ${j.puntoAtencion?.nombre || 'N/A'}`);
    console.log(`📅 Fecha actual (incorrecta): ${fechaSalidaActual.toISOString()}`);
    console.log(`📅 Fecha corregida:          ${fechaSalidaCorregida.toISOString()}`);
    console.log(`⏱️  Diferencia: ${HORAS_DIFERENCIA} horas`);
  }

  console.log('\n─────────────────────────────────────────────────────────────────────');

  if (isDryRun && !isFix) {
    console.log('\n⚠️  SIMULACIÓN: No se aplicaron cambios');
    console.log('Para aplicar los cambios, ejecuta: node scripts/fix-jornada-dates.js --fix');
    await prisma.$disconnect();
    return;
  }

  // Aplicar corrección
  console.log('\n🔄 Aplicando correcciones...\n');

  let contador = 0;
  for (const j of jornadasConDesfase) {
    const fechaSalidaNueva = new Date(j.fecha_salida.getTime() - MS_DIFERENCIA);
    
    await prisma.jornada.update({
      where: { id: j.id },
      data: { fecha_salida: fechaSalidaNueva }
    });
    
    contador++;
    console.log(`✅ Corregida jornada ${j.id} - ${j.usuario?.nombre}`);
  }

  console.log(`\n✅ ${contador} jornadas corregidas exitosamente`);

  // También verificar fecha_almuerzo y fecha_regreso
  console.log('\n🔍 Verificando fecha_almuerzo y fecha_regreso...');
  
  const jornadasAlmuerzo = await prisma.jornada.findMany({
    where: {
      OR: [
        { fecha_almuerzo: { gt: unaHoraDespues } },
        { fecha_regreso: { gt: unaHoraDespues } }
      ]
    }
  });

  if (jornadasAlmuerzo.length > 0) {
    console.log(`Encontradas ${jornadasAlmuerzo.length} jornadas con desfase en almuerzo/regreso`);
    
    for (const j of jornadasAlmuerzo) {
      const updateData = {};
      
      if (j.fecha_almuerzo && j.fecha_almuerzo > unaHoraDespues) {
        updateData.fecha_almuerzo = new Date(j.fecha_almuerzo.getTime() - MS_DIFERENCIA);
      }
      
      if (j.fecha_regreso && j.fecha_regreso > unaHoraDespues) {
        updateData.fecha_regreso = new Date(j.fecha_regreso.getTime() - MS_DIFERENCIA);
      }
      
      await prisma.jornada.update({
        where: { id: j.id },
        data: updateData
      });
      
      console.log(`✅ Corregidos horarios de almuerzo para jornada ${j.id}`);
    }
  } else {
    console.log('No se encontraron desfases en fecha_almuerzo ni fecha_regreso');
  }

  await prisma.$disconnect();
  console.log('\n✅ Proceso completado');
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
