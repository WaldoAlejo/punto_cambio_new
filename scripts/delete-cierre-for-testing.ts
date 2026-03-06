import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteCierre() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const fecha = '2026-03-05';
  
  console.log('=== ELIMINAR CIERRE PARA PRUEBA ===\n');
  console.log(`Punto: Royal Pacific`);
  console.log(`Fecha: ${fecha}\n`);
  
  try {
    // Buscar cierre existente
    const cierre = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: pointId,
        fecha: new Date(fecha + 'T00:00:00.000Z')
      }
    });
    
    if (!cierre) {
      console.log('❌ No se encontró cierre para esta fecha');
      return;
    }
    
    console.log('Cierre encontrado:');
    console.log('  ID:', cierre.id);
    console.log('  Fecha:', cierre.fecha);
    console.log('  Fecha cierre:', cierre.fecha_cierre);
    
    // Eliminar detalles primero
    const detallesDeleted = await prisma.cierreDiarioDetalle.deleteMany({
      where: { cierre_diario_id: cierre.id }
    });
    console.log(`\n✅ Detalles eliminados: ${detallesDeleted.count}`);
    
    // Eliminar conteos físicos si existen
    const conteosDeleted = await prisma.cuadreCajaConteoFisico.deleteMany({
      where: { 
        punto_atencion_id: pointId,
        fecha_cierre: new Date(fecha + 'T00:00:00.000Z')
      }
    });
    console.log(`✅ Conteos físicos eliminados: ${conteosDeleted.count}`);
    
    // Eliminar cierre
    await prisma.cierreDiario.delete({
      where: { id: cierre.id }
    });
    console.log(`✅ Cierre eliminado: ${cierre.id}`);
    
    console.log('\n🎉 Listo! Ahora puedes hacer el cierre nuevamente.');
    console.log('Recarga la página de Cierre Diario para ver los datos correctos.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Este script eliminará el cierre del 5/3/2026 de Royal Pacific');
console.log('para permitirte hacer un nuevo cierre de prueba.\n');
console.log('Para ejecutar: CONFIRM=1 npx tsx scripts/delete-cierre-for-testing.ts\n');

const confirm = process.env.CONFIRM === '1';
if (!confirm) {
  console.log('❌ Ejecución cancelada. Usa CONFIRM=1 para confirmar.');
  process.exit(0);
}

deleteCierre().catch(console.error);
