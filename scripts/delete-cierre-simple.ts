import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteCierre() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  const fecha = '2026-03-05';
  
  console.log('=== ELIMINAR CIERRE ===\n');
  
  try {
    const cierre = await prisma.cierreDiario.findFirst({
      where: {
        punto_atencion_id: pointId,
        fecha: new Date(fecha + 'T00:00:00.000Z')
      }
    });
    
    if (!cierre) {
      console.log('No hay cierre para eliminar');
      return;
    }
    
    console.log('Eliminando cierre:', cierre.id);
    
    // Solo eliminar el cierre principal
    await prisma.cierreDiario.delete({
      where: { id: cierre.id }
    });
    
    console.log('✅ Cierre eliminado correctamente');
    console.log('\n🎉 Ahora puedes hacer un nuevo cierre de prueba');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const confirm = process.env.CONFIRM === '1';
if (!confirm) {
  console.log('Usa CONFIRM=1 para ejecutar');
  process.exit(0);
}

deleteCierre().catch(console.error);
