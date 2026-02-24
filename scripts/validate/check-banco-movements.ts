import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== MOVIMIENTOS POR BUCKET (CAJA vs BANCOS) ===\n");

  const counts = await prisma.movimientoSaldo.groupBy({
    by: ["tipo_referencia"],
    _count: { _all: true },
  });

  console.log("Conteo por tipo_referencia:");
  console.log(counts);

  const bancosCount = await prisma.movimientoSaldo.count({
    where: {
      descripcion: {
        contains: "banco",
        mode: "insensitive",
      },
    },
  });

  console.log(`\nMovimientos con 'banco' en la descripción: ${bancosCount}`);

  if (bancosCount > 0) {
    const sample = await prisma.movimientoSaldo.findMany({
      where: {
        descripcion: {
          contains: "banco",
          mode: "insensitive",
        },
      },
      take: 5,
    });
    console.log("\nEjemplos de movimientos de banco:");
    console.log(sample.map(m => ({ id: m.id, desc: m.descripcion, monto: m.monto })));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
