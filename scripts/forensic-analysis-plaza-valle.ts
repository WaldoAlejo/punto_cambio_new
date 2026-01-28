import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SALDO_ESPERADO = 1996.24;

interface MovimientoAnalisis {
  fecha: Date;
  tipo: string;
  descripcion: string;
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  diferencia: number;
  esperado: number;
  descuadre: number;
  fuente: string;
  id: string;
  usuario?: string;
  esAnulacion?: boolean;
}

async function analisisForense() {
  try {
    console.log('🔬 ANÁLISIS FORENSE - PLAZA DEL VALLE');
    console.log('='.repeat(100));

    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: 'PLAZA', mode: 'insensitive' } }
    });

    if (!punto) throw new Error('Punto no encontrado');

    const usd = await prisma.moneda.findUnique({ where: { codigo: 'USD' } });
    if (!usd) throw new Error('USD no encontrado');

    console.log(`Punto: ${punto.nombre} (ID: ${punto.id})`);
    console.log(`Saldo esperado al cierre: $${SALDO_ESPERADO}\n`);

    // Obtener todos los movimientos de saldo de los últimos 2 días
    const hace2dias = new Date();
    hace2dias.setDate(hace2dias.getDate() - 2);
    hace2dias.setHours(0, 0, 0, 0);

    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        created_at: {
          gte: hace2dias
        }
      },
      include: {
        usuario: {
          select: { nombre: true, username: true }
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    console.log(`📝 Total de movimientos de saldo encontrados: ${movimientosSaldo.length}\n`);
    console.log('='.repeat(100));
    console.log('ANÁLISIS PASO A PASO');
    console.log('='.repeat(100));
    console.log();

    let saldoCalculado = 0;
    const analisis: MovimientoAnalisis[] = [];
    const problemas: string[] = [];

    movimientosSaldo.forEach((mov, index) => {
      const monto = Number(mov.monto);
      const saldoAnterior = Number(mov.saldo_anterior);
      const saldoNuevo = Number(mov.saldo_nuevo);
      const diferencia = saldoNuevo - saldoAnterior;

      // Calcular el saldo esperado según el tipo de movimiento
      let saldoEsperado: number;
      if (mov.tipo === 'INGRESO') {
        saldoEsperado = saldoAnterior + monto;
      } else if (mov.tipo === 'EGRESO') {
        saldoEsperado = saldoAnterior - monto;
      } else if (mov.tipo === 'AJUSTE') {
        // Para ajustes, el monto puede ser positivo o negativo
        saldoEsperado = saldoAnterior + monto;
      } else {
        saldoEsperado = saldoNuevo;
      }

      const descuadre = Math.abs(saldoNuevo - saldoEsperado);

      if (index === 0) {
        saldoCalculado = saldoAnterior;
      }

      const movAnalisis: MovimientoAnalisis = {
        fecha: mov.created_at,
        tipo: mov.tipo,
        descripcion: mov.descripcion || 'Sin descripción',
        monto: monto,
        saldoAnterior: saldoAnterior,
        saldoNuevo: saldoNuevo,
        diferencia: diferencia,
        esperado: saldoEsperado,
        descuadre: descuadre,
        fuente: mov.tipo_referencia,
        id: mov.id,
        usuario: mov.usuario?.nombre || 'N/A',
        esAnulacion: mov.es_anulacion || false
      };

      analisis.push(movAnalisis);

      // Imprimir el movimiento
      console.log(`\n${'─'.repeat(100)}`);
      console.log(`[${index + 1}] ${mov.created_at.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
      console.log(`${'─'.repeat(100)}`);
      console.log(`Tipo: ${mov.tipo}${mov.es_anulacion ? ' (ANULACIÓN)' : ''}`);
      console.log(`Fuente: ${mov.tipo_referencia}`);
      console.log(`Descripción: ${mov.descripcion || 'Sin descripción'}`);
      console.log(`Usuario: ${mov.usuario?.nombre || 'N/A'}`);
      console.log();
      console.log(`Monto del movimiento: $${monto.toFixed(2)}`);
      console.log(`Saldo anterior (registrado): $${saldoAnterior.toFixed(2)}`);
      console.log(`Saldo nuevo (registrado): $${saldoNuevo.toFixed(2)}`);
      console.log(`Diferencia (nuevo - anterior): $${diferencia.toFixed(2)}`);
      console.log();

      // Verificar la lógica
      console.log(`VERIFICACIÓN:`);
      if (mov.tipo === 'INGRESO') {
        console.log(`  Tipo INGRESO → Saldo esperado = ${saldoAnterior.toFixed(2)} + ${monto.toFixed(2)} = ${saldoEsperado.toFixed(2)}`);
      } else if (mov.tipo === 'EGRESO') {
        console.log(`  Tipo EGRESO → Saldo esperado = ${saldoAnterior.toFixed(2)} - ${monto.toFixed(2)} = ${saldoEsperado.toFixed(2)}`);
      } else if (mov.tipo === 'AJUSTE') {
        console.log(`  Tipo AJUSTE → Saldo esperado = ${saldoAnterior.toFixed(2)} + ${monto.toFixed(2)} = ${saldoEsperado.toFixed(2)}`);
      }
      console.log(`  Saldo registrado: ${saldoNuevo.toFixed(2)}`);

      if (descuadre > 0.01) {
        console.log(`  ⚠️  DESCUADRE DETECTADO: $${descuadre.toFixed(2)}`);
        problemas.push(`Movimiento #${index + 1} (${mov.id}): Descuadre de $${descuadre.toFixed(2)}`);
      } else {
        console.log(`  ✅ Cálculo correcto`);
      }

      // Verificar continuidad entre movimientos
      if (index > 0 && Math.abs(saldoAnterior - saldoCalculado) > 0.01) {
        console.log(`  ⚠️  DISCONTINUIDAD: El saldo anterior ($${saldoAnterior.toFixed(2)}) no coincide con el saldo calculado ($${saldoCalculado.toFixed(2)})`);
        problemas.push(`Movimiento #${index + 1}: Discontinuidad de $${Math.abs(saldoAnterior - saldoCalculado).toFixed(2)}`);
      }

      saldoCalculado = saldoNuevo;
    });

    // Resumen del análisis
    console.log('\n\n');
    console.log('='.repeat(100));
    console.log('RESUMEN DEL ANÁLISIS');
    console.log('='.repeat(100));
    console.log();

    const saldoInicial = movimientosSaldo.length > 0 ? Number(movimientosSaldo[0].saldo_anterior) : 0;
    const saldoFinal = movimientosSaldo.length > 0 ? Number(movimientosSaldo[movimientosSaldo.length - 1].saldo_nuevo) : 0;

    console.log(`Saldo inicial del día: $${saldoInicial.toFixed(2)}`);
    console.log(`Saldo final registrado: $${saldoFinal.toFixed(2)}`);
    console.log(`Saldo esperado: $${SALDO_ESPERADO.toFixed(2)}`);
    console.log(`Diferencia: $${(saldoFinal - SALDO_ESPERADO).toFixed(2)}`);
    console.log();

    // Calcular totales por tipo
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustes = 0;
    let totalAnulaciones = 0;

    analisis.forEach(mov => {
      if (mov.esAnulacion) {
        totalAnulaciones++;
      }
      if (mov.tipo === 'INGRESO') {
        totalIngresos += mov.diferencia; // La diferencia real en el saldo
      } else if (mov.tipo === 'EGRESO') {
        totalEgresos += Math.abs(mov.diferencia);
      } else if (mov.tipo === 'AJUSTE') {
        totalAjustes += mov.diferencia;
      }
    });

    console.log(`Total de movimientos: ${analisis.length}`);
    console.log(`  - INGRESOS: ${analisis.filter(m => m.tipo === 'INGRESO').length} movimientos → +$${totalIngresos.toFixed(2)}`);
    console.log(`  - EGRESOS: ${analisis.filter(m => m.tipo === 'EGRESO').length} movimientos → -$${totalEgresos.toFixed(2)}`);
    console.log(`  - AJUSTES: ${analisis.filter(m => m.tipo === 'AJUSTE').length} movimientos → $${totalAjustes.toFixed(2)}`);
    console.log(`  - Anulaciones: ${totalAnulaciones}`);
    console.log();

    // Agrupar por fuente
    const porFuente: Record<string, { count: number; suma: number; resta: number }> = {};
    analisis.forEach(mov => {
      if (!porFuente[mov.fuente]) {
        porFuente[mov.fuente] = { count: 0, suma: 0, resta: 0 };
      }
      porFuente[mov.fuente].count++;
      if (mov.diferencia > 0) {
        porFuente[mov.fuente].suma += mov.diferencia;
      } else {
        porFuente[mov.fuente].resta += Math.abs(mov.diferencia);
      }
    });

    console.log('MOVIMIENTOS POR FUENTE:');
    Object.entries(porFuente).forEach(([fuente, data]) => {
      console.log(`  ${fuente}:`);
      console.log(`    Movimientos: ${data.count}`);
      console.log(`    Suma total: +$${data.suma.toFixed(2)}`);
      console.log(`    Resta total: -$${data.resta.toFixed(2)}`);
      console.log(`    Neto: $${(data.suma - data.resta).toFixed(2)}`);
    });
    console.log();

    // Analizar específicamente los movimientos de SERVICIO_EXTERNO
    const serviciosExternos = analisis.filter(m => m.fuente === 'SERVICIO_EXTERNO');
    if (serviciosExternos.length > 0) {
      console.log('\n📋 ANÁLISIS DE SERVICIOS EXTERNOS:');
      console.log('-'.repeat(100));
      
      const western = serviciosExternos.filter(m => m.descripcion.toLowerCase().includes('western'));
      const reversiones = serviciosExternos.filter(m => m.descripcion.toLowerCase().includes('reverso'));
      
      console.log(`\nTotal de movimientos de servicios externos: ${serviciosExternos.length}`);
      console.log(`  - Western Union: ${western.length}`);
      console.log(`  - Reversiones/Eliminaciones: ${reversiones.length}`);
      
      if (reversiones.length > 0) {
        console.log(`\n🔄 REVERSIONES DETECTADAS:`);
        reversiones.forEach((rev, idx) => {
          console.log(`\n  ${idx + 1}. ${rev.descripcion}`);
          console.log(`     Tipo: ${rev.tipo}`);
          console.log(`     Monto: $${rev.monto.toFixed(2)}`);
          console.log(`     Efecto en saldo: ${rev.diferencia >= 0 ? '+' : ''}$${rev.diferencia.toFixed(2)}`);
          console.log(`     Fecha: ${rev.fecha.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`);
        });
      }
    }

    // Mostrar problemas encontrados
    console.log('\n\n');
    console.log('='.repeat(100));
    console.log('PROBLEMAS DETECTADOS');
    console.log('='.repeat(100));
    console.log();

    if (problemas.length === 0) {
      console.log('✅ No se detectaron errores en los cálculos de los movimientos.');
      console.log('   Todos los movimientos están registrados correctamente en cuanto a su lógica interna.');
    } else {
      console.log(`⚠️  Se detectaron ${problemas.length} problema(s):\n`);
      problemas.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p}`);
      });
    }

    console.log();

    // Saldo actual en la base de datos
    const saldoActualBD = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id
        }
      }
    });

    console.log('\n💰 VERIFICACIÓN FINAL:');
    console.log('-'.repeat(100));
    console.log(`Saldo en tabla MovimientoSaldo (último registro): $${saldoFinal.toFixed(2)}`);
    console.log(`Saldo en tabla Saldo (actual en BD): $${Number(saldoActualBD?.cantidad || 0).toFixed(2)}`);
    
    const concordancia = Math.abs(saldoFinal - Number(saldoActualBD?.cantidad || 0));
    if (concordancia < 0.01) {
      console.log('✅ Los saldos concuerdan entre las tablas');
    } else {
      console.log(`⚠️  DESCUADRE entre tablas: $${concordancia.toFixed(2)}`);
    }

    console.log();
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analisisForense();
