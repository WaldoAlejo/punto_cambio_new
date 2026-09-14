import type { Prisma } from "../lib/prisma.js";

export class OperationalConflict extends Error {}

// Call after acquiring balance locks, so a completed close cannot be missed
// merely because authentication ran before the transaction waited.
export async function assertOperationalSession(
  tx: Prisma.TransactionClient,
  user: { id: string; rol: string } | undefined,
  pointId: string
) {
  if (!user || !["OPERADOR", "CONCESION"].includes(user.rol)) return;
  const current = await tx.usuario.findUnique({ where: { id: user.id }, select: { punto_atencion_id: true } });
  const jornada = await tx.jornada.findFirst({ where: {
    usuario_id: user.id, punto_atencion_id: pointId,
    estado: { in: ["ACTIVO", "ALMUERZO"] }, fecha_salida: null,
  }, select: { id: true } });
  if (current?.punto_atencion_id !== pointId || !jornada) {
    throw new OperationalConflict("La jornada o el punto asignado cambió mientras se procesaba la solicitud. Actualiza la pantalla.");
  }
}
