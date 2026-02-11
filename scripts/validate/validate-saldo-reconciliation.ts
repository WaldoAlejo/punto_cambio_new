import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { saldoReconciliationService } from "../../server/services/saldoReconciliationService.js";

function approxEqual(a: number, b: number, eps = 0.02) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const pointIdArg = process.argv.includes("--pointId")
      ? process.argv[process.argv.indexOf("--pointId") + 1]
      : undefined;

    const points = await prisma.puntoAtencion.findMany({
      where: pointIdArg ? { id: pointIdArg } : undefined,
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: "asc" },
    });

    const saldos = await prisma.saldo.findMany({
      where: {
        ...(pointIdArg ? { punto_atencion_id: pointIdArg } : {}),
      },
      select: {
        punto_atencion_id: true,
        moneda_id: true,
        cantidad: true,
      },
    });

    const pointName = new Map(points.map((p) => [p.id, p.nombre]));

    // Monedas usadas por saldos
    const monedaIds = Array.from(new Set(saldos.map((s) => s.moneda_id)));
    const monedas = await prisma.moneda.findMany({
      where: { id: { in: monedaIds } },
      select: { id: true, codigo: true },
    });
    const monedaCodigo = new Map(monedas.map((m) => [m.id, m.codigo]));

    let checked = 0;
    const mismatches: Array<{
      pointId: string;
      point: string;
      moneda: string;
      saldoCantidad: number;
      saldoRealCaja: number;
      diff: number;
    }> = [];

    // Validar cada saldo contra la reconciliación
    for (const s of saldos) {
      const saldoCantidad = Number(s.cantidad ?? 0);
      const saldoRealCaja = await saldoReconciliationService.calcularSaldoReal(
        s.punto_atencion_id,
        s.moneda_id
      );
      const diff = Number((saldoCantidad - saldoRealCaja).toFixed(2));
      checked++;

      if (!approxEqual(saldoCantidad, saldoRealCaja, 0.02)) {
        mismatches.push({
          pointId: s.punto_atencion_id,
          point: pointName.get(s.punto_atencion_id) ?? s.punto_atencion_id,
          moneda: monedaCodigo.get(s.moneda_id) ?? s.moneda_id,
          saldoCantidad,
          saldoRealCaja,
          diff,
        });
      }
    }

    console.log("VALIDATE_SALDO_RECONCILIATION");
    console.log({
      points: points.length,
      saldos: saldos.length,
      checked,
      mismatches: mismatches.length,
    });

    if (mismatches.length) {
      // Mostrar top 50 por abs(diff)
      mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      const top = mismatches.slice(0, 50);
      console.log("TOP_MISMATCHES (max 50):");
      for (const m of top) {
        console.log(
          `- ${m.point} | ${m.moneda} | saldo=${m.saldoCantidad.toFixed(
            2
          )} | real=${m.saldoRealCaja.toFixed(2)} | diff=${m.diff.toFixed(2)}`
        );
      }
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("VALIDATE_SALDO_RECONCILIATION_FAILED", e);
  process.exit(1);
});
