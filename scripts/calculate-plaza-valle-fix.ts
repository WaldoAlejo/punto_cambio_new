import { PrismaClient } from '@prisma/client';
import { registrarMovimientoSaldo, TipoMovimiento, TipoReferencia } from '../server/services/movimientoSaldoService.js';

const prisma = new PrismaClient();

const SALDO_ESPERADO = 1996.24;

async function calcularCorreccion() {
  try {
    console.log('📊 CÁLCULO DE CORRECCIÓN - PLAZA DEL VALLE');
    console.log('='.repeat(80));

    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: 'PLAZA', mode: 'insensitive' } }
    });

    if (!punto) throw new Error('Punto no encontrado');

    const usd = await prisma.moneda.findUnique({ where: { codigo: 'USD' } });
    if (!usd) throw new Error('USD no encontrado');

    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    if (!saldoActual) throw new Error('Saldo no encontrado');

    const saldoActualNum = Number(saldoActual.cantidad);
    const diferencia = saldoActualNum - SALDO_ESPERADO;

    console.log(`Punto: ${punto.nombre}`);
    console.log(`\nSaldo actual: $${saldoActualNum.toFixed(2)}`);
    console.log(`Saldo esperado: $${SALDO_ESPERADO.toFixed(2)}`);
    console.log(`Diferencia: $${diferencia.toFixed(2)} ${diferencia > 0 ? '(SOBRANTE)' : '(FALTANTE)'}\n`);

    // Analizar los Western Union INGRESO incorrectos
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const westernIngresos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        servicio: 'WESTERN',
        tipo_movimiento: 'INGRESO',
        fecha: { gte: hoy }
      }
    });

    if (westernIngresos.length > 0) {
      console.log('⚠️  WESTERN UNION REGISTRADOS COMO INGRESO (INCORRECTOS):');
      console.log('-'.repeat(80));
      
      let totalIncorrecto = 0;
      westernIngresos.forEach((mov, idx) => {
        const monto = Number(mov.monto);
        totalIncorrecto += monto;
        console.log(`${idx + 1}. $${monto.toFixed(2)} - ${mov.descripcion || 'Sin descripción'}`);
        console.log(`   ID: ${mov.id}`);
        console.log(`   Ref: ${mov.numero_referencia || 'N/A'}`);
      });

      console.log(`\nTotal registrado incorrectamente como INGRESO: $${totalIncorrecto.toFixed(2)}`);
      console.log(`\n💡 EXPLICACIÓN:`);
      console.log(`- Estos $${totalIncorrecto.toFixed(2)} se SUMARON al saldo (incorrecto)`);
      console.log(`- Deberían haberse RESTADO del saldo (correcto)`);
      console.log(`- Efecto neto en el saldo: +$${(totalIncorrecto * 2).toFixed(2)}`);
      console.log(`  (${totalIncorrecto.toFixed(2)} que se sumaron + ${totalIncorrecto.toFixed(2)} que no se restaron)\n`);
    }

    console.log('\n🔧 CORRECCIÓN NECESARIA:');
    console.log('-'.repeat(80));
    
    if (Math.abs(diferencia) < 0.01) {
      console.log('✅ El saldo ya está correcto. No se requiere ajuste.');
    } else {
      const ajuste = SALDO_ESPERADO - saldoActualNum;
      console.log(`Ajuste necesario: $${ajuste.toFixed(2)}`);
      console.log(`Tipo: ${ajuste > 0 ? 'INGRESO (suma)' : 'EGRESO (resta)'}`);
      console.log(`Monto absoluto: $${Math.abs(ajuste).toFixed(2)}`);
      console.log(`\nResultado: ${saldoActualNum.toFixed(2)} ${ajuste > 0 ? '+' : ''}${ajuste.toFixed(2)} = ${SALDO_ESPERADO.toFixed(2)}`);
    }

    console.log('\n\n📋 RECOMENDACIONES:');
    console.log('-'.repeat(80));
    console.log('1. Eliminar los movimientos Western Union INGRESO incorrectos');
    console.log('2. Registrar nuevos movimientos Western Union como EGRESO');
    console.log('3. Alternativamente, crear un ajuste manual de saldo');
    console.log('\nPara aplicar ajuste automático, ejecuta:');
    console.log('  npx tsx scripts/fix-plaza-valle-saldo.ts --confirm\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

calcularCorreccion();
