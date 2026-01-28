import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dashboardCompleto() {
  try {
    console.log('📊 DASHBOARD COMPLETO - PUNTO CAMBIO');
    console.log('='.repeat(100));
    console.log(`Fecha de reporte: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}\n`);

    // Obtener todos los puntos de atención
    const puntos = await prisma.puntoAtencion.findMany({
      where: {
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    });

    console.log(`Total de puntos de atención activos: ${puntos.length}\n`);
    console.log('='.repeat(100));

    // Fecha de hoy y ayer para análisis
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);

    for (const punto of puntos) {
      console.log(`\n${'█'.repeat(100)}`);
      console.log(`█ PUNTO: ${punto.nombre.toUpperCase()}`);
      console.log(`█ Ciudad: ${punto.ciudad || 'N/A'} | Provincia: ${punto.provincia || 'N/A'}`);
      console.log(`█ ID: ${punto.id}`);
      console.log(`${'█'.repeat(100)}\n`);

      // 1. CAMBIOS DE DIVISAS (EXCHANGES)
      console.log('💱 CAMBIOS DE DIVISAS');
      console.log('-'.repeat(100));

      const exchangesHoy = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: hoy
          }
        }
      });

      const exchangesAyer = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: ayer,
            lt: hoy
          }
        }
      });

      const totalExchanges = await prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: punto.id
        }
      });

      // Obtener totales por moneda (hoy)
      const exchangesPorMoneda = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: ayer
          }
        },
        include: {
          monedaOrigen: {
            select: { codigo: true, nombre: true }
          },
          monedaDestino: {
            select: { codigo: true, nombre: true }
          }
        }
      });

      const resumenMonedas: Record<string, { count: number; totalOrigen: number; totalDestino: number }> = {};
      
      exchangesPorMoneda.forEach(ex => {
        const key = `${ex.monedaOrigen.codigo} → ${ex.monedaDestino.codigo}`;
        if (!resumenMonedas[key]) {
          resumenMonedas[key] = { count: 0, totalOrigen: 0, totalDestino: 0 };
        }
        resumenMonedas[key].count++;
        resumenMonedas[key].totalOrigen += Number(ex.monto_origen);
        resumenMonedas[key].totalDestino += Number(ex.monto_destino);
      });

      console.log(`  Ayer (27/01): ${exchangesAyer} cambios`);
      console.log(`  Hoy (28/01):  ${exchangesHoy} cambios`);
      console.log(`  Total histórico: ${totalExchanges} cambios`);
      
      if (Object.keys(resumenMonedas).length > 0) {
        console.log(`\n  Detalle últimas 24 horas:`);
        Object.entries(resumenMonedas).forEach(([key, data]) => {
          console.log(`    ${key}: ${data.count} operaciones | $${data.totalOrigen.toFixed(2)} → $${data.totalDestino.toFixed(2)}`);
        });
      }
      console.log();

      // 2. SERVICIOS EXTERNOS
      console.log('🏦 SERVICIOS EXTERNOS');
      console.log('-'.repeat(100));

      const serviciosHoy = await prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: hoy
          }
        }
      });

      const serviciosAyer = await prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: ayer,
            lt: hoy
          }
        }
      });

      // Desglose por servicio y tipo (últimas 24 horas)
      const serviciosPorTipo = await prisma.servicioExternoMovimiento.findMany({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: ayer
          }
        }
      });

      const resumenServicios: Record<string, { ingreso: number; egreso: number; montoIngreso: number; montoEgreso: number }> = {};
      
      serviciosPorTipo.forEach(serv => {
        if (!resumenServicios[serv.servicio]) {
          resumenServicios[serv.servicio] = { ingreso: 0, egreso: 0, montoIngreso: 0, montoEgreso: 0 };
        }
        if (serv.tipo_movimiento === 'INGRESO') {
          resumenServicios[serv.servicio].ingreso++;
          resumenServicios[serv.servicio].montoIngreso += Number(serv.monto);
        } else {
          resumenServicios[serv.servicio].egreso++;
          resumenServicios[serv.servicio].montoEgreso += Math.abs(Number(serv.monto));
        }
      });

      console.log(`  Ayer (27/01): ${serviciosAyer} movimientos`);
      console.log(`  Hoy (28/01):  ${serviciosHoy} movimientos`);
      
      if (Object.keys(resumenServicios).length > 0) {
        console.log(`\n  Detalle últimas 24 horas:`);
        Object.entries(resumenServicios).forEach(([servicio, data]) => {
          const totalOps = data.ingreso + data.egreso;
          const balance = data.montoIngreso - data.montoEgreso;
          console.log(`    ${servicio}:`);
          console.log(`      ${totalOps} ops | Ingresos: ${data.ingreso} ($${data.montoIngreso.toFixed(2)}) | Egresos: ${data.egreso} ($${data.montoEgreso.toFixed(2)})`);
          console.log(`      Balance: $${balance.toFixed(2)}`);
        });
      }
      console.log();

      // 3. GUÍAS SERVIENTREGA
      console.log('📦 SERVIENTREGA');
      console.log('-'.repeat(100));

      const guiasHoy = await prisma.servientregaGuia.count({
        where: {
          punto_atencion_id: punto.id,
          created_at: {
            gte: hoy
          }
        }
      });

      const guiasAyer = await prisma.servientregaGuia.count({
        where: {
          punto_atencion_id: punto.id,
          created_at: {
            gte: ayer,
            lt: hoy
          }
        }
      });

      const totalGuias = await prisma.servientregaGuia.count({
        where: {
          punto_atencion_id: punto.id
        }
      });

      // Detalle de guías recientes
      const guiasRecientes = await prisma.servientregaGuia.findMany({
        where: {
          punto_atencion_id: punto.id,
          created_at: {
            gte: ayer
          }
        },
        include: {
          remitente: {
            select: { nombre: true }
          },
          destinatario: {
            select: { nombre: true }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 5
      });

      console.log(`  Ayer (27/01): ${guiasAyer} guías`);
      console.log(`  Hoy (28/01):  ${guiasHoy} guías`);
      console.log(`  Total histórico: ${totalGuias} guías`);

      if (guiasRecientes.length > 0) {
        console.log(`\n  Últimas guías generadas:`);
        guiasRecientes.forEach((guia, idx) => {
          const fecha = new Date(guia.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
          console.log(`    ${idx + 1}. Guía #${guia.numero_guia} | $${Number(guia.costo_envio || 0).toFixed(2)} | ${fecha}`);
          console.log(`       ${guia.remitente?.nombre || 'N/A'} → ${guia.destinatario?.nombre || 'N/A'}`);
        });
      }
      console.log();

      // 4. CIERRES DE CAJA
      console.log('💰 CIERRES DE CAJA');
      console.log('-'.repeat(100));

      const ultimoCierre = await prisma.cierreDiario.findFirst({
        where: {
          punto_atencion_id: punto.id
        },
        orderBy: {
          fecha_cierre: 'desc'
        },
        include: {
          usuario: {
            select: { nombre: true }
          }
        }
      });

      if (ultimoCierre) {
        const fechaCierre = ultimoCierre.fecha_cierre 
          ? new Date(ultimoCierre.fecha_cierre).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })
          : 'No cerrado aún';
        console.log(`  ✅ Último cierre: ${fechaCierre}`);
        console.log(`     Usuario: ${ultimoCierre.usuario?.nombre || 'N/A'}`);
        console.log(`     Estado: ${ultimoCierre.estado}`);
        console.log(`     Observaciones: ${ultimoCierre.observaciones || 'Sin observaciones'}`);
      } else {
        console.log(`  ⚠️  No se han registrado cierres de caja`);
      }
      
      // Verificar si hay caja abierta hoy
      const cajaAbiertaHoy = await prisma.cierreDiario.findFirst({
        where: {
          punto_atencion_id: punto.id,
          fecha: {
            gte: hoy
          },
          estado: 'ABIERTO'
        },
        include: {
          usuario: {
            select: { nombre: true }
          }
        }
      });

      if (cajaAbiertaHoy) {
        const fechaApertura = new Date(cajaAbiertaHoy.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
        console.log(`  🔓 Caja abierta desde: ${fechaApertura}`);
        console.log(`     Usuario: ${cajaAbiertaHoy.usuario?.nombre || 'N/A'}`);
      } else {
        console.log(`  🔒 No hay caja abierta hoy`);
      }
      console.log();

      // 5. SALDOS ACTUALES
      console.log('💵 SALDOS ACTUALES');
      console.log('-'.repeat(100));

      const saldos = await prisma.saldo.findMany({
        where: {
          punto_atencion_id: punto.id
        },
        include: {
          moneda: {
            select: { codigo: true, nombre: true }
          }
        }
      });

      if (saldos.length > 0) {
        saldos.forEach(saldo => {
          const total = Number(saldo.cantidad);
          const billetes = Number(saldo.billetes || 0);
          const monedas = Number(saldo.monedas_fisicas || 0);
          const bancos = Number(saldo.bancos || 0);
          
          console.log(`  ${saldo.moneda.codigo}: $${total.toFixed(2)}`);
          console.log(`    Billetes: $${billetes.toFixed(2)} | Monedas: $${monedas.toFixed(2)} | Bancos: $${bancos.toFixed(2)}`);
        });
      } else {
        console.log(`  Sin saldos registrados`);
      }

      console.log('\n');
    }

    console.log('='.repeat(100));
    console.log('FIN DEL REPORTE');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dashboardCompleto();
