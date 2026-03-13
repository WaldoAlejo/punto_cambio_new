import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generarInformeSemanal() {
  const puntoId = '41df3df8-d476-4254-b459-4bffbffe2ade';
  const dias = [
    { fecha: '2026-03-09', nombre: 'LUNES 09 DE MARZO' },
    { fecha: '2026-03-10', nombre: 'MARTES 10 DE MARZO' },
    { fecha: '2026-03-11', nombre: 'MIÉRCOLES 11 DE MARZO' },
    { fecha: '2026-03-12', nombre: 'JUEVES 12 DE MARZO' },
    { fecha: '2026-03-13', nombre: 'VIERNES 13 DE MARZO' }
  ];

  console.log('╔' + '═'.repeat(118) + '╗');
  console.log('║' + ' '.repeat(30) + 'INFORME SEMANAL - PLAZA DEL VALLE' + ' '.repeat(55) + '║');
  console.log('║' + ' '.repeat(35) + 'DEL 09 AL 13 DE MARZO 2026' + ' '.repeat(60) + '║');
  console.log('╚' + '═'.repeat(118) + '╝');
  console.log();

  const resumenSemanal = {
    totalCambios: 0,
    totalTransferenciasSalida: 0,
    totalTransferenciasEntrada: 0,
    totalMovimientos: 0,
    totalServicios: 0
  };

  for (const dia of dias) {
    const inicioDia = new Date(`${dia.fecha}T05:00:00.000Z`);
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);
    finDia.setMilliseconds(-1);

    console.log('┌' + '─'.repeat(118) + '┐');
    console.log('│ ' + dia.nombre.padEnd(116) + '│');
    console.log('│ Horario: 00:00 - 23:59 (Ecuador)'.padEnd(117) + '│');
    console.log('└' + '─'.repeat(118) + '┘');
    console.log();

    // === SALDOS ===
    console.log('▓'.repeat(60));
    console.log('▓' + ' '.repeat(20) + 'SALDOS POR MONEDA' + ' '.repeat(22) + '▓');
    console.log('▓'.repeat(60));
    console.log();

    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' }
    });

    for (const moneda of monedas) {
      const movimientosPrevios = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoId,
          moneda_id: moneda.id,
          fecha: { lt: inicioDia }
        }
      });
      const saldoInicial = movimientosPrevios.reduce((sum, m) => sum + Number(m.monto), 0);

      const movimientosHastaFin = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoId,
          moneda_id: moneda.id,
          fecha: { lte: finDia }
        }
      });
      const saldoFinal = movimientosHastaFin.reduce((sum, m) => sum + Number(m.monto), 0);

      const movimientosDelDia = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: puntoId,
          moneda_id: moneda.id,
          fecha: { gte: inicioDia, lte: finDia }
        }
      });

      const ingresosDia = movimientosDelDia
        .filter(m => Number(m.monto) > 0)
        .reduce((sum, m) => sum + Number(m.monto), 0);
      const egresosDia = movimientosDelDia
        .filter(m => Number(m.monto) < 0)
        .reduce((sum, m) => sum + Number(m.monto), 0);

      if (saldoInicial !== 0 || saldoFinal !== 0 || movimientosDelDia.length > 0) {
        console.log(`${moneda.codigo.padEnd(5)} │ Inicial: ${saldoInicial.toFixed(2).padStart(12)} │ Ingresos: ${('+' + ingresosDia.toFixed(2)).padStart(12)} │ Egresos: ${egresosDia.toFixed(2).padStart(12)} │ Final: ${saldoFinal.toFixed(2).padStart(12)}`);
      }
    }
    console.log();

    // === CAMBIOS DE DIVISA ===
    console.log('▓'.repeat(60));
    console.log('▓' + ' '.repeat(18) + 'CAMBIOS DE DIVISA' + ' '.repeat(24) + '▓');
    console.log('▓'.repeat(60));
    console.log();

    const cambios = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha: { gte: inicioDia, lte: finDia }
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        usuario: true
      },
      orderBy: { fecha: 'asc' }
    });

    if (cambios.length === 0) {
      console.log('   (Sin cambios de divisa este día)');
    } else {
      cambios.forEach((c, idx) => {
        const horaEC = new Date(c.fecha);
        horaEC.setHours(horaEC.getHours() - 5);
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${horaEC.toISOString().slice(11, 16)} │ ${c.numero_recibo} │ ${c.monto_origen} ${c.monedaOrigen?.codigo} → ${c.monto_destino} ${c.monedaDestino?.codigo} │ ${c.usuario?.username || 'N/A'}`);
      });
    }
    console.log(`   TOTAL: ${cambios.length} cambios`);
    console.log();
    resumenSemanal.totalCambios += cambios.length;

    // === TRANSFERENCIAS ===
    console.log('▓'.repeat(60));
    console.log('▓' + ' '.repeat(19) + 'TRANSFERENCIAS' + ' '.repeat(25) + '▓');
    console.log('▓'.repeat(60));
    console.log();

    const transferenciasSalida = await prisma.transferencia.findMany({
      where: {
        origen_id: puntoId,
        fecha: { gte: inicioDia, lte: finDia }
      },
      include: { moneda: true, destino: true }
    });

    const transferenciasEntrada = await prisma.transferencia.findMany({
      where: {
        destino_id: puntoId,
        fecha_aceptacion: { gte: inicioDia, lte: finDia }
      },
      include: { moneda: true, origen: true }
    });

    if (transferenciasSalida.length === 0 && transferenciasEntrada.length === 0) {
      console.log('   (Sin transferencias este día)');
    } else {
      transferenciasSalida.forEach((t, idx) => {
        const horaEC = new Date(t.fecha);
        horaEC.setHours(horaEC.getHours() - 5);
        console.log(`   📤 ${horaEC.toISOString().slice(11, 16)} │ SALIDA │ ${t.monto} ${t.moneda?.codigo} → ${t.destino?.nombre}`);
      });
      transferenciasEntrada.forEach((t, idx) => {
        const horaEC = new Date(t.fecha_aceptacion!);
        horaEC.setHours(horaEC.getHours() - 5);
        console.log(`   📥 ${horaEC.toISOString().slice(11, 16)} │ ENTRADA │ ${t.monto} ${t.moneda?.codigo} ← ${t.origen?.nombre || 'N/A'}`);
      });
    }
    console.log(`   TOTAL SALIDA: ${transferenciasSalida.length} │ TOTAL ENTRADA: ${transferenciasEntrada.length}`);
    console.log();
    resumenSemanal.totalTransferenciasSalida += transferenciasSalida.length;
    resumenSemanal.totalTransferenciasEntrada += transferenciasEntrada.length;

    // === MOVIMIENTOS MANUALES ===
    console.log('▓'.repeat(60));
    console.log('▓' + ' '.repeat(16) + 'MOVIMIENTOS MANUALES' + ' '.repeat(22) + '▓');
    console.log('▓'.repeat(60));
    console.log();

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha: { gte: inicioDia, lte: finDia }
      },
      include: { moneda: true },
      orderBy: { fecha: 'asc' }
    });

    if (movimientos.length === 0) {
      console.log('   (Sin movimientos manuales este día)');
    } else {
      movimientos.forEach((m, idx) => {
        const horaEC = new Date(m.fecha);
        horaEC.setHours(horaEC.getHours() - 5);
        const tipo = Number(m.monto) > 0 ? 'ING' : Number(m.monto) < 0 ? 'EGR' : 'AJU';
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${horaEC.toISOString().slice(11, 16)} │ ${tipo} │ ${m.monto.toString().padStart(10)} ${m.moneda?.codigo} │ ${(m.descripcion || 'Sin descripción').substring(0, 50)}`);
      });
    }
    console.log(`   TOTAL: ${movimientos.length} movimientos`);
    console.log();
    resumenSemanal.totalMovimientos += movimientos.length;

    // === SERVICIOS EXTERNOS ===
    console.log('▓'.repeat(60));
    console.log('▓' + ' '.repeat(18) + 'SERVICIOS EXTERNOS' + ' '.repeat(23) + '▓');
    console.log('▓'.repeat(60));
    console.log();

    const servicios = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: puntoId,
        fecha: { gte: inicioDia, lte: finDia }
      },
      include: { moneda: true },
      orderBy: { fecha: 'asc' }
    });

    if (servicios.length === 0) {
      console.log('   (Sin servicios externos este día)');
    } else {
      servicios.forEach((s, idx) => {
        const horaEC = new Date(s.fecha);
        horaEC.setHours(horaEC.getHours() - 5);
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${horaEC.toISOString().slice(11, 16)} │ ${s.servicio.padEnd(10)} │ ${s.tipo_movimiento.padEnd(7)} │ ${s.monto.toString().padStart(8)} ${s.moneda?.codigo} │ ${(s.descripcion || 'N/A').substring(0, 40)}`);
      });
    }
    console.log(`   TOTAL: ${servicios.length} servicios`);
    console.log();
    resumenSemanal.totalServicios += servicios.length;

    // === RESUMEN DEL DÍA ===
    const totalDia = cambios.length + transferenciasSalida.length + transferenciasEntrada.length + movimientos.length + servicios.length;
    console.log('─'.repeat(118));
    console.log(`RESUMEN ${dia.nombre}: Cambios=${cambios.length} │ Transf.Sal=${transferenciasSalida.length} │ Transf.Ent=${transferenciasEntrada.length} │ Movim=${movimientos.length} │ Serv=${servicios.length} │ TOTAL=${totalDia}`);
    console.log('─'.repeat(118));
    console.log();
    console.log();
  }

  // === RESUMEN SEMANAL ===
  console.log('╔' + '═'.repeat(118) + '╗');
  console.log('║' + ' '.repeat(45) + 'RESUMEN SEMANAL' + ' '.repeat(58) + '║');
  console.log('╠' + '═'.repeat(118) + '╣');
  console.log('║' + ` Total Cambios de Divisa:     ${resumenSemanal.totalCambios.toString().padStart(4)}`.padEnd(117) + '║');
  console.log('║' + ` Total Transferencias Salida: ${resumenSemanal.totalTransferenciasSalida.toString().padStart(4)}`.padEnd(117) + '║');
  console.log('║' + ` Total Transferencias Entrada:${resumenSemanal.totalTransferenciasEntrada.toString().padStart(4)}`.padEnd(117) + '║');
  console.log('║' + ` Total Movimientos Manuales:  ${resumenSemanal.totalMovimientos.toString().padStart(4)}`.padEnd(117) + '║');
  console.log('║' + ` Total Servicios Externos:    ${resumenSemanal.totalServicios.toString().padStart(4)}`.padEnd(117) + '║');
  console.log('╠' + '═'.repeat(118) + '╣');
  const totalSemana = resumenSemanal.totalCambios + resumenSemanal.totalTransferenciasSalida + resumenSemanal.totalTransferenciasEntrada + resumenSemanal.totalMovimientos + resumenSemanal.totalServicios;
  console.log('║' + ` TOTAL TRANSACCIONES DE LA SEMANA: ${totalSemana}`.padEnd(117) + '║');
  console.log('╚' + '═'.repeat(118) + '╝');

  await prisma.$disconnect();
}

generarInformeSemanal().catch(console.error);
