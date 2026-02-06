import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  approxEqual,
  pickRangeFromArgs,
  toNumber,
  hasFlag,
} from "../validate/_shared.js";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

async function main() {
  const prisma = new PrismaClient();
  const { from, to, pointId, limit } = pickRangeFromArgs();

  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";

  const where: Record<string, unknown> = {
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

  const rows = await prisma.cambioDivisa.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      fecha: true,
      monto_origen: true,
      monto_destino: true,
      tasa_cambio_billetes: true,
      tasa_cambio_monedas: true,
      divisas_entregadas_billetes: true,
      divisas_entregadas_monedas: true,
      divisas_recibidas_billetes: true,
      divisas_recibidas_monedas: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : 20000,
  });

  let wouldFix = 0;
  let fixed = 0;
  let skipped = 0;

  for (const r of rows) {
    const montoOrigen = toNumber(r.monto_origen);
    const montoDestino = toNumber(r.monto_destino);
    const implied =
      montoOrigen > 0 && montoDestino > 0 ? round3(montoDestino / montoOrigen) : NaN;

    const entB = toNumber(r.divisas_entregadas_billetes);
    const entM = toNumber(r.divisas_entregadas_monedas);
    const recB = toNumber(r.divisas_recibidas_billetes);
    const recM = toNumber(r.divisas_recibidas_monedas);

    const tasaB = toNumber(r.tasa_cambio_billetes);
    const tasaM = toNumber(r.tasa_cambio_monedas);

    const needsB = (entB > 0.01 || recB > 0.01) && !(tasaB > 0);
    const needsM = (entM > 0.01 || recM > 0.01) && !(tasaM > 0);

    if (!needsB && !needsM) continue;

    const base =
      Number.isFinite(tasaB) && tasaB > 0
        ? tasaB
        : Number.isFinite(tasaM) && tasaM > 0
          ? tasaM
          : implied;

    if (!(base > 0)) {
      skipped++;
      continue;
    }

    const nextB = needsB ? round3(base) : undefined;
    const nextM = needsM ? round3(base) : undefined;

    const patch: Record<string, number> = {};
    if (nextB !== undefined && nextB > 0) patch.tasa_cambio_billetes = nextB;
    if (nextM !== undefined && nextM > 0) patch.tasa_cambio_monedas = nextM;

    if (!Object.keys(patch).length) {
      skipped++;
      continue;
    }

    // Guard extra: no tocar si ya estaba casi igual (por redondeo raro)
    if (
      patch.tasa_cambio_billetes !== undefined &&
      Number.isFinite(tasaB) &&
      approxEqual(tasaB, patch.tasa_cambio_billetes, 0.0005)
    ) {
      delete patch.tasa_cambio_billetes;
    }
    if (
      patch.tasa_cambio_monedas !== undefined &&
      Number.isFinite(tasaM) &&
      approxEqual(tasaM, patch.tasa_cambio_monedas, 0.0005)
    ) {
      delete patch.tasa_cambio_monedas;
    }

    if (!Object.keys(patch).length) continue;

    wouldFix++;
    if (execute) {
      await prisma.cambioDivisa.update({ where: { id: r.id }, data: patch as never });
      fixed++;
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: corregiría tasas en ${wouldFix} CambioDivisa (scan=${rows.length}). Usa --execute para aplicar.`
    );
  } else {
    console.log(`OK: corregidas tasas en ${fixed}/${wouldFix} CambioDivisa.`);
  }

  if (skipped > 0) {
    console.log(`INFO: omitidos ${skipped} (montos inválidos o no calculable).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo fix-exchanges-zero-rates:", e);
  process.exitCode = 1;
});
