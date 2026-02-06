import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const NEGATIVE_TYPES = new Set([
  "EGRESO",
  "TRANSFERENCIA_SALIENTE",
  "TRANSFERENCIA_SALIDA",
]);

const POSITIVE_TYPES = new Set([
  "INGRESO",
  "SALDO_INICIAL",
  "TRANSFERENCIA_ENTRANTE",
  "TRANSFERENCIA_ENTRADA",
  "TRANSFERENCIA_DEVOLUCION",
]);

function getFlagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function parseIntArg(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateArg(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePositionalInt(): number | undefined {
  const args = process.argv.slice(2);
  for (const a of args) {
    if (/^\d+$/.test(a)) {
      const n = Number.parseInt(a, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

async function main() {
  const prisma = new PrismaClient();

  const limit =
    parseIntArg(getFlagValue("--limit") ?? process.env.npm_config_limit) ??
    parsePositionalInt() ??
    5000;
  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";
  const verbose =
    hasFlag("--verbose") ||
    process.env.npm_config_verbose === "true" ||
    process.env.npm_config_verbose === "1";

  const pointId = getFlagValue("--pointId") ?? process.env.npm_config_pointid;
  const monedaId = getFlagValue("--monedaId") ?? process.env.npm_config_monedaid;
  const from = parseDateArg(getFlagValue("--from") ?? process.env.npm_config_from);
  const to = parseDateArg(getFlagValue("--to") ?? process.env.npm_config_to);

  const where: Prisma.MovimientoSaldoWhereInput = {
    ...(pointId ? { punto_atencion_id: pointId } : null),
    ...(monedaId ? { moneda_id: monedaId } : null),
    ...(from || to
      ? {
          fecha: {
            ...(from ? { gte: from } : null),
            ...(to ? { lte: to } : null),
          },
        }
      : null),
  };

  const rows = await prisma.movimientoSaldo.findMany({
    select: {
      id: true,
      tipo_movimiento: true,
      monto: true,
      saldo_anterior: true,
      saldo_nuevo: true,
      fecha: true,
    },
    where,
    orderBy: { fecha: "desc" },
    take: limit,
  });

  let wouldFix = 0;
  let fixed = 0;
  let skippedDeltaMismatch = 0;

  for (const r of rows) {
    const monto = Number(r.monto);
    if (!Number.isFinite(monto)) continue;

    const saldoAnterior = Number(r.saldo_anterior);
    const saldoNuevo = Number(r.saldo_nuevo);
    const delta =
      Number.isFinite(saldoAnterior) && Number.isFinite(saldoNuevo)
        ? saldoNuevo - saldoAnterior
        : undefined;

    if (NEGATIVE_TYPES.has(r.tipo_movimiento) && monto > 0.001) {
      const proposed = -monto;
      if (delta !== undefined && !approxEqual(delta, proposed)) {
        skippedDeltaMismatch++;
        if (verbose) {
          console.log(
            `[SKIP] delta mismatch (NEG): id=${r.id} tipo=${r.tipo_movimiento} monto=${monto} delta=${delta} proposed=${proposed}`
          );
        }
        continue;
      }

      wouldFix++;
      if (execute) {
        await prisma.movimientoSaldo.update({
          where: { id: r.id },
          data: { monto: proposed },
        });
        fixed++;
      }
    }

    if (POSITIVE_TYPES.has(r.tipo_movimiento) && monto < -0.001) {
      const proposed = Math.abs(monto);
      if (delta !== undefined && !approxEqual(delta, proposed)) {
        skippedDeltaMismatch++;
        if (verbose) {
          console.log(
            `[SKIP] delta mismatch (POS): id=${r.id} tipo=${r.tipo_movimiento} monto=${monto} delta=${delta} proposed=${proposed}`
          );
        }
        continue;
      }

      wouldFix++;
      if (execute) {
        await prisma.movimientoSaldo.update({
          where: { id: r.id },
          data: { monto: proposed },
        });
        fixed++;
      }
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: encontraría ${wouldFix} MovimientoSaldo con signo incorrecto (scan=${rows.length}, limit=${limit}). Usa --execute para aplicar.`
    );
    if (skippedDeltaMismatch > 0) {
      console.log(
        `INFO: omitidos ${skippedDeltaMismatch} por delta mismatch (saldo_nuevo - saldo_anterior != proposed monto).`
      );
    }
  } else {
    console.log(`OK: corregidos ${fixed}/${wouldFix} MovimientoSaldo.`);
    if (skippedDeltaMismatch > 0) {
      console.log(
        `INFO: omitidos ${skippedDeltaMismatch} por delta mismatch (revisar manual).`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo fix-movimiento-saldo-signs:", e);
  process.exitCode = 1;
});
