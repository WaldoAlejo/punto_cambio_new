import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('VERIFICANDO REFERENCIAS DE MOVIMIENTOS\n');

  // Verificar referencia COP
  console.log('1. Referencia COP: bf9a7314-e779-43ad-a5cc-1dd5bc7bcf6f');
  const transCOP = await prisma.transferencia.findUnique({
    where: { id: 'bf9a7314-e779-43ad-a5cc-1dd5bc7bcf6f' }
  });
  console.log('   Transferencia encontrada:', transCOP ? 'SÍ' : 'NO');
  if (transCOP) {
    console.log('   Estado:', transCOP.estado);
    console.log('   Monto:', Number(transCOP.monto).toFixed(2));
  }

  // Verificar referencia CAD
  console.log('\n2. Referencia CAD: 9c1efa28-780c-4d52-bc99-4ac60bd5372b');
  const transCAD = await prisma.transferencia.findUnique({
    where: { id: '9c1efa28-780c-4d52-bc99-4ac60bd5372b' }
  });
  console.log('   Transferencia encontrada:', transCAD ? 'SÍ' : 'NO');
  if (transCAD) {
    console.log('   Estado:', transCAD.estado);
    console.log('   Monto:', Number(transCAD.monto).toFixed(2));
  }

  // Buscar en otras tablas
  console.log('\n3. Buscando en otras tablas...');
  
  // Buscar como servicio externo
  const servCOP = await prisma.servicioExterno.findUnique({
    where: { id: 'bf9a7314-e779-43ad-a5cc-1dd5bc7bcf6f' }
  });
  console.log('   ServicioExterno COP:', servCOP ? 'SÍ' : 'NO');

  const servCAD = await prisma.servicioExterno.findUnique({
    where: { id: '9c1efa28-780c-4d52-bc99-4ac60bd5372b' }
  });
  console.log('   ServicioExterno CAD:', servCAD ? 'SÍ' : 'NO');

  await prisma.$disconnect();
}

main();
