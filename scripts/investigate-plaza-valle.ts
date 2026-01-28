import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigatePlazaValle() {
  try {
    console.log('🔍 Investigando transacciones de PLAZA DEL VALLE...\n');

    // Buscar el punto
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

    console.log(`✅ Punto encontrado: ${punto.nombre} (ID: ${punto.id})\n`);

    // Obtener todos los servicios externos del punto
    const serviciosExternos = await prisma.servicioExterno.findMany({
      where: {
        punto_id: punto.id
      },
      include: {
        movimientos_saldo: {
          orderBy: {
            created_at: 'asc'
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`📋 Total de servicios externos encontrados: ${serviciosExternos.length}\n`);

    let totalSaldo = 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    serviciosExternos.forEach((servicio, index) => {
      const fechaServicio = new Date(servicio.created_at);
      const esHoy = fechaServicio >= hoy;
      
      console.log(`\n--- Servicio #${index + 1} ---`);
      console.log(`ID: ${servicio.id}`);
      console.log(`Tipo: ${servicio.tipo}`);
      console.log(`Compañía: ${servicio.compania}`);
      console.log(`Monto: ${servicio.monto}`);
      console.log(`Estado: ${servicio.estado}`);
      console.log(`Anulado: ${servicio.anulado ? 'SÍ' : 'NO'}`);
      console.log(`Fecha: ${servicio.created_at}`);
      console.log(`Es de hoy: ${esHoy ? 'SÍ' : 'NO'}`);
      
      if (servicio.movimientos_saldo.length > 0) {
        console.log(`\nMovimientos de saldo (${servicio.movimientos_saldo.length}):`);
        servicio.movimientos_saldo.forEach((mov, idx) => {
          console.log(`  ${idx + 1}. Tipo: ${mov.tipo}, Monto: ${mov.monto}, Anulación: ${mov.es_anulacion ? 'SÍ' : 'NO'}`);
          
          // Calcular el efecto en el saldo
          if (mov.tipo === 'INGRESO') {
            totalSaldo += mov.monto;
          } else if (mov.tipo === 'EGRESO') {
            totalSaldo -= mov.monto;
          }
        });
      } else {
        console.log('Sin movimientos de saldo');
      }
    });

    console.log(`\n\n📊 RESUMEN:`);
    console.log(`Total calculado de movimientos: ${totalSaldo.toFixed(2)}`);
    console.log(`Saldo esperado: 1996.24`);
    console.log(`Diferencia: ${(totalSaldo - 1996.24).toFixed(2)}`);

    // Obtener saldo actual del punto
    const saldos = await prisma.saldoPunto.findMany({
      where: {
        punto_id: punto.id
      }
    });

    console.log(`\n💰 Saldos actuales del punto:`);
    saldos.forEach(saldo => {
      console.log(`  ${saldo.tipo_moneda}: ${saldo.saldo_actual}`);
    });

    // Buscar específicamente servicios de Western Union
    const westernUnion = serviciosExternos.filter(s => 
      s.compania?.toLowerCase().includes('western')
    );

    if (westernUnion.length > 0) {
      console.log(`\n🏦 Servicios de Western Union: ${westernUnion.length}`);
      westernUnion.forEach((wu, idx) => {
        console.log(`\n  WU #${idx + 1}:`);
        console.log(`    ID: ${wu.id}`);
        console.log(`    Tipo: ${wu.tipo}`);
        console.log(`    Monto: ${wu.monto}`);
        console.log(`    Anulado: ${wu.anulado ? 'SÍ' : 'NO'}`);
        console.log(`    Movimientos:`);
        wu.movimientos_saldo.forEach(mov => {
          console.log(`      - ${mov.tipo}: ${mov.monto} (Anulación: ${mov.es_anulacion ? 'SÍ' : 'NO'})`);
        });
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigatePlazaValle();
