
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pas = await prisma.puntoAtencion.findMany({
    select: { id: true, nombre: true }
  });
  console.log(JSON.stringify(pas, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
