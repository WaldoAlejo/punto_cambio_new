import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { approxEqual, makeCollector, pickRangeFromArgs, printResult, toNumber } from "./_shared.js";

const POSITIVE_TYPES = new Set([
  "INGRESO",
  "SALDO_INICIAL",
  "TRANSFERENCIA_ENTRANTE",
  "TRANSFERENCIA_ENTRADA",
  "TRANSFERENCIA_DEVOLUCION",
]);

const NEGATIVE_TYPES = new Set([
  "EGRESO",
  "TRANSFERENCIA_SALIENTE",
  "TRANSFERENCIA_SALIDA",
]);

const AJUSTE_TYPES = new Set(["AJUSTE"]);

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:movimiento-saldo");

  const { from, to, pointId, limit } = pickRangeFromArgs();

  const where: Record<string, unknown> = {};
  if (pointId) where.punto_atencion_id = pointId;
  if (from || to) {
    where.fecha = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const rows = await prisma.movimientoSaldo.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      tipo_movimiento: true,
      monto: true,
      saldo_anterior: true,
      saldo_nuevo: true,
      tipo_referencia: true,
      referencia_id: true,
      fecha: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const m of rows) {
    const monto = toNumber(m.monto);
    const anterior = toNumber(m.saldo_anterior);
    const nuevo = toNumber(m.saldo_nuevo);

    if (![monto, anterior, nuevo].every(Number.isFinite)) {
      c.error("MOVSALDO_NAN", "MovimientoSaldo contiene valores no numéricos", {
        id: m.id,
        tipo: m.tipo_movimiento,
        referencia: m.tipo_referencia,
      });
      continue;
    }

    const delta = nuevo - anterior;

    // En `MovimientoSaldo`, `monto` debe estar firmado (egreso negativo, ingreso positivo).
    const absMonto = Math.abs(monto);
    const expectedMonto = POSITIVE_TYPES.has(m.tipo_movimiento)
      ? absMonto
      : NEGATIVE_TYPES.has(m.tipo_movimiento)
        ? -absMonto
        : AJUSTE_TYPES.has(m.tipo_movimiento)
          ? monto
          : monto;

    if (POSITIVE_TYPES.has(m.tipo_movimiento) && monto < -0.001) {
      c.error("MOVSALDO_SIGN", "Tipo de movimiento de ingreso con monto negativo", {
        id: m.id,
        tipo: m.tipo_movimiento,
        monto,
      });
    }
    if (NEGATIVE_TYPES.has(m.tipo_movimiento) && monto > 0.001) {
      // Esto suele indicar que el movimiento se registró sin pasar por el servicio central.
      c.error("MOVSALDO_SIGN", "Tipo de movimiento de egreso con monto positivo (debería ser negativo)", {
        id: m.id,
        tipo: m.tipo_movimiento,
        monto,
      });
    }

    if (!approxEqual(delta, monto, 0.02)) {
      // Caso común: `delta` cuadra con el monto esperado por tipo, pero el monto en BD tiene el signo invertido.
      if ((POSITIVE_TYPES.has(m.tipo_movimiento) || NEGATIVE_TYPES.has(m.tipo_movimiento)) && approxEqual(delta, expectedMonto, 0.02)) {
        c.error(
          "MOVSALDO_DELTA_MATCHES_EXPECTED_SIGN",
          "El delta cuadra con el signo esperado, pero el monto en BD parece tener el signo incorrecto",
          {
            id: m.id,
            tipo: m.tipo_movimiento,
            delta,
            monto,
            expectedMonto,
            referencia: m.tipo_referencia,
            referencia_id: m.referencia_id,
          }
        );
      } else {
        c.error("MOVSALDO_DELTA_MISMATCH", "saldo_nuevo - saldo_anterior no coincide con monto", {
          id: m.id,
          tipo: m.tipo_movimiento,
          delta,
          monto,
          expectedMonto,
          referencia: m.tipo_referencia,
          referencia_id: m.referencia_id,
        });
      }
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-movimiento-saldo:", e);
  process.exitCode = 1;
});
