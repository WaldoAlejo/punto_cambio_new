import "dotenv/config";
import { EstadoTransferencia, PrismaClient } from "@prisma/client";
import { makeCollector, pickRangeFromArgs, printResult, toNumber } from "./_shared.js";

function isAfterOrEqual(a?: Date | null, b?: Date | null): boolean {
  if (!a || !b) return true;
  return a.getTime() >= b.getTime();
}

async function main() {
  const prisma = new PrismaClient();
  const c = makeCollector("validate:transfers");

  const { from, to, pointId, limit } = pickRangeFromArgs();

  const where: Record<string, unknown> = {};
  if (pointId) where.OR = [{ destino_id: pointId }, { origen_id: pointId }];
  if (from || to) {
    where.fecha = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const rows = await prisma.transferencia.findMany({
    where: Object.keys(where).length ? (where as never) : undefined,
    select: {
      id: true,
      fecha: true,
      estado: true,
      tipo_transferencia: true,
      origen_id: true,
      destino_id: true,
      moneda_id: true,
      monto: true,
      numero_recibo: true,
      fecha_aprobacion: true,
      fecha_envio: true,
      fecha_aceptacion: true,
      fecha_rechazo: true,
      solicitado_por: true,
      aprobado_por: true,
      rechazado_por: true,
      aceptado_por: true,
    },
    orderBy: { fecha: "desc" },
    take: limit && limit > 0 ? limit : undefined,
  });

  for (const t of rows) {
    const monto = toNumber(t.monto);
    if (!(monto > 0)) {
      c.error("TR_MONTO_INVALID", "Transferencia tiene monto no positivo", {
        id: t.id,
        monto,
        estado: t.estado,
      });
    }

    if (!t.destino_id) {
      c.error("TR_DESTINO_MISSING", "Transferencia sin destino_id", { id: t.id });
    }

    if (t.tipo_transferencia === "ENTRE_PUNTOS" && !t.origen_id) {
      c.error("TR_ORIGEN_MISSING", "Transferencia ENTRE_PUNTOS sin origen_id", {
        id: t.id,
      });
    }

    // Orden temporal básica
    if (!isAfterOrEqual(t.fecha_aprobacion, t.fecha)) {
      c.warn("TR_DATE_ORDER", "fecha_aprobacion es anterior a fecha", {
        id: t.id,
      });
    }
    if (!isAfterOrEqual(t.fecha_envio, t.fecha_aprobacion ?? t.fecha)) {
      c.warn("TR_DATE_ORDER", "fecha_envio es anterior a fecha_aprobacion/fecha", {
        id: t.id,
      });
    }
    if (!isAfterOrEqual(t.fecha_aceptacion, t.fecha_envio ?? t.fecha)) {
      c.warn("TR_DATE_ORDER", "fecha_aceptacion es anterior a fecha_envio/fecha", {
        id: t.id,
      });
    }

    // Reglas de estado (suaves)
    if (t.estado === EstadoTransferencia.EN_TRANSITO && !t.fecha_envio) {
      c.warn("TR_STATE_DATE", "Transferencia EN_TRANSITO sin fecha_envio", {
        id: t.id,
      });
    }
    if (t.estado === EstadoTransferencia.COMPLETADO) {
      if (!t.fecha_aceptacion) {
        c.warn("TR_STATE_DATE", "Transferencia COMPLETADO sin fecha_aceptacion", {
          id: t.id,
        });
      }
      if (!t.numero_recibo) {
        c.warn("TR_NO_RECIBO", "Transferencia COMPLETADO sin numero_recibo (posible histórico)", {
          id: t.id,
        });
      }
    }

    // Referencias MovimientoSaldo (si existe)
    // NOTA: esto no falla si no hay movimientos legacy, lo reporta como warning.
    const movCount = await prisma.movimientoSaldo.count({
      where: {
        referencia_id: t.id,
        tipo_referencia: "TRANSFERENCIA",
      },
    });

    if (movCount === 0 && t.estado === EstadoTransferencia.COMPLETADO) {
      // Fallback legacy: si existe Recibo, tolerar falta de MovimientoSaldo
      const reciboCount = await prisma.recibo.count({
        where: { tipo_operacion: "TRANSFERENCIA", referencia_id: t.id },
      });
      if (reciboCount === 0) {
        c.warn(
          "TR_NO_MOVSALDO",
          "Transferencia COMPLETADO sin MovimientoSaldo ni Recibo asociado",
          { id: t.id }
        );
      }
    }
  }

  const result = c.finish();
  printResult(result);
  await prisma.$disconnect();

  if (result.counts.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo validate-transfers:", e);
  process.exitCode = 1;
});
