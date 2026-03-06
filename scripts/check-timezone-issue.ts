import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTimezoneIssue() {
  const pointId = 'fa75bb3a-e881-471a-b558-749b0f0de0ff';
  
  console.log('=== ANÁLISIS DE ZONA HORARIA ===\n');
  
  // Obtener movimientos recientes (últimas 24 horas)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: pointId,
      fecha: { gte: hace24h }
    },
    orderBy: { fecha: 'desc' },
    take: 10
  });
  
  console.log('Últimos movimientos de Servicios Externos:\n');
  console.log('ID | Fecha guardada (UTC) | Hora UTC | Hora Ecuador (UTC-5) | Monto | Tipo');
  console.log('-'.repeat(100));
  
  for (const m of movimientos) {
    const fecha = new Date(m.fecha);
    const horaUTC = fecha.toISOString().split('T')[1].substring(0, 8);
    
    // Convertir a hora Ecuador (UTC-5)
    const fechaEcuador = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
    const horaEcuador = fechaEcuador.toISOString().split('T')[1].substring(0, 8);
    
    console.log(
      m.id.substring(0, 8) + ' | ' +
      fecha.toISOString().split('T')[0] + ' | ' +
      horaUTC + ' | ' +
      horaEcuador + ' | ' +
      Number(m.monto).toFixed(2).padStart(10) + ' | ' +
      m.tipo_movimiento
    );
  }
  
  // Comparar con hora actual
  const now = new Date();
  console.log('\n=== HORA ACTUAL ===');
  console.log('UTC ahora:', now.toISOString());
  console.log('Hora Ecuador (debería ser):', new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString());
  
  await prisma.$disconnect();
}

checkTimezoneIssue().catch(console.error);
