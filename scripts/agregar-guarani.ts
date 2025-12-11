import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const codigo = "PYG";
  const nombre = "Guaraní paraguayo";
  const simbolo = "₲";
  const orden_display = 10;

  // Verifica si ya existe
  const existente = await prisma.moneda.findUnique({
    where: { codigo },
  });

  if (existente) {
    console.log(`La moneda ${codigo} ya existe en la base de datos.`);
    return;
  }

  const nuevaMoneda = await prisma.moneda.create({
    data: {
      codigo,
      nombre,
      simbolo,
      orden_display,
      activo: true,
      comportamiento_compra: "MULTIPLICA",
      comportamiento_venta: "MULTIPLICA",
    },
  });

  console.log(`Moneda creada:`, nuevaMoneda);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
