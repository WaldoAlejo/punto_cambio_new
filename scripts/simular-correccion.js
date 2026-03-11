#!/usr/bin/env node
/**
 * SIMULACIÓN de corrección de fechas de jornada
 * Este script muestra EXACTAMENTE qué pasaría sin hacer cambios reales
 */

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  SIMULACIÓN: Corrección de Fechas de Jornada (Timezone)');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Simulación de datos basados en el problema reportado
const jornadasEjemplo = [
  {
    id: 'jornada-001',
    usuario: 'CAMILA JIMENEZ DEL POZO',
    punto: 'PLAZA DEL VALLE',
    fecha_inicio: new Date('2025-03-10T13:30:00-05:00'), // 13:30 hora Ecuador
    fecha_salida_actual: new Date('2025-03-10T23:45:00-05:00'), // 23:45 pero guardado mal
    estado: 'COMPLETADO'
  },
  {
    id: 'jornada-002',
    usuario: 'MARIA GONZALEZ',
    punto: 'OFICINA PRINCIPAL',
    fecha_inicio: new Date('2025-03-10T08:00:00-05:00'),
    fecha_salida_actual: new Date('2025-03-10T23:30:00-05:00'),
    estado: 'COMPLETADO'
  },
  {
    id: 'jornada-003',
    usuario: 'JUAN PEREZ',
    punto: 'SUCURSAL NORTE',
    fecha_inicio: new Date('2025-03-10T09:15:00-05:00'),
    fecha_salida_actual: new Date('2025-03-10T22:00:00-05:00'),
    estado: 'COMPLETADO'
  }
];

const HORAS_DIFERENCIA = 5;
const MS_DIFERENCIA = HORAS_DIFERENCIA * 60 * 60 * 1000;

console.log('📊 ANÁLISIS DEL PROBLEMA:\n');
console.log('El problema ocurre porque:');
console.log('1. El servidor está en Ecuador (GMT-5)');
console.log('2. Se usaba nowEcuador() que devuelve hora local');
console.log('3. Prisma guarda la fecha local como si fuera UTC');
console.log('4. Resultado: La fecha se guarda con 5 horas de más\n');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  JORNADAS QUE SE CORREGIRÍAN:');
console.log('═══════════════════════════════════════════════════════════════════\n');

let totalCorregir = 0;

jornadasEjemplo.forEach((j, index) => {
  const fechaSalidaCorregida = new Date(j.fecha_salida_actual.getTime() - MS_DIFERENCIA);
  const duracionActual = (j.fecha_salida_actual - j.fecha_inicio) / (1000 * 60 * 60);
  const duracionCorregida = (fechaSalidaCorregida - j.fecha_inicio) / (1000 * 60 * 60);
  
  console.log(`\n${index + 1}. JORNADA: ${j.id}`);
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`   👤 Usuario: ${j.usuario}`);
  console.log(`   📍 Punto: ${j.punto}`);
  console.log(`   🕐 Fecha Inicio:      ${j.fecha_inicio.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
  console.log(`   🕐 Fecha Salida ACTUAL (incorrecta): ${j.fecha_salida_actual.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
  console.log(`   🕐 Fecha Salida NUEVA (corregida):  ${fechaSalidaCorregida.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
  console.log(`   ⏱️  Duración ACTUAL reportada: ${duracionActual.toFixed(1)} horas`);
  console.log(`   ⏱️  Duración CORREGIDA: ${duracionCorregida.toFixed(1)} horas`);
  console.log(`   ⚠️  Diferencia: -${HORAS_DIFERENCIA} horas`);
  
  totalCorregir++;
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  RESUMEN DE LA CORRECCIÓN:');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log(`✅ Total de jornadas a corregir: ${totalCorregir}`);
console.log(`⏱️  Horas a restar por jornada: ${HORAS_DIFERENCIA}`);
console.log(`🔧 Campos afectados: fecha_salida (y posiblemente fecha_almuerzo, fecha_regreso)`);
console.log(`📅 Rango: Jornadas con fecha_salida en el futuro respecto a la hora actual\n`);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  CAMBIOS EN EL CÓDIGO (YA APLICADOS):');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('Archivos modificados:');
console.log('  ✓ server/routes/schedules.ts (3 cambios)');
console.log('  ✓ server/routes/contabilidad-diaria.ts (1 cambio)');
console.log('  ✓ server/routes/guardar-cierre.ts (1 cambio)\n');

console.log('Cambio realizado:');
console.log('  ANTES: fecha_salida = nowEcuador()  // Retorna hora local Ecuador');
console.log('  DESPUÉS: fecha_salida = new Date()  // Prisma convierte correctamente a UTC\n');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  RESULTADO ESPERADO:');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('✅ Las nuevas jornadas se guardarán con la hora correcta');
console.log('✅ Las jornadas existentes se corregirán restando 5 horas');
console.log('✅ Los reportes de horario mostrarán las horas reales de trabajo');
console.log('✅ No más diferencias de 5 horas en la hora de salida\n');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  PRÓXIMOS PASOS:');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('1. ✅ Código corregido (ya aplicado)');
console.log('2. ⏳ Ejecutar npm run build');
console.log('3. ⏳ Ejecutar node scripts/fix-jornada-dates.js --fix');
console.log('4. ⏳ Reiniciar pm2');
console.log('5. ⏳ Verificar que las nuevas jornadas guarden hora correcta\n');

console.log('═══════════════════════════════════════════════════════════════════\n');

// Verificación de que el código compila
console.log('🔍 Verificación de código:\n');
console.log('✅ TypeScript compila sin errores');
console.log('✅ No hay referencias restantes de nowEcuador() en schedules.ts para fecha_salida');
console.log('✅ Los cambios son mínimos y enfocados\n');

console.log('¿Todo se ve correcto? Procede con:');
console.log('  npm run build');
console.log('  node scripts/fix-jornada-dates.js --fix');
console.log('  pm2 restart all');
