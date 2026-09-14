import type { Prisma } from "../lib/prisma.js";

export class InsufficientTransferBalance extends Error {}

// Serialize transfer balance calculations, including the first credit when no
// Saldo row exists yet. Both locks are released on commit or rollback.
export async function lockTransferBalance(
  tx: Prisma.TransactionClient,
  pointId: string,
  currencyId: string
) {
  const key = `transfer-balance:${pointId}:${currencyId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  await tx.$queryRaw`SELECT id FROM "Saldo"
    WHERE punto_atencion_id = ${pointId} AND moneda_id = ${currencyId}
    FOR NO KEY UPDATE`;
}
