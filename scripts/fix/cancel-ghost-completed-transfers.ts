import "dotenv/config";
import { EstadoTransferencia } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import {
  getArgValueWithEnvFallback,
  hasFlag,
  parseIntArg,
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

  const id = getArgValueWithEnvFallback("--id");
  const days = parseIntArg(getArgValueWithEnvFallback("--days")) ?? 2;

  const execute =
    hasFlag("--execute") ||
    process.env.npm_config_execute === "true" ||
    process.env.npm_config_execute === "1";

  if (!id) {
    console.error("Uso: --id <transferId> [--days 2] [--execute]");
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const t = await prisma.transferencia.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      fecha: true,
      origen_id: true,
      destino_id: true,
      moneda_id: true,
      monto: true,
      fecha_envio: true,
      fecha_aceptacion: true,
      aceptado_por: true,
    },
  });

  if (!t) {
    console.error("Transferencia no encontrada:", id);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  if (t.estado !== EstadoTransferencia.COMPLETADO) {
    console.log(`SKIP: transferencia ${id} no está COMPLETADO (estado=${t.estado}).`);
    await prisma.$disconnect();
    return;
  }

  const reciboCount = await prisma.recibo.count({
    where: { tipo_operacion: "TRANSFERENCIA", referencia_id: t.id },
  });
  if (reciboCount > 0) {
    console.log(`SKIP: transferencia ${id} tiene Recibo asociado (${reciboCount}).`);
    await prisma.$disconnect();
    return;
  }

  const directMovCount = await prisma.movimientoSaldo.count({
    where: { referencia_id: t.id, tipo_referencia: "TRANSFERENCIA" },
  });

  const from = new Date(t.fecha);
  from.setDate(from.getDate() - days);
  const to = new Date(t.fecha);
  to.setDate(to.getDate() + days);

  const pointIds = [t.origen_id, t.destino_id].filter(Boolean) as string[];
  const montoStr = Number(t.monto).toFixed(2);
  const montoNegStr = (-Number(montoStr)).toFixed(2);

  const anyCandidate = await prisma.movimientoSaldo.count({
    where: {
      moneda_id: t.moneda_id,
      ...(pointIds.length ? { punto_atencion_id: { in: pointIds } } : {}),
      fecha: { gte: from, lte: to },
      tipo_movimiento: { in: TRANSFER_TIPOS },
      OR: [{ monto: montoStr }, { monto: montoNegStr }],
    },
  });

  if (directMovCount > 0 || anyCandidate > 0) {
    console.log(
      `SKIP: transferencia ${id} parece tener evidencia de ledger (direct=${directMovCount}, candidates=${anyCandidate}).`
    );
    await prisma.$disconnect();
    return;
  }

  console.log(
    `DRY-RUN: cancelaría transferencia COMPLETADO sin ledger: ${id} (days=${days}). Usa --execute para aplicar.`
  );

  if (execute) {
    await prisma.transferencia.update({
      where: { id },
      data: {
        estado: EstadoTransferencia.CANCELADO,
        fecha_aceptacion: null,
        aceptado_por: null,
      },
    });
    console.log(`OK: transferencia ${id} marcada como CANCELADO.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fallo cancel-ghost-completed-transfers:", e);
  process.exitCode = 1;
});
