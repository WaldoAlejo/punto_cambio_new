import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analizarDia(fechaStr: string) {
  const puntoId = '41df3df8-d476-4254-b459-4bffbffe2ade'; // Plaza del Valle
  
  // Fechas del día analizado (America/Guayaquil)
  const inicioDia = new Date(`${fechaStr}T05:00:00.000Z`); // 00:00 EC
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);
  finDia.setMilliseconds(-1); // 23:59:59.999
  
  // Fecha para calcular saldo inicial (todo antes del inicio del día)
  const inicioDiaParaCalculo = new Date(inicioDia);
  
  console.log('='.repeat(90));
  console.log(`📅 ANÁLISIS DEL DÍA: ${fechaStr} - PLAZA DEL VALLE`);
  console.log('='.repeat(90));
  console.log(`Periodo: ${inicioDia.toISOString()} hasta ${finDia.toISOString()}`);
  console.log(`Horario Ecuador (EC): 00:00 - 23:59:59`);
  console.log();

  // Obtener todas las monedas
  const monedas = await prisma.moneda.findMany({
    where: { activo: true },
    orderBy: { codigo: 'asc' }
  });

  console.log('━'.repeat(90));
  console.log('💰 SALDOS POR MONEDA');
  console.log('━'.repeat(90));

  for (const moneda of monedas) {
    // Calcular saldo inicial (suma de todos los movimientos antes del inicio del día)
    const movimientosPrevios = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: moneda.id,
        fecha: { lt: inicioDiaParaCalculo }
      }
    });
    
    const saldoInicial = movimientosPrevios.reduce((sum, m) => sum + Number(m.monto), 0);
    
    // Calcular saldo final (suma de todos los movimientos hasta el final del día)
    const movimientosHastaFin = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: moneda.id,
        fecha: { lte: finDia }
      }
    });
    
    const saldoFinal = movimientosHastaFin.reduce((sum, m) => sum + Number(m.monto), 0);
    
    // Calcular movimientos del día
    const movimientosDelDia = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: moneda.id,
        fecha: {
          gte: inicioDia,
          lte: finDia
        }
      }
    });
    
    const ingresosDia = movimientosDelDia
      .filter(m => Number(m.monto) > 0)
      .reduce((sum, m) => sum + Number(m.monto), 0);
    
    const egresosDia = movimientosDelDia
      .filter(m => Number(m.monto) < 0)
      .reduce((sum, m) => sum + Number(m.monto), 0);
    
    // Solo mostrar monedas con saldo o movimientos
    if (saldoInicial !== 0 || saldoFinal !== 0 || movimientosDelDia.length > 0) {
      console.log(`\n🏦 ${moneda.codigo} - ${moneda.nombre}`);
      console.log(`   Saldo Inicial (00:00): ${saldoInicial.toFixed(2)}`);
      console.log(`   ├─ Ingresos del día:  +${ingresosDia.toFixed(2)}`);
      console.log(`   ├─ Egresos del día:   ${egresosDia.toFixed(2)}`);
      console.log(`   └─ Saldo Final (23:59): ${saldoFinal.toFixed(2)}`);
      console.log(`   Variación neta: ${(saldoFinal - saldoInicial).toFixed(2)}`);
      
      if (movimientosDelDia.length > 0) {
        console.log(`   📊 Movimientos del día: ${movimientosDelDia.length}`);
      }
    }
  }

  // Detalle de transacciones del día
  console.log('\n' + '━'.repeat(90));
  console.log('💱 CAMBIOS DE DIVISA DEL DÍA');
  console.log('━'.repeat(90));
  
  const cambios = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: puntoId,
      fecha: {
        gte: inicioDia,
        lte: finDia
      }
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
      usuario: true
    },
    orderBy: { fecha: 'asc' }
  });

  if (cambios.length === 0) {
    console.log('   ❌ No hay cambios de divisa registrados este día.');
  } else {
    cambios.forEach((cambio, idx) => {
      const horaEC = new Date(cambio.fecha);
      horaEC.setHours(horaEC.getHours() - 5);
      const horaStr = horaEC.toISOString().slice(11, 16);
      
      console.log(`\n   ${idx + 1}. ${horaStr} - ${cambio.numero_recibo}`);
      console.log(`      ${cambio.monto_origen} ${cambio.monedaOrigen?.codigo} → ${cambio.monto_destino} ${cambio.monedaDestino?.codigo}`);
      console.log(`      Cliente: ${cambio.cliente_nombre || 'No registrado'}`);
      console.log(`      Operador: ${cambio.usuario?.username || 'N/A'}`);
    });
  }
  console.log(`   📊 Total cambios: ${cambios.length}`);

  // Transferencias del día
  console.log('\n' + '━'.repeat(90));
  console.log('🔄 TRANSFERENCIAS DEL DÍA');
  console.log('━'.repeat(90));
  
  const transferenciasSalida = await prisma.transferencia.findMany({
    where: {
      origen_id: puntoId,
      fecha: {
        gte: inicioDia,
        lte: finDia
      }
    },
    include: {
      moneda: true,
      destino: true
    }
  });
  
  const transferenciasEntrada = await prisma.transferencia.findMany({
    where: {
      destino_id: puntoId,
      fecha_aceptacion: {
        gte: inicioDia,
        lte: finDia
      }
    },
    include: {
      moneda: true,
      origen: true
    }
  });

  if (transferenciasSalida.length === 0 && transferenciasEntrada.length === 0) {
    console.log('   ❌ No hay transferencias registradas este día.');
  } else {
    transferenciasSalida.forEach((t, idx) => {
      const horaEC = new Date(t.fecha);
      horaEC.setHours(horaEC.getHours() - 5);
      console.log(`\n   📤 SALIDA ${idx + 1}. ${horaEC.toISOString().slice(11, 16)} - ${t.monto} ${t.moneda?.codigo} → ${t.destino?.nombre}`);
    });
    transferenciasEntrada.forEach((t, idx) => {
      const horaEC = new Date(t.fecha_aceptacion!);
      horaEC.setHours(horaEC.getHours() - 5);
      console.log(`\n   📥 ENTRADA ${idx + 1}. ${horaEC.toISOString().slice(11, 16)} - ${t.monto} ${t.moneda?.codigo} ← ${t.origen?.nombre || 'N/A'}`);
    });
  }
  console.log(`   📊 Total transferencias salida: ${transferenciasSalida.length}`);
  console.log(`   📊 Total transferencias entrada: ${transferenciasEntrada.length}`);

  // Movimientos manuales del día
  console.log('\n' + '━'.repeat(90));
  console.log('📝 MOVIMIENTOS MANUALES DEL DÍA');
  console.log('━'.repeat(90));
  
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoId,
      fecha: {
        gte: inicioDia,
        lte: finDia
      }
    },
    include: {
      moneda: true
    },
    orderBy: { fecha: 'asc' }
  });

  if (movimientos.length === 0) {
    console.log('   ❌ No hay movimientos manuales registrados este día.');
  } else {
    movimientos.forEach((m, idx) => {
      const horaEC = new Date(m.fecha);
      horaEC.setHours(horaEC.getHours() - 5);
      const tipo = Number(m.monto) > 0 ? 'INGRESO' : Number(m.monto) < 0 ? 'EGRESO' : 'AJUSTE';
      console.log(`\n   ${idx + 1}. ${horaEC.toISOString().slice(11, 16)} | ${tipo} | ${m.monto} ${m.moneda?.codigo}`);
      console.log(`      ${m.descripcion || 'Sin descripción'}`);
    });
  }
  console.log(`   📊 Total movimientos: ${movimientos.length}`);

  // Servicios externos del día
  console.log('\n' + '━'.repeat(90));
  console.log('🌐 SERVICIOS EXTERNOS DEL DÍA');
  console.log('━'.repeat(90));
  
  const servicios = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: puntoId,
      fecha: {
        gte: inicioDia,
        lte: finDia
      }
    },
    include: {
      moneda: true
    },
    orderBy: { fecha: 'asc' }
  });

  if (servicios.length === 0) {
    console.log('   ❌ No hay servicios externos registrados este día.');
  } else {
    servicios.forEach((s, idx) => {
      const horaEC = new Date(s.fecha);
      horaEC.setHours(horaEC.getHours() - 5);
      console.log(`\n   ${idx + 1}. ${horaEC.toISOString().slice(11, 16)} | ${s.servicio} | ${s.tipo_movimiento} | ${s.monto} ${s.moneda?.codigo}`);
      console.log(`      ${s.descripcion || 'Sin descripción'}`);
    });
  }
  console.log(`   📊 Total servicios: ${servicios.length}`);

  // RESUMEN FINAL
  console.log('\n' + '='.repeat(90));
  console.log('📋 RESUMEN GENERAL DEL DÍA');
  console.log('='.repeat(90));
  console.log(`💱 Cambios de divisa:    ${cambios.length}`);
  console.log(`🔄 Transferencias salida: ${transferenciasSalida.length}`);
  console.log(`🔄 Transferencias entrada: ${transferenciasEntrada.length}`);
  console.log(`📝 Movimientos manuales:  ${movimientos.length}`);
  console.log(`🌐 Servicios externos:    ${servicios.length}`);
  console.log(`─`.repeat(90));
  const totalTrans = cambios.length + transferenciasSalida.length + transferenciasEntrada.length + movimientos.length + servicios.length;
  console.log(`📈 TOTAL TRANSACCIONES: ${totalTrans}`);
  console.log('='.repeat(90));

  await prisma.$disconnect();
}

// Ejecutar para el 9 de marzo
const fecha = process.argv[2] || '2026-03-09';
analizarDia(fecha).catch(console.error);
