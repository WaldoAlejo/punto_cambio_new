import "dotenv/config";
import { EstadoTransferencia, PrismaClient } from "@prisma/client";
import {
  getArgValueWithEnvFallback,
  hasFlag,
  pickRangeFromArgs,
} from "../validate/_shared.js";

const TRANSFER_TIPOS = [
  "TRANSFERENCIA_SALIENTE",
  "TRANSFERENCIA_SALIDA",
  "TRANSFERENCIA_ENTRANTE",
  "TRANSFERENCIA_ENTRADA",
  "TRANSFERENCIA_DEVOLUCION",
];

async function main() {
  const prisma = new PrismaClient();
  const { from, to, pointId, limit } = pickRangeFromArgs();
  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";

  const id = getArgValueWithEnvFallback("--id");

  const baseWhere: Record<string, unknown> = {
    estado: EstadoTransferencia.COMPLETADO,
    ...(pointId ? { OR: [{ destino_id: pointId }, { origen_id: pointId }] } : {}),
    ...(from || to
      ? {
          fecha: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const transfers = id
    ? await prisma.transferencia.findMany({
        where: { ...baseWhere, id } as never,
        select: {
          id: true,
          fecha: true,
          numero_recibo: true,
          moneda_id: true,
          origen_id: true,
          destino_id: true,
          monto: true,
        },
        take: 1,
      })
    : await prisma.transferencia.findMany({
        where: baseWhere as never,
        select: {
          id: true,
          fecha: true,
          numero_recibo: true,
          moneda_id: true,
          origen_id: true,
          destino_id: true,
          monto: true,
        },
        orderBy: { fecha: "desc" },
        take: limit && limit > 0 ? limit : 5000,
      });

  let wouldLink = 0;
  let linked = 0;
  let noCandidate = 0;

  for (const t of transfers) {
    const already = await prisma.movimientoSaldo.count({
      where: { referencia_id: t.id, tipo_referencia: "TRANSFERENCIA" },
    });
    if (already > 0) continue;

    const token = (t.numero_recibo || "").trim();

    const fromDate = new Date(t.fecha);
    fromDate.setDate(fromDate.getDate() - 2);
    const toDate = new Date(t.fecha);
    toDate.setDate(toDate.getDate() + 2);

    const pointIds = [t.origen_id, t.destino_id].filter(Boolean) as string[];
    const montoNum = Number(t.monto);
    const montoStr = Number.isFinite(montoNum) ? montoNum.toFixed(2) : undefined;
    const montoNegStr =
      montoStr !== undefined ? (-Number(montoStr)).toFixed(2) : undefined;

    const byDescripcion = token
      ? await prisma.movimientoSaldo.findMany({
          where: {
            referencia_id: null,
            tipo_referencia: null,
            moneda_id: t.moneda_id,
            ...(pointIds.length ? { punto_atencion_id: { in: pointIds } } : {}),
            fecha: { gte: fromDate, lte: toDate },
            tipo_movimiento: { in: TRANSFER_TIPOS },
            descripcion: { contains: token, mode: "insensitive" },
          },
          select: { id: true },
          take: 20,
        })
      : [];

    const byMonto =
      montoStr && pointIds.length
        ? await prisma.movimientoSaldo.findMany({
            where: {
              referencia_id: null,
              tipo_referencia: null,
              moneda_id: t.moneda_id,
              punto_atencion_id: { in: pointIds },
              fecha: { gte: fromDate, lte: toDate },
              tipo_movimiento: { in: TRANSFER_TIPOS },
              OR: [{ monto: montoStr }, { monto: montoNegStr }],
            },
            select: { id: true },
            take: 20,
          })
        : [];

    const merged = new Map<string, { id: string }>();
    for (const c of [...byDescripcion, ...byMonto]) merged.set(c.id, c);
    const candidates = [...merged.values()];

    if (candidates.length === 0) {
      noCandidate++;
      continue;
    }

    wouldLink++;
    if (execute) {
      await prisma.movimientoSaldo.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { referencia_id: t.id, tipo_referencia: "TRANSFERENCIA" },
      });
      linked++;
    }
  }

  if (!execute) {
    console.log(
      `DRY-RUN: enlazaría MovimientoSaldo en ${wouldLink} transferencias (scan=${transfers.length}). Usa --execute para aplicar.`
    );
  } else {
    console.log(`OK: enlazadas ${linked}/${wouldLink} transferencias.`);
  }

  if (noCandidate > 0) {
    console.log(`INFO: ${noCandidate} transferencias sin candidatos para enlazar (revisar manual).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo link-transfer-movimientosaldo:", e);
  process.exitCode = 1;
});
