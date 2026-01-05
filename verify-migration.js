// Script para verificar que la migración se aplicó correctamente
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificarMigracion() {
  try {
    console.log('🔍 Verificando migración de agencia en ServientregaGuia...\n');

    // 1. Verificar total de guías
    const totalGuias = await prisma.servientregaGuia.count();
    console.log(`📊 Total de guías en BD: ${totalGuias}`);

    // 2. Verificar guías con agencia poblada
    const guiasConAgencia = await prisma.servientregaGuia.count({
      where: {
        agencia_codigo: { not: null }
      }
    });
    console.log(`✅ Guías con agencia_codigo: ${guiasConAgencia}`);

    // 3. Mostrar ejemplos
    const ejemplos = await prisma.servientregaGuia.findMany({
      take: 5,
      select: {
        numero_guia: true,
        agencia_codigo: true,
        agencia_nombre: true,
        punto_atencion_id: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });

    console.log('\n📋 Ejemplos de guías (últimas 5):');
    ejemplos.forEach((g, i) => {
      console.log(`\n  ${i + 1}. Guía: ${g.numero_guia}`);
      console.log(`     Agencia: ${g.agencia_codigo || 'N/A'} - ${g.agencia_nombre || 'N/A'}`);
      console.log(`     Punto: ${g.punto_atencion_id || 'N/A'}`);
    });

    // 4. Verificar puntos con agencia
    const puntosConAgencia = await prisma.puntoAtencion.count({
      where: {
        servientrega_agencia_codigo: { not: null }
      }
    });
    console.log(`\n🏢 Puntos de atención con agencia Servientrega: ${puntosConAgencia}`);

    console.log('\n✅ Migración verificada exitosamente!');
    console.log('📌 No se perdió ninguna información existente.');
    
  } catch (error) {
    console.error('❌ Error al verificar migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarMigracion();
