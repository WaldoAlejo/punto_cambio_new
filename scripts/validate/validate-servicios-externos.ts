import "dotenv/config";
import {
  PrismaClient,
  TipoMovimiento as PrismaTipoMovimiento,
  TipoViaTransferencia,
} from "@prisma/client";
import {
  approxEqual,
  makeCollector,
  pickRangeFromArgs,
  printResult,
  toNumber,
} from "./_shared.js";

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:servicios-externos");

  const { from, to, pointId, limit } = pickRangeFromArgs();

  const where: Record<string, unknown> = {};
  if (pointId) where.punto_atencion_id = pointId;
  if (from || to) {
    where.fecha = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const rows = await prisma.servicioExternoMovimiento.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      punto_atencion_id: true,
      servicio: true,
      tipo_movimiento: true,
      moneda_id: true,
      monto: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
      metodo_ingreso: true,
      fecha: true,
      numero_referencia: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const r of rows) {
    const monto = toNumber(r.monto);
    if (!(monto > 0)) {
      c.error("SE_MOV_MONTO_INVALID", "ServicioExternoMovimiento tiene monto no positivo", {
        id: r.id,
        servicio: r.servicio,
        tipo: r.tipo_movimiento,
        monto,
      });
    }

    const billetes = toNumber(r.billetes);
    const monedas = toNumber(r.monedas_fisicas);
    const bancos = toNumber(r.bancos);

    const hasBreakdown =
      Number.isFinite(billetes) || Number.isFinite(monedas) || Number.isFinite(bancos);

    if (hasBreakdown) {
      const b = Number.isFinite(billetes) ? billetes : 0;
      const m = Number.isFinite(monedas) ? monedas : 0;
      const bk = Number.isFinite(bancos) ? bancos : 0;
      const sum = b + m + bk;

      if (!approxEqual(sum, monto, 0.02)) {
        c.warn("SE_MOV_BREAKDOWN_MISMATCH", "Desglose (billetes+monedas+bancos) no coincide con monto", {
          id: r.id,
          monto,
          sum,
          b,
          m,
          bk,
          metodo: r.metodo_ingreso,
        });
      }

      if (r.metodo_ingreso === TipoViaTransferencia.EFECTIVO && bk > 0.01) {
        c.warn("SE_MOV_METHOD_BREAKDOWN", "metodo_ingreso=EFECTIVO pero bancos > 0", {
          id: r.id,
          bancos: bk,
        });
      }

      if (r.metodo_ingreso === TipoViaTransferencia.BANCO && b + m > 0.01) {
        c.warn("SE_MOV_METHOD_BREAKDOWN", "metodo_ingreso=BANCO pero hay billetes/monedas", {
          id: r.id,
          billetes: b,
          monedas: m,
        });
      }
    }

    // Señal: para egresos, normalmente debería existir numero_referencia (no obligatorio)
    if (r.tipo_movimiento === PrismaTipoMovimiento.EGRESO && !r.numero_referencia) {
      c.warn("SE_MOV_NO_REF", "EGRESO sin numero_referencia (tolerante a históricos)", {
        id: r.id,
        servicio: r.servicio,
      });
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-servicios-externos:", e);
  process.exitCode = 1;
});
