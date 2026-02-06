import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { approxEqual, makeCollector, pickRangeFromArgs, printResult, toNumber } from "./_shared.js";

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:saldos");

  const { pointId, limit } = pickRangeFromArgs();

  // Saldo (general)
  const saldos = await prisma.saldo.findMany({
    where: pointId ? { punto_atencion_id: pointId } : undefined,
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
      updated_at: true,
    },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const s of saldos) {
    const cantidad = toNumber(s.cantidad);
    const billetes = toNumber(s.billetes);
    const monedas = toNumber(s.monedas_fisicas);
    const bancos = toNumber(s.bancos);

    if (![cantidad, billetes, monedas, bancos].every(Number.isFinite)) {
      c.error("SALDO_NAN", "Saldo contiene valores no numéricos", {
        saldoId: s.id,
        pointId: s.punto_atencion_id,
        monedaId: s.moneda_id,
      });
      continue;
    }

    if (cantidad < -0.01 || billetes < -0.01 || monedas < -0.01 || bancos < -0.01) {
      c.error("SALDO_NEG", "Saldo tiene componentes negativos", {
        saldoId: s.id,
        pointId: s.punto_atencion_id,
        monedaId: s.moneda_id,
        cantidad,
        billetes,
        monedas,
        bancos,
      });
    }

    // Semántica del sistema: `cantidad` representa EFECTIVO (CAJA) y `bancos` es un bolsillo separado.
    const efectivoSum = billetes + monedas;
    const breakdownIsUnused = Math.abs(billetes) < 0.005 && Math.abs(monedas) < 0.005;

    if (!approxEqual(cantidad, efectivoSum, 0.02)) {
      const code = "SALDO_EFECTIVO_BREAKDOWN_MISMATCH";
      const msg = "Saldo.cantidad (efectivo) no coincide con billetes+monedas_fisicas";
      const ctx = {
        saldoId: s.id,
        pointId: s.punto_atencion_id,
        monedaId: s.moneda_id,
        cantidad,
        efectivoSum,
        bancos,
      };

      // Si el desglose físico está en 0, muchos históricos no lo mantienen: advertimos en vez de fallar.
      if (breakdownIsUnused) c.warn(code, msg, ctx);
      else c.error(code, msg, ctx);
    }
  }

  // ServicioExternoSaldo
  const seSaldos = await prisma.servicioExternoSaldo.findMany({
    where: pointId ? { punto_atencion_id: pointId } : undefined,
    select: {
      id: true,
      punto_atencion_id: true,
      servicio: true,
      moneda_id: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
      bancos: true,
      updated_at: true,
    },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const s of seSaldos) {
    const cantidad = toNumber(s.cantidad);
    const billetes = toNumber(s.billetes);
    const monedas = toNumber(s.monedas_fisicas);
    const bancos = toNumber(s.bancos);

    if (![cantidad, billetes, monedas, bancos].every(Number.isFinite)) {
      c.error("SE_SALDO_NAN", "ServicioExternoSaldo contiene valores no numéricos", {
        seSaldoId: s.id,
        pointId: s.punto_atencion_id,
        servicio: s.servicio,
        monedaId: s.moneda_id,
      });
      continue;
    }

    // En ServicioExternoSaldo `cantidad` representa el TOTAL asignado/consumido (incluye bancos).
    const totalSum = billetes + monedas + bancos;
    const breakdownIsUnused =
      Math.abs(billetes) < 0.005 && Math.abs(monedas) < 0.005 && Math.abs(bancos) < 0.005;

    if (!approxEqual(cantidad, totalSum, 0.02)) {
      const code = "SE_SALDO_SUM_MISMATCH";
      const msg = "ServicioExternoSaldo.cantidad no coincide con billetes+monedas_fisicas+bancos";
      const ctx = {
        seSaldoId: s.id,
        pointId: s.punto_atencion_id,
        servicio: s.servicio,
        monedaId: s.moneda_id,
        cantidad,
        totalSum,
      };

      if (breakdownIsUnused) c.warn(code, msg, ctx);
      else c.error(code, msg, ctx);
    }

    if (cantidad < -0.01 || billetes < -0.01 || monedas < -0.01 || bancos < -0.01) {
      c.error("SE_SALDO_NEG", "ServicioExternoSaldo tiene componentes negativos", {
        seSaldoId: s.id,
        pointId: s.punto_atencion_id,
        servicio: s.servicio,
        monedaId: s.moneda_id,
        cantidad,
        billetes,
        monedas,
        bancos,
      });
    }
  }

  // ServientregaSaldo
  const svSaldos = await prisma.servientregaSaldo.findMany({
    where: pointId ? { punto_atencion_id: pointId } : undefined,
    select: {
      id: true,
      punto_atencion_id: true,
      monto_total: true,
      monto_usado: true,
      billetes: true,
      monedas_fisicas: true,
      updated_at: true,
    },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const s of svSaldos) {
    const total = toNumber(s.monto_total);
    const usado = toNumber(s.monto_usado);
    const billetes = toNumber(s.billetes);
    const monedas = toNumber(s.monedas_fisicas);

    if (![total, usado, billetes, monedas].every(Number.isFinite)) {
      c.error("SV_SALDO_NAN", "ServientregaSaldo contiene valores no numéricos", {
        servientregaSaldoId: s.id,
        pointId: s.punto_atencion_id,
      });
      continue;
    }

    if (total < -0.01 || usado < -0.01 || billetes < -0.01 || monedas < -0.01) {
      c.error("SV_SALDO_NEG", "ServientregaSaldo tiene valores negativos", {
        servientregaSaldoId: s.id,
        pointId: s.punto_atencion_id,
        total,
        usado,
        billetes,
        monedas,
      });
    }

    if (usado - total > 0.01) {
      c.error("SV_SALDO_USADO_GT_TOTAL", "ServientregaSaldo.monto_usado excede monto_total", {
        servientregaSaldoId: s.id,
        pointId: s.punto_atencion_id,
        total,
        usado,
      });
    }

    const sum = billetes + monedas;
    if (!approxEqual(total, sum, 0.02)) {
      c.warn("SV_SALDO_SUM_MISMATCH", "ServientregaSaldo.monto_total no coincide con billetes+monedas_fisicas", {
        servientregaSaldoId: s.id,
        pointId: s.punto_atencion_id,
        total,
        sum,
      });
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-saldos:", e);
  process.exitCode = 1;
});
