import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== TIPOS DE MOVIMIENTOS EN LA BASE DE DATOS ===\n");

  const movTypes = await prisma.movimientoSaldo.findMany({
    select: { tipo_movimiento: true },
    distinct: ["tipo_movimiento"],
  });

  console.log("Tipos de movimiento (tipo_movimiento):");
  console.log(movTypes.map((m) => m.tipo_movimiento));

  const refTypes = await prisma.movimientoSaldo.findMany({
    select: { tipo_referencia: true },
    distinct: ["tipo_referencia"],
  });

  console.log("\nTipos de referencia (tipo_referencia):");
  console.log(refTypes.map((r) => r.tipo_referencia));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
