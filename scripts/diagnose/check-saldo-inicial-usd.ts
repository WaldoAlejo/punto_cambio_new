import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { gyeDayRangeUtcFromDateOnly } from "../../server/utils/timezone.ts";
import saldoReconciliationService from "../../server/services/saldoReconciliationService.ts";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const date = getArg("--date") ?? "2026-02-05";
  const currency = getArg("--currency") ?? "USD";
  const needle = getArg("--needle");
  const all = hasFlag("--all");

  const prisma = new PrismaClient();
  try {
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: currency },
      select: { id: true, codigo: true },
    });
    if (!moneda) throw new Error(`Moneda not found: ${currency}`);

    const points = await prisma.puntoAtencion.findMany({
      where: all
        ? {}
        : needle
          ? { nombre: { contains: needle, mode: "insensitive" } }
          : {
              OR: [
                { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
                { nombre: { contains: "EL BOSQUE", mode: "insensitive" } },
                { nombre: { contains: "PLAZA", mode: "insensitive" } },
                { nombre: { contains: "OFICINA", mode: "insensitive" } },
                { nombre: { contains: "SCALA", mode: "insensitive" } },
              ],
            },
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: "asc" },
    });

    const { gte: dayStartUtc, lt: dayEndUtc } = gyeDayRangeUtcFromDateOnly(date);

    console.log(`# Active SaldoInicial + AJUSTE_MANUAL (${moneda.codigo})`);
    console.log(`date=${date} window=[${dayStartUtc.toISOString()} .. ${dayEndUtc.toISOString()})`);

    for (const p of points) {
      const si = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: p.id,
          moneda_id: moneda.id,
          activo: true,
        },
        select: {
          cantidad_inicial: true,
          fecha_asignacion: true,
          asignado_por: true,
        },
        orderBy: { fecha_asignacion: "desc" },
      });

      const adj = await prisma.movimientoSaldo.findFirst({
        where: {
          punto_atencion_id: p.id,
          moneda_id: moneda.id,
          tipo_referencia: "AJUSTE_MANUAL",
          descripcion: `AJUSTE SALDO FIN DIA ${date} (pantallazo)`,
        },
        select: {
          id: true,
          tipo_movimiento: true,
          monto: true,
          fecha: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });

      const movsAfter = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: p.id,
          moneda_id: moneda.id,
          fecha: { gte: dayEndUtc },
        },
        select: {
          tipo_movimiento: true,
          monto: true,
          descripcion: true,
          fecha: true,
        },
        orderBy: { fecha: "asc" },
        take: 20,
      });

      const cashAfter = movsAfter.filter((m) => {
        const desc = (m.descripcion ?? "").toLowerCase();
        return !desc.includes("bancos") && !desc.includes("banco");
      });

      const deltaAfter = cashAfter.reduce((acc, m) => {
        const delta = saldoReconciliationService._normalizarMonto(
          String(m.tipo_movimiento),
          Number(m.monto),
          m.descripcion
        );
        if (String(m.tipo_movimiento).toUpperCase() === "SALDO_INICIAL") return acc;
        return acc + delta;
      }, 0);

      console.log(`\n- ${p.nombre} | ${p.id} | activo=${p.activo}`);
      if (si) {
        console.log(
          `  saldoInicial.activo: cantidad=${Number(si.cantidad_inicial)} fecha_asignacion=${si.fecha_asignacion.toISOString()} asignado_por=${si.asignado_por}`
        );
      } else {
        console.log("  saldoInicial.activo: (none)");
      }
      if (adj) {
        console.log(
          `  ajusteManual: id=${adj.id} tipo=${adj.tipo_movimiento} monto=${Number(adj.monto)} fecha=${adj.fecha.toISOString()} created_at=${adj.created_at.toISOString()}`
        );
      } else {
        console.log("  ajusteManual: (none)");
      }

      console.log(
        `  movsAfter(finDia->): total=${movsAfter.length} cash=${cashAfter.length} cashDelta=${Number(deltaAfter.toFixed(2))}`
      );
      for (const m of cashAfter.slice(0, 5)) {
        console.log(
          `    - ${m.fecha.toISOString()} tipo=${m.tipo_movimiento} monto=${Number(m.monto)} desc=${(m.descripcion ?? "").slice(0, 60)}`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
