import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function getArgValue(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function printHelp() {
  console.log("\nNormalizar Saldo: billetes+monedas == cantidad (y reparar negativos obvios)\n");
  console.log("Uso (dry-run):");
  console.log("  npx tsx scripts/fix/normalize-saldo-breakdown.ts");
  console.log("\nEjecutar (escribe BD):");
  console.log(
    "  CONFIRM=1 npx tsx scripts/fix/normalize-saldo-breakdown.ts --execute"
  );
  console.log("\nOpciones:");
  console.log("  --limit <n>       Limita cantidad de saldos a procesar");
  console.log("  --execute         Ejecuta cambios (default: dry-run)");
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const execute = hasFlag("--execute");
  const limitRaw = getArgValue("--limit");
  const limit = limitRaw ? Math.max(0, Number(limitRaw)) : undefined;

  if (execute && process.env.CONFIRM !== "1") {
    throw new Error(
      "Blocked: to execute write operations, set CONFIRM=1 and pass --execute"
    );
  }

  const prisma = new PrismaClient();
  try {
    const saldos = await prisma.saldo.findMany({
      select: {
        id: true,
        punto_atencion_id: true,
        moneda_id: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
      },
      orderBy: { id: "asc" },
      take: limit && limit > 0 ? limit : undefined,
    });

    let candidates = 0;
    let fixed = 0;

    for (const s of saldos) {
      const cantidad = Number(s.cantidad);
      const billetes = Number(s.billetes);
      const monedas = Number(s.monedas_fisicas);
      const efectivoSum = round2(billetes + monedas);

      const mismatch = Math.abs(round2(cantidad - efectivoSum)) > 0.01;
      const negative = cantidad < -0.01;
      const breakdownNegative = billetes < -0.01 || monedas < -0.01;

      if (!mismatch && !negative && !breakdownNegative) continue;
      candidates++;

      let newCantidad = cantidad;
      // If cantidad is negative but breakdown sum is non-negative, prefer the breakdown.
      if (negative && efectivoSum >= 0) {
        newCantidad = efectivoSum;
      }

      // Normalize breakdown to match cantidad.
      const normalizedCantidad = round2(newCantidad);
      const newBilletes = normalizedCantidad;
      const newMonedas = 0;

      if (!execute) {
        console.log(
          `- ${s.id} punto=${s.punto_atencion_id} moneda=${s.moneda_id} cantidad=${cantidad} efectivoSum=${efectivoSum} -> cantidad=${normalizedCantidad} billetes=${newBilletes} monedas=${newMonedas}`
        );
        continue;
      }

      await prisma.saldo.update({
        where: { id: s.id },
        data: {
          cantidad: new Prisma.Decimal(normalizedCantidad),
          billetes: new Prisma.Decimal(newBilletes),
          monedas_fisicas: new Prisma.Decimal(newMonedas),
        },
      });
      fixed++;
    }

    console.log("\nResumen:");
    console.log(`- Saldo rows scanned: ${saldos.length}`);
    console.log(`- Candidates: ${candidates}`);
    console.log(`- Fixed: ${execute ? fixed : 0}`);
    console.log(`- Mode: ${execute ? "EXECUTE" : "DRY-RUN"}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("normalize-saldo-breakdown failed:", e);
  process.exit(1);
});
