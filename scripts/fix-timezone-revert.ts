import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

async function revertTimezoneData() {
  console.log('=== REVIRTIENDO CORRECCIÓN EXCESIVA ===\n');
  console.log('Restando 5 horas de todas las fechas\n');
  
  try {
    // 1. ServicioExternoMovimiento
    console.log('1. Revirtiendo ServicioExternoMovimiento...');
    const seMovs = await prisma.servicioExternoMovimiento.findMany({ select: { id: true, fecha: true } });
    for (const mov of seMovs) {
      const newDate = new Date(mov.fecha.getTime() - FIVE_HOURS_MS);
      await prisma.servicioExternoMovimiento.update({ where: { id: mov.id }, data: { fecha: newDate } });
    }
    console.log(`   ✅ ${seMovs.length} registros`);
    
    // 2. MovimientoSaldo
    console.log('2. Revirtiendo MovimientoSaldo...');
    const msMovs = await prisma.movimientoSaldo.findMany({ select: { id: true, fecha: true } });
    for (const mov of msMovs) {
      const newDate = new Date(mov.fecha.getTime() - FIVE_HOURS_MS);
      await prisma.movimientoSaldo.update({ where: { id: mov.id }, data: { fecha: newDate } });
    }
    console.log(`   ✅ ${msMovs.length} registros`);
    
    // 3. CambioDivisa - fecha
    console.log('3. Revirtiendo CambioDivisa (fecha)...');
    const cdFecha = await prisma.cambioDivisa.findMany({ select: { id: true, fecha: true } });
    for (const mov of cdFecha) {
      if (mov.fecha) {
        const newDate = new Date(mov.fecha.getTime() - FIVE_HOURS_MS);
        await prisma.cambioDivisa.update({ where: { id: mov.id }, data: { fecha: newDate } });
      }
    }
    console.log(`   ✅ ${cdFecha.length} registros`);
    
    // 4. CambioDivisa - fecha_completado
    console.log('4. Revirtiendo CambioDivisa (fecha_completado)...');
    const cdCompl = await prisma.cambioDivisa.findMany({ select: { id: true, fecha_completado: true } });
    for (const mov of cdCompl) {
      if (mov.fecha_completado) {
        const newDate = new Date(mov.fecha_completado.getTime() - FIVE_HOURS_MS);
        await prisma.cambioDivisa.update({ where: { id: mov.id }, data: { fecha_completado: newDate } });
      }
    }
    console.log(`   ✅ ${cdCompl.length} registros`);
    
    // 5. Transferencia - fecha
    console.log('5. Revirtiendo Transferencia (fecha)...');
    const transFecha = await prisma.transferencia.findMany({ select: { id: true, fecha: true } });
    for (const mov of transFecha) {
      const newDate = new Date(mov.fecha.getTime() - FIVE_HOURS_MS);
      await prisma.transferencia.update({ where: { id: mov.id }, data: { fecha: newDate } });
    }
    console.log(`   ✅ ${transFecha.length} registros`);
    
    // 6. Transferencia - fecha_envio
    console.log('6. Revirtiendo Transferencia (fecha_envio)...');
    const transEnvio = await prisma.transferencia.findMany({ select: { id: true, fecha_envio: true } });
    for (const mov of transEnvio) {
      if (mov.fecha_envio) {
        const newDate = new Date(mov.fecha_envio.getTime() - FIVE_HOURS_MS);
        await prisma.transferencia.update({ where: { id: mov.id }, data: { fecha_envio: newDate } });
      }
    }
    console.log(`   ✅ ${transEnvio.length} registros`);
    
    // 7. Transferencia - fecha_aprobacion
    console.log('7. Revirtiendo Transferencia (fecha_aprobacion)...');
    const transAprob = await prisma.transferencia.findMany({ select: { id: true, fecha_aprobacion: true } });
    for (const mov of transAprob) {
      if (mov.fecha_aprobacion) {
        const newDate = new Date(mov.fecha_aprobacion.getTime() - FIVE_HOURS_MS);
        await prisma.transferencia.update({ where: { id: mov.id }, data: { fecha_aprobacion: newDate } });
      }
    }
    console.log(`   ✅ ${transAprob.length} registros`);
    
    // 8. Transferencia - fecha_rechazo
    console.log('8. Revirtiendo Transferencia (fecha_rechazo)...');
    const transRech = await prisma.transferencia.findMany({ select: { id: true, fecha_rechazo: true } });
    for (const mov of transRech) {
      if (mov.fecha_rechazo) {
        const newDate = new Date(mov.fecha_rechazo.getTime() - FIVE_HOURS_MS);
        await prisma.transferencia.update({ where: { id: mov.id }, data: { fecha_rechazo: newDate } });
      }
    }
    console.log(`   ✅ ${transRech.length} registros`);
    
    // 9. Transferencia - fecha_aceptacion
    console.log('9. Revirtiendo Transferencia (fecha_aceptacion)...');
    const transAcept = await prisma.transferencia.findMany({ select: { id: true, fecha_aceptacion: true } });
    for (const mov of transAcept) {
      if (mov.fecha_aceptacion) {
        const newDate = new Date(mov.fecha_aceptacion.getTime() - FIVE_HOURS_MS);
        await prisma.transferencia.update({ where: { id: mov.id }, data: { fecha_aceptacion: newDate } });
      }
    }
    console.log(`   ✅ ${transAcept.length} registros`);
    
    // 10. CierreDiario - fecha
    console.log('10. Revirtiendo CierreDiario (fecha)...');
    const cdDiario = await prisma.cierreDiario.findMany({ select: { id: true, fecha: true } });
    for (const mov of cdDiario) {
      const newDate = new Date(mov.fecha.getTime() - FIVE_HOURS_MS);
      await prisma.cierreDiario.update({ where: { id: mov.id }, data: { fecha: newDate } });
    }
    console.log(`   ✅ ${cdDiario.length} registros`);
    
    // 11. CierreDiario - fecha_cierre
    console.log('11. Revirtiendo CierreDiario (fecha_cierre)...');
    const cdCierre = await prisma.cierreDiario.findMany({ select: { id: true, fecha_cierre: true } });
    for (const mov of cdCierre) {
      if (mov.fecha_cierre) {
        const newDate = new Date(mov.fecha_cierre.getTime() - FIVE_HOURS_MS);
        await prisma.cierreDiario.update({ where: { id: mov.id }, data: { fecha_cierre: newDate } });
      }
    }
    console.log(`   ✅ ${cdCierre.length} registros`);
    
    console.log('\n✅ Todos los datos han sido revertidos (-5 horas)');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Este script REVERTIRÁ la suma excesiva de 5 horas');
console.log('Restando 5 horas de todas las fechas para volver al estado original\n');
console.log('Para ejecutar: CONFIRM=1 npx tsx scripts/fix-timezone-revert.ts\n');

const confirm = process.env.CONFIRM === '1';
if (!confirm) {
  console.log('❌ Ejecución cancelada. Usa CONFIRM=1 para confirmar.');
  process.exit(0);
}

revertTimezoneData().catch(console.error);
