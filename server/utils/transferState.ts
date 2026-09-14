import type { Prisma } from "../lib/prisma.js";

export class TransferStateConflict extends Error {
  constructor() {
    super("La transferencia ya fue resuelta por otra solicitud. Actualiza el listado.");
    this.name = "TransferStateConflict";
  }
}

// The conditional write locks the row until the caller's transaction ends.
// A competing resolver rechecks EN_TRANSITO after waiting for that lock.
export async function claimTransferInTransit(
  tx: Prisma.TransactionClient,
  id: string,
  estado: "COMPLETADO" | "CANCELADO"
) {
  const result = await tx.transferencia.updateMany({
    where: { id, estado: "EN_TRANSITO" },
    data: { estado },
  });
  if (result.count !== 1) throw new TransferStateConflict();
}
