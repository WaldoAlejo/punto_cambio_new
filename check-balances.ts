
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const saldos = await prisma.saldo.findMany({
    where: { punto_atencion_id: 'fa75bb3a-e881-471a-b558-749b0f0de0ff' },
    include: { moneda: true }
  });
  console.log(JSON.stringify(saldos, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
