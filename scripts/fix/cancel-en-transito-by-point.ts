import "dotenv/config";
import { EstadoTransferencia, Prisma, PrismaClient } from "@prisma/client";
import {
  getArgValueWithEnvFallback,
  hasFlag,
  parseIntArg,
} from "../validate/_shared.js";

function mustGetPointId(): string {
  const pointId = getArgValueWithEnvFallback("--point") || getArgValueWithEnvFallback("--pointId");
  if (!pointId) {
    console.error(
      "Uso: npx tsx scripts/fix/cancel-en-transito-by-point.ts --point <punto_atencion_id> [--days 30] [--limit 200] [--obs \"...\"] [--execute]"
    );
    process.exitCode = 1;
    throw new Error("Falta --point");
  }
  return pointId;
}

function money(n: number) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function cancelOne(
  tx: Prisma.TransactionClient,
  args: {
    transferId: string;
    monto: number;
    monedaId: string;
    via: string | null;
    origenId: string | null;
    usuarioId: string;
    observaciones: string;
  }
) {
  await tx.transferencia.update({
    where: { id: args.transferId },
    data: {
      estado: EstadoTransferencia.CANCELADO,
      fecha_rechazo: new Date(),
      observaciones_rechazo: args.observaciones,
    },
  });

  if (!args.origenId) {
    return;
  }

  const saldo = await tx.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: args.origenId,
        moneda_id: args.monedaId,
      },
    },
  });

  const saldoAnterior = saldo ? Number(saldo.cantidad) : 0;
  const billetesAnterior = saldo ? Number(saldo.billetes) : 0;
  const monedasAnterior = saldo ? Number(saldo.monedas_fisicas) : 0;

  let billetesDevolucion = 0;
  const monedasDevolucion = 0;

  if (args.via === "EFECTIVO" || args.via === "MIXTO") {
    billetesDevolucion = args.monto;
  }

  const saldoNuevo = saldoAnterior + args.monto;
  const billetesNuevo = billetesAnterior + billetesDevolucion;
  const monedasNuevo = monedasAnterior + monedasDevolucion;

  await tx.saldo.upsert({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: args.origenId,
        moneda_id: args.monedaId,
      },
    },
    update: {
      cantidad: saldoNuevo,
      billetes: billetesNuevo,
      monedas_fisicas: monedasNuevo,
      updated_at: new Date(),
    },
    create: {
      punto_atencion_id: args.origenId,
      moneda_id: args.monedaId,
      cantidad: saldoNuevo,
      billetes: billetesNuevo,
      monedas_fisicas: monedasNuevo,
    },
  });

  await tx.movimientoSaldo.create({
    data: {
      punto_atencion_id: args.origenId,
      moneda_id: args.monedaId,
      tipo_movimiento: "TRANSFERENCIA_DEVOLUCION",
      monto: args.monto, // ingreso
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      usuario_id: args.usuarioId,
      referencia_id: args.transferId,
      tipo_referencia: "TRANSFERENCIA",
      descripcion: `Devolución por cancelación de transferencia EN_TRANSITO (script) - ${args.observaciones}`,
    },
  });
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const pointId = mustGetPointId();
    const days = parseIntArg(getArgValueWithEnvFallback("--days")) ?? 30;
    const limit = parseIntArg(getArgValueWithEnvFallback("--limit")) ?? 200;
    const execute =
      hasFlag("--execute") ||
      process.env.npm_config_execute === "true" ||
      process.env.npm_config_execute === "1";

    const obs =
      getArgValueWithEnvFallback("--obs") ||
      "Cancelada para reintento de operación";

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const point = await prisma.puntoAtencion.findUnique({
      where: { id: pointId },
      select: { id: true, nombre: true },
    });

    console.log(
      `${execute ? "EXECUTE" : "DRY-RUN"}: buscar EN_TRANSITO para punto ${point?.nombre || "(desconocido)"} (${pointId}), days=${days}, limit=${limit}`
    );

    const transfers = await prisma.transferencia.findMany({
      where: {
        estado: EstadoTransferencia.EN_TRANSITO,
        fecha: { gte: cutoff },
        OR: [{ origen_id: pointId }, { destino_id: pointId }],
      },
      select: {
        id: true,
        numero_recibo: true,
        origen_id: true,
        destino_id: true,
        moneda_id: true,
        monto: true,
        via: true,
        solicitado_por: true,
        fecha: true,
      },
      orderBy: { fecha: "desc" },
      take: limit,
    });

    if (transfers.length === 0) {
      console.log("OK: no hay transferencias EN_TRANSITO en el rango.");
      return;
    }

    console.log(`Encontradas: ${transfers.length}`);
    for (const t of transfers) {
      const monto = Number(t.monto);
      console.log(
        `- ${t.numero_recibo || "(sin recibo)"} id=${t.id} monto=${money(
          monto
        )} via=${t.via || "?"} origen=${t.origen_id || "(null)"} destino=${t.destino_id} fecha=${t.fecha.toISOString()}`
      );
    }

    if (!execute) {
      console.log("DRY-RUN: sin cambios. Usa --execute para cancelar.");
      return;
    }

    for (const t of transfers) {
      const monto = Number(t.monto);
      const usuarioId = t.solicitado_por;

      // eslint-disable-next-line no-await-in-loop
      await prisma.$transaction(async (tx) => {
        await cancelOne(tx, {
          transferId: t.id,
          monto,
          monedaId: t.moneda_id,
          via: t.via,
          origenId: t.origen_id,
          usuarioId,
          observaciones: obs,
        });
      });

      console.log(
        `OK: cancelada ${t.numero_recibo || t.id} (devolución a origen=${t.origen_id || "(null)"})`
      );
    }

    console.log("OK: cancelación completada.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Fallo cancel-en-transito-by-point:", e);
  process.exitCode = 1;
});
