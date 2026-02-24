import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== INSPECCIÓN DE SALDOS (CAJA VS BANCOS) ===\n");

  const saldos = await prisma.saldo.findMany({
    where: {
      OR: [
        { cantidad: { gt: 0 } },
        { bancos: { gt: 0 } }
      ]
    },
    include: {
      puntoAtencion: true,
      moneda: true
    }
  });

  console.log(`Encontrados ${saldos.length} saldos con valores.`);

  for (const s of saldos) {
    if (Number(s.cantidad) !== 0 || Number(s.bancos) !== 0) {
      console.log(`${s.puntoAtencion.nombre} | ${s.moneda.codigo}:`);
      console.log(`  CAJA (cantidad): ${s.cantidad}`);
      console.log(`  BILLETES: ${s.billetes}`);
      console.log(`  MONEDAS: ${s.monedas_fisicas}`);
      console.log(`  BANCOS: ${s.bancos}`);
      console.log(`  Suma física: ${Number(s.billetes) + Number(s.monedas_fisicas)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
