import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000; // 5 horas en milisegundos

async function fixTimezoneData() {
  console.log('=== CORRECCIÓN DE ZONA HORARIA EN BASE DE DATOS ===\n');
  console.log('Ajustando todas las fechas: SUMANDO 5 horas (UTC-5 → UTC)\n');
  
  const results: Record<string, { before: number; after: number; error?: string }> = {};
  
  try {
    // 1. ServicioExternoMovimiento
    console.log('1. Corrigiendo ServicioExternoMovimiento...');
    const seMovs = await prisma.servicioExternoMovimiento.findMany({ select: { id: true, fecha: true } });
    let seCount = 0;
    for (const mov of seMovs) {
      const newDate = new Date(mov.fecha.getTime() + FIVE_HOURS_MS);
      await prisma.servicioExternoMovimiento.update({
        where: { id: mov.id },
        data: { fecha: newDate }
      });
      seCount++;
    }
    results['ServicioExternoMovimiento'] = { before: seCount, after: seCount };
    console.log(`   ✅ ${seCount} registros actualizados`);
    
    // 2. MovimientoSaldo
    console.log('2. Corrigiendo MovimientoSaldo...');
    const msMovs = await prisma.movimientoSaldo.findMany({ select: { id: true, fecha: true } });
    let msCount = 0;
    for (const mov of msMovs) {
      const newDate = new Date(mov.fecha.getTime() + FIVE_HOURS_MS);
      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: { fecha: newDate }
      });
      msCount++;
    }
    results['MovimientoSaldo'] = { before: msCount, after: msCount };
    console.log(`   ✅ ${msCount} registros actualizados`);
    
    // 3. CambioDivisa - fecha
    console.log('3. Corrigiendo CambioDivisa (fecha)...');
    const cdFecha = await prisma.cambioDivisa.findMany({ 
      select: { id: true, fecha: true } 
    });
    let cdFechaCount = 0;
    for (const mov of cdFecha) {
      if (mov.fecha) {
        const newDate = new Date(mov.fecha.getTime() + FIVE_HOURS_MS);
        await prisma.cambioDivisa.update({
          where: { id: mov.id },
          data: { fecha: newDate }
        });
        cdFechaCount++;
      }
    }
    results['CambioDivisa.fecha'] = { before: cdFechaCount, after: cdFechaCount };
    console.log(`   ✅ ${cdFechaCount} registros actualizados`);
    
    // 4. CambioDivisa - fecha_completado
    console.log('4. Corrigiendo CambioDivisa (fecha_completado)...');
    const cdCompl = await prisma.cambioDivisa.findMany({ 
      select: { id: true, fecha_completado: true } 
    });
    let cdComplCount = 0;
    for (const mov of cdCompl) {
      if (mov.fecha_completado) {
        const newDate = new Date(mov.fecha_completado.getTime() + FIVE_HOURS_MS);
        await prisma.cambioDivisa.update({
          where: { id: mov.id },
          data: { fecha_completado: newDate }
        });
        cdComplCount++;
      }
    }
    results['CambioDivisa.fecha_completado'] = { before: cdComplCount, after: cdComplCount };
    console.log(`   ✅ ${cdComplCount} registros actualizados`);
    
    // 5. Transferencia - fecha
    console.log('5. Corrigiendo Transferencia (fecha)...');
    const transFecha = await prisma.transferencia.findMany({ select: { id: true, fecha: true } });
    let transFechaCount = 0;
    for (const mov of transFecha) {
      const newDate = new Date(mov.fecha.getTime() + FIVE_HOURS_MS);
      await prisma.transferencia.update({
        where: { id: mov.id },
        data: { fecha: newDate }
      });
      transFechaCount++;
    }
    results['Transferencia.fecha'] = { before: transFechaCount, after: transFechaCount };
    console.log(`   ✅ ${transFechaCount} registros actualizados`);
    
    // 6. Transferencia - fecha_envio
    console.log('6. Corrigiendo Transferencia (fecha_envio)...');
    const transEnvio = await prisma.transferencia.findMany({ 
      select: { id: true, fecha_envio: true } 
    });
    let transEnvioCount = 0;
    for (const mov of transEnvio) {
      if (mov.fecha_envio) {
        const newDate = new Date(mov.fecha_envio.getTime() + FIVE_HOURS_MS);
        await prisma.transferencia.update({
          where: { id: mov.id },
          data: { fecha_envio: newDate }
        });
        transEnvioCount++;
      }
    }
    results['Transferencia.fecha_envio'] = { before: transEnvioCount, after: transEnvioCount };
    console.log(`   ✅ ${transEnvioCount} registros actualizados`);
    
    // 7. Transferencia - fecha_aprobacion
    console.log('7. Corrigiendo Transferencia (fecha_aprobacion)...');
    const transAprob = await prisma.transferencia.findMany({ 
      select: { id: true, fecha_aprobacion: true } 
    });
    let transAprobCount = 0;
    for (const mov of transAprob) {
      if (mov.fecha_aprobacion) {
        const newDate = new Date(mov.fecha_aprobacion.getTime() + FIVE_HOURS_MS);
        await prisma.transferencia.update({
          where: { id: mov.id },
          data: { fecha_aprobacion: newDate }
        });
        transAprobCount++;
      }
    }
    results['Transferencia.fecha_aprobacion'] = { before: transAprobCount, after: transAprobCount };
    console.log(`   ✅ ${transAprobCount} registros actualizados`);
    
    // 8. Transferencia - fecha_rechazo
    console.log('8. Corrigiendo Transferencia (fecha_rechazo)...');
    const transRech = await prisma.transferencia.findMany({ 
      select: { id: true, fecha_rechazo: true } 
    });
    let transRechCount = 0;
    for (const mov of transRech) {
      if (mov.fecha_rechazo) {
        const newDate = new Date(mov.fecha_rechazo.getTime() + FIVE_HOURS_MS);
        await prisma.transferencia.update({
          where: { id: mov.id },
          data: { fecha_rechazo: newDate }
        });
        transRechCount++;
      }
    }
    results['Transferencia.fecha_rechazo'] = { before: transRechCount, after: transRechCount };
    console.log(`   ✅ ${transRechCount} registros actualizados`);
    
    // 9. Transferencia - fecha_aceptacion
    console.log('9. Corrigiendo Transferencia (fecha_aceptacion)...');
    const transAcept = await prisma.transferencia.findMany({ 
      select: { id: true, fecha_aceptacion: true } 
    });
    let transAceptCount = 0;
    for (const mov of transAcept) {
      if (mov.fecha_aceptacion) {
        const newDate = new Date(mov.fecha_aceptacion.getTime() + FIVE_HOURS_MS);
        await prisma.transferencia.update({
          where: { id: mov.id },
          data: { fecha_aceptacion: newDate }
        });
        transAceptCount++;
      }
    }
    results['Transferencia.fecha_aceptacion'] = { before: transAceptCount, after: transAceptCount };
    console.log(`   ✅ ${transAceptCount} registros actualizados`);
    
    // 10. CierreDiario - fecha
    console.log('10. Corrigiendo CierreDiario (fecha)...');
    const cdDiario = await prisma.cierreDiario.findMany({ select: { id: true, fecha: true } });
    let cdDiarioCount = 0;
    for (const mov of cdDiario) {
      const newDate = new Date(mov.fecha.getTime() + FIVE_HOURS_MS);
      await prisma.cierreDiario.update({
        where: { id: mov.id },
        data: { fecha: newDate }
      });
      cdDiarioCount++;
    }
    results['CierreDiario.fecha'] = { before: cdDiarioCount, after: cdDiarioCount };
    console.log(`   ✅ ${cdDiarioCount} registros actualizados`);
    
    // 11. CierreDiario - fecha_cierre
    console.log('11. Corrigiendo CierreDiario (fecha_cierre)...');
    const cdCierre = await prisma.cierreDiario.findMany({ 
      select: { id: true, fecha_cierre: true } 
    });
    let cdCierreCount = 0;
    for (const mov of cdCierre) {
      if (mov.fecha_cierre) {
        const newDate = new Date(mov.fecha_cierre.getTime() + FIVE_HOURS_MS);
        await prisma.cierreDiario.update({
          where: { id: mov.id },
          data: { fecha_cierre: newDate }
        });
        cdCierreCount++;
      }
    }
    results['CierreDiario.fecha_cierre'] = { before: cdCierreCount, after: cdCierreCount };
    console.log(`   ✅ ${cdCierreCount} registros actualizados`);
    
    // 12. Schedule (horarios) - fecha_inicio
    console.log('12. Corrigiendo Schedule (fecha_inicio)...');
    const schedInicio = await prisma.schedule.findMany({ select: { id: true, fecha_inicio: true } });
    let schedInicioCount = 0;
    for (const mov of schedInicio) {
      const newDate = new Date(mov.fecha_inicio.getTime() + FIVE_HOURS_MS);
      await prisma.schedule.update({
        where: { id: mov.id },
        data: { fecha_inicio: newDate }
      });
      schedInicioCount++;
    }
    results['Schedule.fecha_inicio'] = { before: schedInicioCount, after: schedInicioCount };
    console.log(`   ✅ ${schedInicioCount} registros actualizados`);
    
    // 13. Schedule - fecha_salida
    console.log('13. Corrigiendo Schedule (fecha_salida)...');
    const schedSalida = await prisma.schedule.findMany({ 
      select: { id: true, fecha_salida: true } 
    });
    let schedSalidaCount = 0;
    for (const mov of schedSalida) {
      if (mov.fecha_salida) {
        const newDate = new Date(mov.fecha_salida.getTime() + FIVE_HOURS_MS);
        await prisma.schedule.update({
          where: { id: mov.id },
          data: { fecha_salida: newDate }
        });
        schedSalidaCount++;
      }
    }
    results['Schedule.fecha_salida'] = { before: schedSalidaCount, after: schedSalidaCount };
    console.log(`   ✅ ${schedSalidaCount} registros actualizados`);
    
    // 14. Schedule - fecha_almuerzo
    console.log('14. Corrigiendo Schedule (fecha_almuerzo)...');
    const schedAlmuerzo = await prisma.schedule.findMany({ 
      select: { id: true, fecha_almuerzo: true } 
    });
    let schedAlmuerzoCount = 0;
    for (const mov of schedAlmuerzo) {
      if (mov.fecha_almuerzo) {
        const newDate = new Date(mov.fecha_almuerzo.getTime() + FIVE_HOURS_MS);
        await prisma.schedule.update({
          where: { id: mov.id },
          data: { fecha_almuerzo: newDate }
        });
        schedAlmuerzoCount++;
      }
    }
    results['Schedule.fecha_almuerzo'] = { before: schedAlmuerzoCount, after: schedAlmuerzoCount };
    console.log(`   ✅ ${schedAlmuerzoCount} registros actualizados`);
    
    // 15. Schedule - fecha_regreso
    console.log('15. Corrigiendo Schedule (fecha_regreso)...');
    const schedRegreso = await prisma.schedule.findMany({ 
      select: { id: true, fecha_regreso: true } 
    });
    let schedRegresoCount = 0;
    for (const mov of schedRegreso) {
      if (mov.fecha_regreso) {
        const newDate = new Date(mov.fecha_regreso.getTime() + FIVE_HOURS_MS);
        await prisma.schedule.update({
          where: { id: mov.id },
          data: { fecha_regreso: newDate }
        });
        schedRegresoCount++;
      }
    }
    results['Schedule.fecha_regreso'] = { before: schedRegresoCount, after: schedRegresoCount };
    console.log(`   ✅ ${schedRegresoCount} registros actualizados`);
    
    // 16. SaldoInicial - fecha_asignacion
    console.log('16. Corrigiendo SaldoInicial (fecha_asignacion)...');
    const saldoInicial = await prisma.saldoInicial.findMany({ select: { id: true, fecha_asignacion: true } });
    let saldoInicialCount = 0;
    for (const mov of saldoInicial) {
      const newDate = new Date(mov.fecha_asignacion.getTime() + FIVE_HOURS_MS);
      await prisma.saldoInicial.update({
        where: { id: mov.id },
        data: { fecha_asignacion: newDate }
      });
      saldoInicialCount++;
    }
    results['SaldoInicial.fecha_asignacion'] = { before: saldoInicialCount, after: saldoInicialCount };
    console.log(`   ✅ ${saldoInicialCount} registros actualizados`);
    
    // Resumen
    console.log('\n=== RESUMEN DE CORRECCIÓN ===');
    let total = 0;
    for (const [tabla, count] of Object.entries(results)) {
      console.log(`${tabla.padEnd(35)}: ${count.after} registros`);
      total += count.after;
    }
    console.log(`\nTOTAL: ${total} registros actualizados`);
    console.log('\n✅ Todas las fechas han sido corregidas (+5 horas)');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Este script corregirá TODAS las fechas en la base de datos');
console.log('sumando 5 horas para convertir de Ecuador (UTC-5) a UTC correctamente.\n');
console.log('Para ejecutar: CONFIRM=1 npx tsx scripts/fix-timezone-data.ts\n');

const confirm = process.env.CONFIRM === '1';
if (!confirm) {
  console.log('❌ Ejecución cancelada. Usa CONFIRM=1 para confirmar.');
  process.exit(0);
}

fixTimezoneData().catch(console.error);
