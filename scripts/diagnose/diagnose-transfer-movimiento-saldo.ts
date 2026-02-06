import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getArgValueWithEnvFallback, parseIntArg } from "../validate/_shared.js";

const TRANSFER_TIPOS = [
  "TRANSFERENCIA_SALIENTE",
  "TRANSFERENCIA_SALIDA",
  "TRANSFERENCIA_ENTRANTE",
  "TRANSFERENCIA_ENTRADA",
  "TRANSFERENCIA_DEVOLUCION",
];

async function main() {
  const prisma = new PrismaClient();
  const id = getArgValueWithEnvFallback("--id");
  const days = parseIntArg(getArgValueWithEnvFallback("--days")) ?? 5;
  const limit = parseIntArg(getArgValueWithEnvFallback("--limit")) ?? 200;

  if (!id) {
    console.error("Uso: --id <transferId> [--days 5] [--limit 200]");
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const t = await prisma.transferencia.findUnique({
    where: { id },
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
      aceptado_por: true,
      rechazado_por: true,
    },
  });

  if (!t) {
    console.error("Transferencia no encontrada:", id);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  console.log("TRANSFER:", {
    ...t,
    monto: Number(t.monto),
  });

  const from = new Date(t.fecha);
  from.setDate(from.getDate() - days);
  const to = new Date(t.fecha);
  to.setDate(to.getDate() + days);

  const token = (t.numero_recibo || "").trim();
  const pointIds = [t.origen_id, t.destino_id].filter(Boolean) as string[];

  const movs = await prisma.movimientoSaldo.findMany({
    where: {
      moneda_id: t.moneda_id,
      ...(pointIds.length ? { punto_atencion_id: { in: pointIds } } : {}),
      fecha: { gte: from, lte: to },
      ...(token
        ? {
            OR: [
              { descripcion: { contains: token, mode: "insensitive" } },
              { referencia_id: token },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      fecha: true,
      punto_atencion_id: true,
      tipo_movimiento: true,
      monto: true,
      saldo_anterior: true,
      saldo_nuevo: true,
      tipo_referencia: true,
      referencia_id: true,
      descripcion: true,
    },
    orderBy: { fecha: "asc" },
    take: limit,
  });

  console.log(`MOVIMIENTOS (match token en ±${days}d): ${movs.length}`);
  for (const m of movs) {
    console.log({
      id: m.id,
      fecha: m.fecha,
      punto_atencion_id: m.punto_atencion_id,
      tipo_movimiento: m.tipo_movimiento,
      monto: Number(m.monto),
      saldo_anterior: Number(m.saldo_anterior),
      saldo_nuevo: Number(m.saldo_nuevo),
      tipo_referencia: m.tipo_referencia,
      referencia_id: m.referencia_id,
      descripcion: m.descripcion,
    });
  }

  const montoStr = Number(t.monto).toFixed(2);
  const montoNegStr = (-Number(montoStr)).toFixed(2);

  const candidates = await prisma.movimientoSaldo.findMany({
    where: {
      moneda_id: t.moneda_id,
      ...(pointIds.length ? { punto_atencion_id: { in: pointIds } } : {}),
      fecha: { gte: from, lte: to },
      tipo_movimiento: { in: TRANSFER_TIPOS },
      OR: [{ monto: montoStr }, { monto: montoNegStr }],
    },
    select: {
      id: true,
      fecha: true,
      punto_atencion_id: true,
      tipo_movimiento: true,
      monto: true,
      saldo_anterior: true,
      saldo_nuevo: true,
      tipo_referencia: true,
      referencia_id: true,
      descripcion: true,
    },
    orderBy: { fecha: "asc" },
    take: limit,
  });

  console.log(`CANDIDATOS (tipo transferencia + monto ±${days}d): ${candidates.length}`);
  for (const m of candidates) {
    console.log({
      id: m.id,
      fecha: m.fecha,
      punto_atencion_id: m.punto_atencion_id,
      tipo_movimiento: m.tipo_movimiento,
      monto: Number(m.monto),
      saldo_anterior: Number(m.saldo_anterior),
      saldo_nuevo: Number(m.saldo_nuevo),
      tipo_referencia: m.tipo_referencia,
      referencia_id: m.referencia_id,
      descripcion: m.descripcion,
    });
  }

  const anyTipo = await prisma.movimientoSaldo.findMany({
    where: {
      moneda_id: t.moneda_id,
      ...(pointIds.length ? { punto_atencion_id: { in: pointIds } } : {}),
      fecha: { gte: from, lte: to },
      OR: [{ monto: montoStr }, { monto: montoNegStr }],
    },
    select: {
      id: true,
      fecha: true,
      punto_atencion_id: true,
      tipo_movimiento: true,
      monto: true,
      tipo_referencia: true,
      referencia_id: true,
      descripcion: true,
    },
    orderBy: { fecha: "asc" },
    take: limit,
  });

  console.log(`MATCH_MONTO_CUALQUIER_TIPO (±${days}d): ${anyTipo.length}`);
  for (const m of anyTipo) {
    console.log({
      id: m.id,
      fecha: m.fecha,
      punto_atencion_id: m.punto_atencion_id,
      tipo_movimiento: m.tipo_movimiento,
      monto: Number(m.monto),
      tipo_referencia: m.tipo_referencia,
      referencia_id: m.referencia_id,
      descripcion: m.descripcion,
    });
  }

  const directCount = await prisma.movimientoSaldo.count({
    where: { referencia_id: t.id, tipo_referencia: "TRANSFERENCIA" },
  });
  console.log("DIRECT_REF_COUNT:", directCount);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo diagnose-transfer-movimiento-saldo:", e);
  process.exitCode = 1;
});
