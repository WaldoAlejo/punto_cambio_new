import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixWithSQL() {
  console.log('=== CORRECCIÓN DIRECTA CON SQL ===\n');
  console.log('Restando 5 horas a todas las fechas...\n');
  
  try {
    // Ejecutar correcciones en paralelo para mayor velocidad
    const results = await prisma.$transaction([
      // ServicioExternoMovimiento
      prisma.$executeRaw`UPDATE "ServicioExternoMovimiento" SET fecha = fecha - interval '5 hours'`,
      
      // MovimientoSaldo
      prisma.$executeRaw`UPDATE "MovimientoSaldo" SET fecha = fecha - interval '5 hours'`,
      
      // CambioDivisa - fecha
      prisma.$executeRaw`UPDATE "CambioDivisa" SET fecha = fecha - interval '5 hours' WHERE fecha IS NOT NULL`,
      
      // CambioDivisa - fecha_completado
      prisma.$executeRaw`UPDATE "CambioDivisa" SET fecha_completado = fecha_completado - interval '5 hours' WHERE fecha_completado IS NOT NULL`,
      
      // Transferencia - fecha
      prisma.$executeRaw`UPDATE "Transferencia" SET fecha = fecha - interval '5 hours'`,
      
      // Transferencia - fecha_envio
      prisma.$executeRaw`UPDATE "Transferencia" SET fecha_envio = fecha_envio - interval '5 hours' WHERE fecha_envio IS NOT NULL`,
      
      // Transferencia - fecha_aprobacion
      prisma.$executeRaw`UPDATE "Transferencia" SET fecha_aprobacion = fecha_aprobacion - interval '5 hours' WHERE fecha_aprobacion IS NOT NULL`,
      
      // Transferencia - fecha_rechazo
      prisma.$executeRaw`UPDATE "Transferencia" SET fecha_rechazo = fecha_rechazo - interval '5 hours' WHERE fecha_rechazo IS NOT NULL`,
      
      // Transferencia - fecha_aceptacion
      prisma.$executeRaw`UPDATE "Transferencia" SET fecha_aceptacion = fecha_aceptacion - interval '5 hours' WHERE fecha_aceptacion IS NOT NULL`,
      
      // CierreDiario - fecha
      prisma.$executeRaw`UPDATE "CierreDiario" SET fecha = fecha - interval '5 hours'`,
      
      // CierreDiario - fecha_cierre
      prisma.$executeRaw`UPDATE "CierreDiario" SET fecha_cierre = fecha_cierre - interval '5 hours' WHERE fecha_cierre IS NOT NULL`,
    ]);
    
    console.log('✅ Todas las tablas actualizadas:');
    console.log('   - ServicioExternoMovimiento');
    console.log('   - MovimientoSaldo');
    console.log('   - CambioDivisa (fecha y fecha_completado)');
    console.log('   - Transferencia (todas las fechas)');
    console.log('   - CierreDiario (fecha y fecha_cierre)');
    
    console.log('\n✅ Corrección completada: -5 horas aplicado a todos los registros');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Este script RESTARÁ 5 horas de todas las fechas usando SQL directo');
console.log('Para ejecutar: CONFIRM=1 npx tsx scripts/fix-timezone-sql.ts\n');

const confirm = process.env.CONFIRM === '1';
if (!confirm) {
  console.log('❌ Ejecución cancelada. Usa CONFIRM=1 para confirmar.');
  process.exit(0);
}

fixWithSQL().catch(console.error);
