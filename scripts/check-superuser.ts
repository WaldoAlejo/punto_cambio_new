import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: 'SUPER_USUARIO' },
    select: { id: true, nombre: true, rol: true }
  });
  console.log('SUPER_USUARIOS:', usuarios);
  await prisma.$disconnect();
}
main();
