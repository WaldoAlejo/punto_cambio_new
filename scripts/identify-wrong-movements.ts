import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SALDO_ESPERADO = 1996.24;

async function identificarMovimientosIncorrectos() {
  try {
    console.log('🔍 IDENTIFICACIÓN DE MOVIMIENTOS INCORRECTOS - PLAZA DEL VALLE');
    console.log('='.repeat(80));

    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: 'PLAZA', mode: 'insensitive' } }
    });

    if (!punto) throw new Error('Punto no encontrado');

    const usd = await prisma.moneda.findUnique({ where: { codigo: 'USD' } });
    if (!usd) throw new Error('USD no encontrado');

    console.log(`Punto: ${punto.nombre}`);
    console.log(`Saldo esperado: $${SALDO_ESPERADO}\n`);

    // Obtener saldo actual
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    const saldoActualNum = Number(saldoActual?.cantidad || 0);
    console.log(`Saldo actual: $${saldoActualNum.toFixed(2)}`);
    console.log(`Diferencia: $${(saldoActualNum - SALDO_ESPERADO).toFixed(2)}\n`);

    // Buscar movimientos Western Union registrados como INGRESO de ayer
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const westernIngresos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        servicio: 'WESTERN',
        tipo_movimiento: 'INGRESO',
        fecha: {
          gte: ayer,
          lt: hoy
        }
      },
      orderBy: {
        fecha: 'asc'
      }
    });

    console.log('❌ MOVIMIENTOS WESTERN UNION REGISTRADOS COMO INGRESO (INCORRECTOS):');
    console.log('-'.repeat(80));
    console.log(`Total encontrados: ${westernIngresos.length}\n`);

    let totalIncorrecto = 0;
    westernIngresos.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      totalIncorrecto += monto;
      
      console.log(`${idx + 1}. ID: ${mov.id}`);
      console.log(`   Monto: $${monto.toFixed(2)}`);
      console.log(`   Descripción: ${mov.descripcion || 'Sin descripción'}`);
      console.log(`   Referencia: ${mov.numero_referencia || 'N/A'}`);
      console.log(`   Fecha: ${mov.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      console.log(`   Billetes: $${Number(mov.billetes || 0).toFixed(2)}`);
      console.log(`   Monedas: $${Number(mov.monedas_fisicas || 0).toFixed(2)}`);
      console.log(`   Método: ${mov.metodo_ingreso || 'N/A'}`);
      console.log();
    });

    console.log(`Total mal registrado: $${totalIncorrecto.toFixed(2)}\n`);

    // Analizar el impacto
    console.log('📊 ANÁLISIS DE IMPACTO:');
    console.log('-'.repeat(80));
    console.log(`Cada INGRESO incorrecto tiene doble efecto:`);
    console.log(`  1. Suma al saldo (cuando debería restar)`);
    console.log(`  2. No resta del saldo (cuando debería restar)`);
    console.log(`  Efecto total por movimiento: Monto × 2\n`);

    let efectoTotal = 0;
    westernIngresos.forEach((mov, idx) => {
      const monto = Number(mov.monto);
      const efecto = monto * 2;
      efectoTotal += efecto;
      console.log(`  ${idx + 1}. $${monto.toFixed(2)} × 2 = $${efecto.toFixed(2)}`);
    });

    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  Efecto total teórico: $${efectoTotal.toFixed(2)}\n`);

    console.log('⚠️  NOTA: El efecto real puede ser menor si algunos movimientos');
    console.log('   ya fueron parcialmente compensados por otras transacciones.\n');

    // Verificar si podemos eliminar (solo del día actual según la regla)
    const hayMovimientosHoy = westernIngresos.some(m => {
      const fechaMov = new Date(m.fecha);
      return fechaMov >= hoy;
    });

    console.log('\n🔧 OPCIONES DE CORRECCIÓN:');
    console.log('-'.repeat(80));

    if (hayMovimientosHoy) {
      console.log('✅ OPCIÓN 1 (RECOMENDADA): Eliminar y re-registrar');
      console.log('   Los movimientos son del día de hoy y pueden eliminarse.');
      console.log('   Pasos:');
      console.log('   1. Eliminar los movimientos INGRESO incorrectos');
      console.log('   2. Registrar nuevamente como EGRESO');
      console.log('   3. El saldo se cuadrará automáticamente\n');
    } else {
      console.log('❌ Los movimientos NO son del día de hoy.');
      console.log('   No pueden eliminarse (regla del sistema).\n');
    }

    console.log('✅ OPCIÓN 2: Ajuste manual');
    console.log('   Crear un movimiento de ajuste por: $' + (SALDO_ESPERADO - saldoActualNum).toFixed(2));
    console.log('   Esto corregirá el saldo pero no corregirá los movimientos originales.\n');

    // Generar SQL para consulta directa si es necesario
    console.log('\n📋 IDs DE MOVIMIENTOS PARA ELIMINAR:');
    console.log('-'.repeat(80));
    westernIngresos.forEach((mov, idx) => {
      console.log(`${idx + 1}. ${mov.id}`);
    });

    console.log('\n');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

identificarMovimientosIncorrectos();
