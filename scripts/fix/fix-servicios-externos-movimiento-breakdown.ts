import "dotenv/config";
import { PrismaClient, TipoViaTransferencia } from "@prisma/client";
import {
  approxEqual,
  pickRangeFromArgs,
  toNumber,
  hasFlag,
} from "../validate/_shared.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp0(n: number): number {
  return n < 0 ? 0 : n;
}

function normalizeForMetodo(args: {
  metodo: TipoViaTransferencia;
  monto: number;
  billetes: number;
  monedas: number;
  bancos: number;
}): { billetes: number; monedas_fisicas: number; bancos: number } {
  const monto = round2(Math.abs(args.monto));
  const billetes0 = round2(clamp0(args.billetes));
  const monedas0 = round2(clamp0(args.monedas));
  const bancos0 = round2(clamp0(args.bancos));

  if (args.metodo === TipoViaTransferencia.EFECTIVO) {
    const efectivo = billetes0 + monedas0;
    if (efectivo > 0.0001) {
      // Escalar proporcionalmente el efectivo al monto y forzar bancos=0
      const factor = monto / efectivo;
      const bil = round2(billetes0 * factor);
      const mon = round2(monedas0 * factor);
      // Ajuste por redondeo
      const diff = round2(monto - (bil + mon));
      return {
        billetes: round2(clamp0(bil + diff)),
        monedas_fisicas: mon,
        bancos: 0,
      };
    }
    return { billetes: monto, monedas_fisicas: 0, bancos: 0 };
  }

  if (args.metodo === TipoViaTransferencia.BANCO) {
    return { billetes: 0, monedas_fisicas: 0, bancos: monto };
  }

  // MIXTO
  const efectivo = billetes0 + monedas0;
  if (efectivo > 0.0001) {
    if (efectivo >= monto) {
      // Todo cabe en efectivo, escalar a monto
      const factor = monto / efectivo;
      const bil = round2(billetes0 * factor);
      const mon = round2(monedas0 * factor);
      const diff = round2(monto - (bil + mon));
      return {
        billetes: round2(clamp0(bil + diff)),
        monedas_fisicas: mon,
        bancos: 0,
      };
    }
    // Efectivo parcial y el resto en bancos
    const bancos = round2(monto - efectivo);
    return { billetes: billetes0, monedas_fisicas: monedas0, bancos };
  }

  if (bancos0 > 0.0001) {
    return { billetes: 0, monedas_fisicas: 0, bancos: monto };
  }

  // Caso indeterminado: priorizar bancos
  return { billetes: 0, monedas_fisicas: 0, bancos: monto };
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

  const rows = await prisma.servicioExternoMovimiento.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      monto: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
      metodo_ingreso: true,
      fecha: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : 5000,
  });

  let wouldFix = 0;
  let fixed = 0;
  let skipped = 0;

  for (const r of rows) {
    const monto = toNumber(r.monto);
    if (!(monto > 0)) {
      skipped++;
      continue;
    }

    const b = Number.isFinite(toNumber(r.billetes)) ? toNumber(r.billetes) : 0;
    const m = Number.isFinite(toNumber(r.monedas_fisicas))
      ? toNumber(r.monedas_fisicas)
      : 0;
    const bk = Number.isFinite(toNumber(r.bancos)) ? toNumber(r.bancos) : 0;

    const sum = round2(b + m + bk);
    if (approxEqual(sum, monto, 0.02)) continue;

    const normalized = normalizeForMetodo({
      metodo: r.metodo_ingreso,
      monto,
      billetes: b,
      monedas: m,
      bancos: bk,
    });

    const nextSum = round2(
      normalized.billetes + normalized.monedas_fisicas + normalized.bancos
    );
    if (!approxEqual(nextSum, round2(monto), 0.02)) {
      skipped++;
      continue;
    }

    wouldFix++;
    if (execute) {
      await prisma.servicioExternoMovimiento.update({
        where: { id: r.id },
        data: {
          billetes: normalized.billetes,
          monedas_fisicas: normalized.monedas_fisicas,
          bancos: normalized.bancos,
        },
      });
      fixed++;
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: corregiría ${wouldFix} ServicioExternoMovimiento con desglose inconsistente (scan=${rows.length}). Usa --execute para aplicar.`
    );
  } else {
    console.log(`OK: corregidos ${fixed}/${wouldFix} ServicioExternoMovimiento.`);
  }

  if (skipped > 0) {
    console.log(`INFO: omitidos ${skipped} (monto inválido o caso no normalizable).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo fix-servicios-externos-movimiento-breakdown:", e);
  process.exitCode = 1;
});
