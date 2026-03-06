import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('=== ESTADO ACTUAL DE LAS FECHAS ===\n');
  
  const movs = await prisma.servicioExternoMovimiento.findMany({
    where: { punto_atencion_id: 'fa75bb3a-e881-471a-b558-749b0f0de0ff' },
    orderBy: { fecha: 'desc' },
    take: 10
  });
  
  console.log('Fecha guardada (UTC)  |  Hora Ecuador (debería ser)  |  Descripción');
  console.log('-'.repeat(90));
  
  for (const m of movs) {
    const fecha = m.fecha;
    const horaUTC = fecha.toISOString().split('T')[1].substring(0, 8);
    const horaEcuador = String(fecha.getUTCHours() - 5).padStart(2, '0') + ':' + 
                        String(fecha.getUTCMinutes()).padStart(2, '0') + ':' + 
                        String(fecha.getUTCSeconds()).padStart(2, '0');
    
    console.log(
      fecha.toISOString().split('T')[0] + ' ' + horaUTC + '  |  ' +
      horaEcuador + '  |  ' +
      (m.descripcion || '').substring(0, 40)
    );
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
