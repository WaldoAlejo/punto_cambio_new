import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SALDO_ESPERADO = 1996.24;

async function auditarPlazaValle() {
  try {
    console.log('🔍 AUDITORÍA DE PLAZA DEL VALLE');
    console.log('='.repeat(80));
    console.log(`Saldo esperado al cierre: $${SALDO_ESPERADO}\n`);

    // 1. Encontrar el punto
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: 'PLAZA',
          mode: 'insensitive'
        }
      }
    });

    if (!punto) {
      console.error('❌ No se encontró el punto PLAZA DEL VALLE');
      return;
    }

    console.log(`✅ Punto: ${punto.nombre} (ID: ${punto.id})\n`);

    // 2. Obtener moneda USD
    const usd = await prisma.moneda.findUnique({
      where: { codigo: 'USD' }
    });

    if (!usd) {
      console.error('❌ No se encontró la moneda USD');
      return;
    }

    // 3. Obtener el saldo actual USD del punto
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    const saldoActualCantidad = saldoActual ? Number(saldoActual.cantidad) : 0;
    const diferencia = saldoActualCantidad - SALDO_ESPERADO;

    console.log('💰 SALDO ACTUAL DEL PUNTO');
    console.log('-'.repeat(80));
    console.log(`Saldo USD actual: $${saldoActualCantidad.toFixed(2)}`);
    console.log(`Saldo esperado:   $${SALDO_ESPERADO.toFixed(2)}`);
    console.log(`Diferencia:       $${diferencia.toFixed(2)} ${diferencia > 0 ? '(SOBRANTE)' : diferencia < 0 ? '(FALTANTE)' : '(CUADRADO)'}`);
    
    if (saldoActual) {
      console.log(`\nDesglose:`);
      console.log(`  Billetes: $${Number(saldoActual.billetes || 0).toFixed(2)}`);
      console.log(`  Monedas:  $${Number(saldoActual.monedas_fisicas || 0).toFixed(2)}`);
      console.log(`  Bancos:   $${Number(saldoActual.bancos || 0).toFixed(2)}`);
    }
    console.log();

    // 4. Obtener fecha de hoy (zona horaria Guayaquil)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // 5. Listar todos los servicios externos del día de hoy
    const serviciosHoy = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: hoy
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
        fecha: 'asc'
      }
    });

    console.log(`📋 SERVICIOS EXTERNOS DEL DÍA (${serviciosHoy.length} movimientos)`);
    console.log('-'.repeat(80));

    let totalIngresos = 0;
    let totalEgresos = 0;
    const porServicio: Record<string, { ingresos: number; egresos: number; movimientos: any[] }> = {};

    serviciosHoy.forEach((mov, index) => {
      const monto = Number(mov.monto);
      const esIngreso = mov.tipo_movimiento === 'INGRESO';
      
      if (esIngreso) {
        totalIngresos += monto;
      } else {
        totalEgresos += monto;
      }

      if (!porServicio[mov.servicio]) {
        porServicio[mov.servicio] = { ingresos: 0, egresos: 0, movimientos: [] };
      }
      
      if (esIngreso) {
        porServicio[mov.servicio].ingresos += monto;
      } else {
        porServicio[mov.servicio].egresos += monto;
      }
      
      porServicio[mov.servicio].movimientos.push(mov);

      console.log(`\n${index + 1}. [${mov.servicio}] ${mov.tipo_movimiento}`);
      console.log(`   ID: ${mov.id}`);
      console.log(`   Monto: $${monto.toFixed(2)}`);
      console.log(`   Método: ${mov.metodo_ingreso || 'N/A'}`);
      console.log(`   Usuario: ${mov.usuario?.nombre || 'N/A'}`);
      console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      if (mov.descripcion) {
        console.log(`   Descripción: ${mov.descripcion}`);
      }
      if (mov.numero_referencia) {
        console.log(`   Referencia: ${mov.numero_referencia}`);
      }
      if (mov.billetes && Number(mov.billetes) !== 0) {
        console.log(`   Billetes: $${Number(mov.billetes).toFixed(2)}`);
      }
      if (mov.monedas_fisicas && Number(mov.monedas_fisicas) !== 0) {
        console.log(`   Monedas: $${Number(mov.monedas_fisicas).toFixed(2)}`);
      }
      if (mov.bancos && Number(mov.bancos) !== 0) {
        console.log(`   Bancos: $${Number(mov.bancos).toFixed(2)}`);
      }
    });

    console.log('\n\n📊 RESUMEN POR SERVICIO');
    console.log('-'.repeat(80));
    
    Object.entries(porServicio).forEach(([servicio, data]) => {
      console.log(`\n${servicio}:`);
      console.log(`  Ingresos:   $${data.ingresos.toFixed(2)} (${data.movimientos.filter(m => m.tipo_movimiento === 'INGRESO').length} mov.)`);
      console.log(`  Egresos:    $${data.egresos.toFixed(2)} (${data.movimientos.filter(m => m.tipo_movimiento === 'EGRESO').length} mov.)`);
      console.log(`  Neto:       $${(data.ingresos - data.egresos).toFixed(2)}`);
    });

    console.log('\n\n💵 RESUMEN GENERAL DE SERVICIOS EXTERNOS');
    console.log('-'.repeat(80));
    console.log(`Total Ingresos:  $${totalIngresos.toFixed(2)}`);
    console.log(`Total Egresos:   $${totalEgresos.toFixed(2)}`);
    console.log(`Impacto Neto:    $${(totalIngresos - totalEgresos).toFixed(2)}`);

    // 6. Buscar específicamente movimientos de Western Union
    const westernMovimientos = serviciosHoy.filter(m => 
      m.servicio.toLowerCase().includes('western')
    );

    if (westernMovimientos.length > 0) {
      console.log('\n\n🏦 DETALLE DE WESTERN UNION');
      console.log('-'.repeat(80));
      
      westernMovimientos.forEach((mov, idx) => {
        console.log(`\nWestern Union #${idx + 1}:`);
        console.log(`  ID: ${mov.id}`);
        console.log(`  Tipo: ${mov.tipo_movimiento} ${mov.tipo_movimiento === 'INGRESO' ? '❌ (POSIBLE ERROR)' : '✅'}`);
        console.log(`  Monto: $${Number(mov.monto).toFixed(2)}`);
        console.log(`  Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
        console.log(`  Usuario: ${mov.usuario?.nombre || 'N/A'}`);
        
        if (mov.tipo_movimiento === 'INGRESO') {
          console.log(`  ⚠️  ADVERTENCIA: Western Union normalmente debería ser EGRESO`);
          console.log(`     (el operador paga el servicio, sale dinero del punto)`);
        }
      });
    }

    // 7. Obtener todos los movimientos de saldo (auditoría)
    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        created_at: {
          gte: hoy
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
        created_at: 'asc'
      }
    });

    console.log('\n\n📝 MOVIMIENTOS DE SALDO (Auditoría Completa)');
    console.log('-'.repeat(80));
    console.log(`Total de movimientos: ${movimientosSaldo.length}\n`);

    movimientosSaldo.forEach((mov, index) => {
      const monto = Number(mov.monto);
      const saldoAnterior = Number(mov.saldo_anterior);
      const saldoNuevo = Number(mov.saldo_nuevo);
      const diferenciaSaldo = saldoNuevo - saldoAnterior;

      console.log(`${index + 1}. ${mov.tipo} - $${monto.toFixed(2)}`);
      console.log(`   ${saldoAnterior.toFixed(2)} → ${saldoNuevo.toFixed(2)} (${diferenciaSaldo >= 0 ? '+' : ''}${diferenciaSaldo.toFixed(2)})`);
      console.log(`   ${mov.descripcion || 'Sin descripción'}`);
      console.log(`   ${mov.tipo_referencia} ${mov.es_anulacion ? '(ANULACIÓN)' : ''}`);
      console.log(`   ${mov.created_at.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      console.log();
    });

    // 8. Detectar anomalías
    console.log('\n🔍 ANÁLISIS DE ANOMALÍAS');
    console.log('-'.repeat(80));

    const anomalias: string[] = [];

    // Anomalía 1: Western Union como INGRESO
    const westernIngresos = westernMovimientos.filter(m => m.tipo_movimiento === 'INGRESO');
    if (westernIngresos.length > 0) {
      anomalias.push(`❌ ${westernIngresos.length} movimiento(s) de Western Union registrados como INGRESO (deberían ser EGRESO)`);
      westernIngresos.forEach(m => {
        anomalias.push(`   - ID: ${m.id}, Monto: $${Number(m.monto).toFixed(2)}, Fecha: ${m.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      });
    }

    // Anomalía 2: Diferencia en el saldo
    if (Math.abs(diferencia) > 0.01) {
      anomalias.push(`❌ El saldo actual ($${saldoActualCantidad.toFixed(2)}) no coincide con el esperado ($${SALDO_ESPERADO.toFixed(2)})`);
      anomalias.push(`   Diferencia: $${diferencia.toFixed(2)}`);
    }

    // Anomalía 3: Movimientos con saldo_nuevo != saldo_anterior ± monto
    movimientosSaldo.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      const saldoAnterior = Number(mov.saldo_anterior);
      const saldoNuevo = Number(mov.saldo_nuevo);
      const esperado = mov.tipo === 'INGRESO' ? saldoAnterior + monto :
                      mov.tipo === 'EGRESO' ? saldoAnterior - monto :
                      saldoAnterior + monto; // AJUSTE

      if (Math.abs(saldoNuevo - esperado) > 0.01) {
        anomalias.push(`❌ Movimiento #${idx + 1} (${mov.id}): Cálculo de saldo incorrecto`);
        anomalias.push(`   Esperado: ${esperado.toFixed(2)}, Registrado: ${saldoNuevo.toFixed(2)}`);
      }
    });

    if (anomalias.length === 0) {
      console.log('✅ No se detectaron anomalías');
    } else {
      console.log(`Se detectaron ${anomalias.length} anomalía(s):\n`);
      anomalias.forEach(a => console.log(a));
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('FIN DE LA AUDITORÍA');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error durante la auditoría:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditarPlazaValle();
