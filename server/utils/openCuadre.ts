import prisma, { type Prisma } from "../lib/prisma.js";

export class CuadreStateConflict extends Error {}

export async function writeOpenDetail<T>(id: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ estado: string }>>`
      SELECT estado FROM "CuadreCaja" WHERE id = ${id} FOR UPDATE`;
    if (rows[0]?.estado !== 'ABIERTO') {
      throw new CuadreStateConflict('El cuadre cambió de estado. Actualiza la pantalla para ver el cierre guardado.');
    }
    return write(tx);
  });
}
