import "dotenv/config";
import { PrismaClient, ServicioExterno } from "@prisma/client";

function getFlagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseIntArg(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
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

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp0 = (n: number) => (n < 0 ? 0 : n);

function normalizeSaldoCaja(input: {
  cantidad: number;
  billetes: number;
  monedas: number;
  bancos: number;
}) {
  // Saldo.cantidad representa EFECTIVO (CAJA). `bancos` es separado.
  const cantidad = round2(input.cantidad);
  const bancos = round2(clamp0(input.bancos));

  // Si el desglose es inválido/negativo o no cuadra, lo normalizamos sin tocar `cantidad`.
  // Preferimos conservar proporción billetes/monedas cuando sea posible.
  let billetes = round2(clamp0(input.billetes));
  let monedas = round2(clamp0(input.monedas));

  const sumEf = round2(billetes + monedas);
  if (cantidad < -0.01) {
    return { cantidad: 0, billetes: 0, monedas: 0, bancos };
  }

  if (Math.abs(sumEf - cantidad) > 0.02) {
    if (sumEf > 0) {
      const scale = cantidad / sumEf;
      billetes = round2(clamp0(billetes * scale));
      monedas = round2(clamp0(monedas * scale));
      const sumScaled = round2(billetes + monedas);
      const diff = round2(cantidad - sumScaled);
      if (Math.abs(diff) > 0.01) {
        billetes = round2(clamp0(billetes + diff));
      }
    } else {
      billetes = round2(clamp0(cantidad));
      monedas = 0;
    }
  }

  return { cantidad: round2(clamp0(cantidad)), billetes, monedas, bancos };
}

function normalizeServicioExternoSaldo(input: {
  cantidad: number;
  billetes: number;
  monedas: number;
  bancos: number;
}) {
  // En ServicioExternoSaldo `cantidad` es TOTAL (incluye bancos).
  let total = round2(input.cantidad);
  if (total < 0) total = 0;

  let bancos = round2(clamp0(input.bancos));
  let monedas = round2(clamp0(input.monedas));
  let billetes = round2(clamp0(input.billetes));

  // Cap bancos to total
  if (bancos > total) bancos = total;

  // Ensure monedas does not exceed remaining after bancos
  const remainingAfterBanks = round2(total - bancos);
  if (monedas > remainingAfterBanks) monedas = remainingAfterBanks;

  // Billetes is the residual
  billetes = round2(clamp0(total - bancos - monedas));

  // Last-resort rounding correction to keep exact sum
  const sum = round2(billetes + monedas + bancos);
  const diff = round2(total - sum);
  if (Math.abs(diff) > 0.01) {
    billetes = round2(clamp0(billetes + diff));
    // Re-cap again in case correction pushed it negative (shouldn't, but safe)
    billetes = round2(clamp0(billetes));
  }

  return { cantidad: total, billetes, monedas, bancos };
}

async function main() {
  const prisma = new PrismaClient();

  const limit =
    parseIntArg(getFlagValue("--limit") ?? process.env.npm_config_limit) ??
    parsePositionalInt() ??
    10000;
  const execute = hasFlag("--execute");

  const pointId = getFlagValue("--pointId") ?? process.env.npm_config_pointid;
  const monedaId = getFlagValue("--monedaId") ?? process.env.npm_config_monedaid;
  const servicioRaw =
    getFlagValue("--servicio") ?? process.env.npm_config_servicio;
  const servicio = servicioRaw
    ? (Object.values(ServicioExterno).includes(servicioRaw as ServicioExterno)
        ? (servicioRaw as ServicioExterno)
        : undefined)
    : undefined;

  if (servicioRaw && !servicio) {
    console.error(
      `Valor inválido para --servicio: ${servicioRaw}. Esperado uno de: ${Object.values(
        ServicioExterno
      ).join(", ")}`
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

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
    where: {
      ...(pointId ? { punto_atencion_id: pointId } : null),
      ...(monedaId ? { moneda_id: monedaId } : null),
    },
    take: limit,
  });

  const seSaldos = await prisma.servicioExternoSaldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      servicio: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
    },
    where: {
      ...(pointId ? { punto_atencion_id: pointId } : null),
      ...(monedaId ? { moneda_id: monedaId } : null),
      ...(servicio ? { servicio } : null),
    },
    take: limit,
  });

  let wouldUpdate = 0;
  let updated = 0;

  for (const s of saldos) {
    const next = normalizeSaldoCaja({
      cantidad: Number(s.cantidad),
      billetes: Number(s.billetes),
      monedas: Number(s.monedas_fisicas),
      bancos: Number(s.bancos),
    });

    const changed =
      Math.abs(next.cantidad - Number(s.cantidad)) > 0.01 ||
      Math.abs(next.billetes - Number(s.billetes)) > 0.01 ||
      Math.abs(next.monedas - Number(s.monedas_fisicas)) > 0.01 ||
      Math.abs(next.bancos - Number(s.bancos)) > 0.01;

    if (changed) {
      wouldUpdate++;
      if (execute) {
        await prisma.saldo.update({
          where: { id: s.id },
          data: {
            cantidad: next.cantidad,
            billetes: next.billetes,
            monedas_fisicas: next.monedas,
            bancos: next.bancos,
          },
        });
        updated++;
      }
    }
  }

  for (const s of seSaldos) {
    const next = normalizeServicioExternoSaldo({
      cantidad: Number(s.cantidad),
      billetes: Number(s.billetes),
      monedas: Number(s.monedas_fisicas),
      bancos: Number(s.bancos),
    });

    const changed =
      Math.abs(next.cantidad - Number(s.cantidad)) > 0.01 ||
      Math.abs(next.billetes - Number(s.billetes)) > 0.01 ||
      Math.abs(next.monedas - Number(s.monedas_fisicas)) > 0.01 ||
      Math.abs(next.bancos - Number(s.bancos)) > 0.01;

    if (changed) {
      wouldUpdate++;
      if (execute) {
        await prisma.servicioExternoSaldo.update({
          where: { id: s.id },
          data: {
            cantidad: next.cantidad,
            billetes: next.billetes,
            monedas_fisicas: next.monedas,
            bancos: next.bancos,
          },
        });
        updated++;
      }
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: normalizaría ${wouldUpdate} registros (Saldo + ServicioExternoSaldo). Usa --execute para aplicar.`
    );
  } else {
    console.log(`OK: normalizados ${updated}/${wouldUpdate} registros.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo normalize-saldos-breakdown:", e);
  process.exitCode = 1;
});
