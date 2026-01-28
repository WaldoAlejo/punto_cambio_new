import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function detailedAudit() {
  try {
    console.log('🔍 AUDITORÍA DETALLADA - PLAZA DEL VALLE');
    console.log('='.repeat(80));

    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: 'PLAZA',
          mode: 'insensitive'
        }
      }
    });

    if (!punto) {
      console.error('❌ No se encontró el punto');
      return;
    }

    console.log(`Punto: ${punto.nombre} (ID: ${punto.id})\n`);

    const usd = await prisma.moneda.findUnique({
      where: { codigo: 'USD' }
    });

    if (!usd) {
      console.error('❌ No se encontró USD');
      return;
    }

    // Ver todos los servicios externos de los últimos 7 días
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);

    const servicios = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: hace7dias
        }
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            username: true
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    console.log(`📋 SERVICIOS EXTERNOS (últimos 7 días): ${servicios.length} movimientos`);
    console.log('-'.repeat(80));

    if (servicios.length === 0) {
      console.log('No hay movimientos de servicios externos en los últimos 7 días.\n');
    } else {
      servicios.forEach((mov, idx) => {
        const monto = Number(mov.monto);
        console.log(`\n${idx + 1}. [${mov.servicio}] ${mov.tipo_movimiento} - $${monto.toFixed(2)}`);
        console.log(`   ID: ${mov.id}`);
        console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
        console.log(`   Usuario: ${mov.usuario?.nombre || 'N/A'}`);
        if (mov.descripcion) {
          console.log(`   Descripción: ${mov.descripcion}`);
        }
        if (mov.numero_referencia) {
          console.log(`   Ref: ${mov.numero_referencia}`);
        }
      });
    }

    // Ver todos los movimientos de saldo de los últimos 7 días
    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        created_at: {
          gte: hace7dias
        }
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            username: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`\n\n📝 MOVIMIENTOS DE SALDO (últimos 7 días): ${movimientosSaldo.length} movimientos`);
    console.log('-'.repeat(80));

    if (movimientosSaldo.length === 0) {
      console.log('No hay movimientos de saldo en los últimos 7 días.\n');
    } else {
      movimientosSaldo.forEach((mov, idx) => {
        const monto = Number(mov.monto);
        const saldoAnterior = Number(mov.saldo_anterior);
        const saldoNuevo = Number(mov.saldo_nuevo);
        const diferencia = saldoNuevo - saldoAnterior;

        console.log(`\n${idx + 1}. ${mov.tipo} - $${monto.toFixed(2)}`);
        console.log(`   Saldo: ${saldoAnterior.toFixed(2)} → ${saldoNuevo.toFixed(2)} (${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)})`);
        console.log(`   ${mov.descripcion || 'Sin descripción'}`);
        console.log(`   Tipo: ${mov.tipo_referencia}${mov.es_anulacion ? ' (ANULACIÓN)' : ''}`);
        console.log(`   Usuario: ${mov.usuario?.nombre || 'N/A'}`);
        console.log(`   Fecha: ${mov.created_at.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      });
    }

    // Saldo actual
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    console.log('\n\n💰 SALDO ACTUAL');
    console.log('-'.repeat(80));
    if (saldoActual) {
      console.log(`Total: $${Number(saldoActual.cantidad).toFixed(2)}`);
      console.log(`Billetes: $${Number(saldoActual.billetes || 0).toFixed(2)}`);
      console.log(`Monedas: $${Number(saldoActual.monedas_fisicas || 0).toFixed(2)}`);
      console.log(`Bancos: $${Number(saldoActual.bancos || 0).toFixed(2)}`);
      console.log(`Última actualización: ${saldoActual.updated_at}`);
    }

    // Buscar servicios de Western Union específicamente
    const westernMovs = servicios.filter(s => s.servicio.toLowerCase().includes('western'));
    
    if (westernMovs.length > 0) {
      console.log('\n\n🏦 WESTERN UNION (últimos 7 días)');
      console.log('-'.repeat(80));
      westernMovs.forEach((mov, idx) => {
        console.log(`\n${idx + 1}. ${mov.tipo_movimiento} - $${Number(mov.monto).toFixed(2)}`);
        console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
        console.log(`   ${mov.tipo_movimiento === 'INGRESO' ? '⚠️  POSIBLE ERROR' : '✅ CORRECTO'}`);
      });
    }

    console.log('\n\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

detailedAudit();
