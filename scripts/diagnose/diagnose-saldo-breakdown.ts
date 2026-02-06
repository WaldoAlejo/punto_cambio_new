import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function getFlagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function approxEqual(a: number, b: number, eps = 0.02) {
  return Math.abs(round2(a) - round2(b)) <= eps;
}

async function main() {
  const prisma = new PrismaClient();

  const limit =
    parseIntArg(getFlagValue("--limit") ?? process.env.npm_config_limit) ?? 200;

  const pointId = getFlagValue("--pointId") ?? process.env.npm_config_pointid;
  const monedaId = getFlagValue("--monedaId") ?? process.env.npm_config_monedaid;

  const from = parseDateArg(getFlagValue("--from") ?? process.env.npm_config_from);
  const to = parseDateArg(getFlagValue("--to") ?? process.env.npm_config_to);

  const updatedAtFilter =
    from || to
      ? {
          updated_at: {
            ...(from ? { gte: from } : null),
            ...(to ? { lte: to } : null),
          },
        }
      : {};

  const saldos = await prisma.saldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
      updated_at: true,
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
    where: {
      ...(pointId ? { punto_atencion_id: pointId } : null),
      ...(monedaId ? { moneda_id: monedaId } : null),
      ...updatedAtFilter,
    },
    orderBy: { updated_at: "desc" },
    take: limit,
  });

  const mismatches: Array<{
    id: string;
    puntoId: string;
    puntoNombre: string;
    monedaId: string;
    monedaCodigo: string;
    cantidad: number;
    billetes: number;
    monedas: number;
    bancos: number;
    sumEf: number;
    updatedAt: Date;
    lastMov?: {
      id: string;
      fecha: Date;
      tipo: string;
      monto: number;
      saldo_nuevo: number;
      saldo_anterior: number;
      tipo_ref: string | null;
      ref_id: string | null;
    };
    cantidadMatchesLastMov: boolean | null;
  }> = [];

  for (const s of saldos) {
    const cantidad = Number(s.cantidad);
    const billetes = Number(s.billetes);
    const monedas = Number(s.monedas_fisicas);
    const bancos = Number(s.bancos);
    const sumEf = round2(billetes + monedas);

    if (approxEqual(cantidad, sumEf)) continue;

    const lastMov = await prisma.movimientoSaldo.findFirst({
      select: {
        id: true,
        fecha: true,
        tipo_movimiento: true,
        monto: true,
        saldo_nuevo: true,
        saldo_anterior: true,
        tipo_referencia: true,
        referencia_id: true,
      },
      where: {
        punto_atencion_id: s.punto_atencion_id,
        moneda_id: s.moneda_id,
        ...(from || to
          ? {
              fecha: {
                ...(from ? { gte: from } : null),
                ...(to ? { lte: to } : null),
              },
            }
          : null),
      },
      orderBy: { fecha: "desc" },
    });

    const cantidadMatchesLastMov = lastMov
      ? approxEqual(cantidad, Number(lastMov.saldo_nuevo))
      : null;

    mismatches.push({
      id: s.id,
      puntoId: s.punto_atencion_id,
      puntoNombre: s.puntoAtencion?.nombre ?? "?",
      monedaId: s.moneda_id,
      monedaCodigo: s.moneda?.codigo ?? "?",
      cantidad,
      billetes,
      monedas,
      bancos,
      sumEf,
      updatedAt: s.updated_at,
      lastMov: lastMov
        ? {
            id: lastMov.id,
            fecha: lastMov.fecha,
            tipo: lastMov.tipo_movimiento,
            monto: Number(lastMov.monto),
            saldo_nuevo: Number(lastMov.saldo_nuevo),
            saldo_anterior: Number(lastMov.saldo_anterior),
            tipo_ref: lastMov.tipo_referencia,
            ref_id: lastMov.referencia_id,
          }
        : undefined,
      cantidadMatchesLastMov,
    });
  }

  console.log(
    `Encontrados ${mismatches.length} Saldo con mismatch (scan=${saldos.length}, limit=${limit}).`
  );

  for (const m of mismatches.slice(0, 50)) {
    console.log(
      JSON.stringify(
        {
          saldoId: m.id,
          punto: { id: m.puntoId, nombre: m.puntoNombre },
          moneda: { id: m.monedaId, codigo: m.monedaCodigo },
          updated_at: m.updatedAt,
          cantidad: m.cantidad,
          efectivoSum: m.sumEf,
          billetes: m.billetes,
          monedas: m.monedas,
          bancos: m.bancos,
          cantidadMatchesLastMov: m.cantidadMatchesLastMov,
          lastMov: m.lastMov,
        },
        null,
        0
      )
    );
  }

  await prisma.$disconnect();

  // Exit code: mismatch isn't a crash, but we want CI-ish behavior.
  if (mismatches.length > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error("Fallo diagnose-saldo-breakdown:", e);
  process.exitCode = 1;
});
