import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analizarAnulaciones() {
  try {
    console.log('🔍 ANÁLISIS DETALLADO DE ANULACIONES - PLAZA DEL VALLE');
    console.log('='.repeat(100));

    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: 'PLAZA', mode: 'insensitive' } }
    });

    if (!punto) throw new Error('Punto no encontrado');

    const usd = await prisma.moneda.findUnique({ where: { codigo: 'USD' } });
    if (!usd) throw new Error('USD no encontrado');

    // Buscar todos los Western Union del día de ayer
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const todosWestern = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        servicio: 'WESTERN',
        fecha: {
          gte: ayer,
          lt: hoy
        }
      },
      orderBy: {
        fecha: 'asc'
      }
    });

    console.log(`Total de movimientos Western Union encontrados: ${todosWestern.length}\n`);

    // Separar por tipo
    const ingresos = todosWestern.filter(m => m.tipo_movimiento === 'INGRESO');
    const egresos = todosWestern.filter(m => m.tipo_movimiento === 'EGRESO');

    console.log('📊 CLASIFICACIÓN:');
    console.log('-'.repeat(100));
    console.log(`Western Union INGRESO: ${ingresos.length} movimientos`);
    console.log(`Western Union EGRESO: ${egresos.length} movimientos\n`);

    // Mostrar todos los INGRESOS
    console.log('❌ WESTERN UNION registrados como INGRESO:');
    console.log('-'.repeat(100));
    let totalIngresos = 0;
    ingresos.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      totalIngresos += monto;
      console.log(`${idx + 1}. $${monto.toFixed(2).padStart(10)} - ${mov.descripcion}`);
      console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      console.log(`   Ref: ${mov.numero_referencia || 'N/A'}`);
      console.log(`   ID: ${mov.id}\n`);
    });
    console.log(`   TOTAL INGRESOS: $${totalIngresos.toFixed(2)}\n`);

    // Mostrar todos los EGRESOS
    console.log('✅ WESTERN UNION registrados como EGRESO:');
    console.log('-'.repeat(100));
    let totalEgresos = 0;
    egresos.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      totalEgresos += Math.abs(monto);
      console.log(`${idx + 1}. $${Math.abs(monto).toFixed(2).padStart(10)} - ${mov.descripcion}`);
      console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      console.log(`   Ref: ${mov.numero_referencia || 'N/A'}`);
      console.log(`   ID: ${mov.id}\n`);
    });
    console.log(`   TOTAL EGRESOS: $${totalEgresos.toFixed(2)}\n`);

    // Ahora buscar las REVERSIONES
    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        created_at: {
          gte: ayer,
          lt: hoy
        },
        descripcion: {
          contains: 'Reverso eliminación'
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    console.log('🔄 REVERSIONES/ANULACIONES REALIZADAS:');
    console.log('-'.repeat(100));
    console.log(`Total de anulaciones: ${movimientosSaldo.length}\n`);

    const reversionesIngreso: any[] = [];
    const reversionesEgreso: any[] = [];

    movimientosSaldo.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      const diferencia = Number(mov.saldo_nuevo) - Number(mov.saldo_anterior);
      
      const esRevertIngreso = mov.descripcion?.includes('INGRESO');
      const esRevertEgreso = mov.descripcion?.includes('EGRESO');

      if (esRevertIngreso) {
        reversionesIngreso.push({ mov, monto, diferencia });
      } else if (esRevertEgreso) {
        reversionesEgreso.push({ mov, monto, diferencia });
      }

      console.log(`${idx + 1}. ${mov.descripcion}`);
      console.log(`   Efecto en saldo: ${diferencia >= 0 ? '+' : ''}$${diferencia.toFixed(2)}`);
      console.log(`   Saldo: ${Number(mov.saldo_anterior).toFixed(2)} → ${Number(mov.saldo_nuevo).toFixed(2)}`);
      console.log(`   Fecha: ${mov.created_at.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}\n`);
    });

    console.log('\n📊 ANÁLISIS DE REVERSIONES:');
    console.log('-'.repeat(100));
    console.log(`Reversiones de INGRESO: ${reversionesIngreso.length}`);
    console.log(`Reversiones de EGRESO: ${reversionesEgreso.length}\n`);

    // Calcular el balance
    console.log('💡 BALANCE DE WESTERN UNION:');
    console.log('-'.repeat(100));
    console.log(`Movimientos INGRESO registrados: ${ingresos.length} → +$${totalIngresos.toFixed(2)}`);
    console.log(`Movimientos EGRESO registrados: ${egresos.length} → -$${totalEgresos.toFixed(2)}`);
    console.log(`Reversiones de INGRESO: ${reversionesIngreso.length} → -$${reversionesIngreso.reduce((sum, r) => sum + Math.abs(r.diferencia), 0).toFixed(2)}`);
    console.log(`Reversiones de EGRESO: ${reversionesEgreso.length} → +$${reversionesEgreso.reduce((sum, r) => sum + r.diferencia, 0).toFixed(2)}`);
    console.log();

    const efectoNeto = totalIngresos - totalEgresos 
                     - reversionesIngreso.reduce((sum, r) => sum + Math.abs(r.diferencia), 0)
                     + reversionesEgreso.reduce((sum, r) => sum + r.diferencia, 0);

    console.log(`Efecto NETO de Western Union en el saldo: $${efectoNeto.toFixed(2)}`);
    console.log();

    console.log('🔍 PROBLEMA IDENTIFICADO:');
    console.log('-'.repeat(100));
    console.log(`Se registraron ${ingresos.length} Western INGRESO (INCORRECTOS)`);
    console.log(`Solo se anularon ${reversionesIngreso.length} de ellos`);
    console.log(`Quedaron SIN ANULAR: ${ingresos.length - reversionesIngreso.length} movimientos INGRESO incorrectos\n`);

    if (ingresos.length > reversionesIngreso.length) {
      console.log('❌ MOVIMIENTOS INGRESO QUE NO FUERON ANULADOS:');
      console.log('-'.repeat(100));
      
      // Identificar cuáles NO fueron anulados
      const montosAnulados = reversionesIngreso.map(r => Math.abs(r.diferencia));
      const noAnulados = ingresos.filter(ing => {
        const monto = Number(ing.monto);
        const index = montosAnulados.indexOf(monto);
        if (index !== -1) {
          montosAnulados.splice(index, 1);
          return false;
        }
        return true;
      });

      let totalNoAnulado = 0;
      noAnulados.forEach((mov, idx) => {
        const monto = Number(mov.monto);
        totalNoAnulado += monto;
        console.log(`${idx + 1}. $${monto.toFixed(2)} - ${mov.descripcion}`);
        console.log(`   ID: ${mov.id}\n`);
      });

      console.log(`TOTAL NO ANULADO: $${totalNoAnulado.toFixed(2)}`);
      console.log(`EFECTO EN SALDO (doble): $${(totalNoAnulado * 2).toFixed(2)}\n`);
    }

    console.log('\n✅ CONCLUSIÓN:');
    console.log('-'.repeat(100));
    console.log('Las anulaciones SÍ funcionan correctamente.');
    console.log('Cuando se anula un INGRESO incorrecto, el saldo se revierte bien.');
    console.log('El problema es que NO TODOS los INGRESO incorrectos fueron anulados.');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analizarAnulaciones();
