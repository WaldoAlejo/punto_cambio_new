
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pa = await prisma.puntoAtencion.findFirst({
    where: { nombre: { contains: 'Royal Pacific' } }
  });
  console.log('Punto Atencion:', JSON.stringify(pa, null, 2));

  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ['ARS', 'CAD', 'USD'] } }
  });
  console.log('Monedas:', JSON.stringify(monedas, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
