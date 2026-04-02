import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, rol: true }
  });
  console.log('Usuarios:');
  for (const u of usuarios) {
    console.log(`  ${u.id} | ${u.nombre} | ${u.rol}`);
  }
  await prisma.$disconnect();
}
main();
