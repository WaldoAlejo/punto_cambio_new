import prisma from "../lib/prisma.js";

// Zero rows created from the global catalog do not establish activity at a point.
export async function openingPointCurrencyIds(pointId: string): Promise<string[]> {
  const currencies = await prisma.moneda.findMany({
    where: { OR: [
      { saldos: { some: { punto_atencion_id: pointId, OR: [
        { cantidad: { not: 0 } }, { billetes: { not: 0 } }, { monedas_fisicas: { not: 0 } }, { bancos: { not: 0 } },
      ] } } },
      { movimientosSaldo: { some: { punto_atencion_id: pointId, monto: { not: 0 } } } },
      { saldosIniciales: { some: { punto_atencion_id: pointId, cantidad_inicial: { not: 0 } } } },
      { cambiosOrigen: { some: { punto_atencion_id: pointId } } },
      { cambiosDestino: { some: { punto_atencion_id: pointId } } },
      { transferencias: { some: { OR: [{ origen_id: pointId }, { destino_id: pointId }] } } },
    ] }, select: { id: true },
  });
  return currencies.map(currency => currency.id);
}
