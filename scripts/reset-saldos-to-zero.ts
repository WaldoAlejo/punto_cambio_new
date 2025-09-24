/*
  Reinicializa saldos a 0 (cantidad, billetes, monedas_fisicas) para
  todas las combinaciones de PuntoAtencion activo x Moneda activa.
  - Crea la fila de Saldo si no existe (upsert)
  - No crea movimientos ni historial (arranque en limpio)

  Uso:
    npx tsx scripts/reset-saldos-to-zero.ts
*/

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function chunked<T>(arr: T[], size: number): Promise<T[][]> {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log("\n=== Reinicializando saldos a 0 ===\n");

  const [puntos, monedas] = await Promise.all([
    prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true },
    }),
  ]);

  if (puntos.length === 0 || monedas.length === 0) {
    console.log("No hay puntos o monedas activas. Nada por hacer.");
    return;
  }

  const combos = puntos.flatMap((p) => monedas.map((m) => ({ p, m })));
  console.log(
    `Puntos activos: ${puntos.length}, Monedas activas: ${monedas.length}`
  );
  console.log(`Total combinaciones a asegurar: ${combos.length}`);

  let processed = 0;
  const batches = await chunked(combos, 50);

  for (const batch of batches) {
    await Promise.all(
      batch.map(({ p, m }) =>
        prisma.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: p.id,
              moneda_id: m.id,
            },
          },
          create: {
            punto_atencion_id: p.id,
            moneda_id: m.id,
            cantidad: new Prisma.Decimal(0),
            billetes: new Prisma.Decimal(0),
            monedas_fisicas: new Prisma.Decimal(0),
          },
          update: {
            cantidad: new Prisma.Decimal(0),
            billetes: new Prisma.Decimal(0),
            monedas_fisicas: new Prisma.Decimal(0),
          },
        })
      )
    );
    processed += batch.length;
    console.log(`- Aseguradas ${processed}/${combos.length}`);
  }

  console.log(
    "\nListo: todos los saldos quedaron en 0 para Puntos x Monedas activas.\n"
  );
}

main()
  .catch((e) => {
    console.error("Error reinicializando saldos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
