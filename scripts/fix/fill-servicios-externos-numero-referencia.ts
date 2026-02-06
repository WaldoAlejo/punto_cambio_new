import "dotenv/config";
import { PrismaClient, TipoMovimiento as PrismaTipoMovimiento } from "@prisma/client";
import { pickRangeFromArgs, hasFlag } from "../validate/_shared.js";

async function main() {
  const prisma = new PrismaClient();
  const { from, to, pointId, limit } = pickRangeFromArgs();

  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";

  const where: Record<string, unknown> = {
    tipo_movimiento: PrismaTipoMovimiento.EGRESO,
    numero_referencia: null,
    ...(pointId ? { punto_atencion_id: pointId } : {}),
    ...(from || to
      ? {
          fecha: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.servicioExternoMovimiento.findMany({
    where: where as never,
    select: { id: true, servicio: true, fecha: true },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : 5000,
  });

  let wouldFix = 0;
  let fixed = 0;

  for (const r of rows) {
    wouldFix++;
    if (execute) {
      await prisma.servicioExternoMovimiento.update({
        where: { id: r.id },
        data: { numero_referencia: `LEGACY-${r.id.slice(0, 8)}` },
      });
      fixed++;
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: llenaría numero_referencia en ${wouldFix} ServicioExternoMovimiento EGRESO (scan=${rows.length}). Usa --execute para aplicar.`
    );
  } else {
    console.log(`OK: actualizados ${fixed}/${wouldFix} numero_referencia.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo fill-servicios-externos-numero-referencia:", e);
  process.exitCode = 1;
});
