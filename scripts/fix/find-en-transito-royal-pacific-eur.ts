import "dotenv/config";
import { PrismaClient, EstadoTransferencia } from "@prisma/client";

const ROYAL_PACIFIC_ID = "fa75bb3a-e881-471a-b558-749b0f0de0ff"; // Actualiza si es necesario
const EUR_ID = "EUR"; // Actualiza si el id de moneda es diferente
const MONTO = 8000;

async function main() {
  const prisma = new PrismaClient();
  try {
    const transfers = await prisma.transferencia.findMany({
      where: {
        estado: EstadoTransferencia.EN_TRANSITO,
        origen_id: ROYAL_PACIFIC_ID,
        moneda_id: EUR_ID,
        monto: MONTO,
      },
      select: {
        id: true,
        numero_recibo: true,
        origen_id: true,
        destino_id: true,
        monto: true,
        moneda_id: true,
        via: true,
        fecha: true,
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });
    if (transfers.length === 0) {
      console.log("No hay transferencias EN_TRANSITO de 8000 EUR realizadas por Royal Pacific.");
      return;
    }
    console.log(`Transferencias EN_TRANSITO de 8000 EUR encontradas: ${transfers.length}`);
    for (const t of transfers) {
      console.log(`- Recibo: ${t.numero_recibo || "(sin recibo)"} | id: ${t.id} | origen: ${t.origen_id} | destino: ${t.destino_id} | monto: ${t.monto} | via: ${t.via} | fecha: ${t.fecha.toISOString()}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error al buscar EN_TRANSITO Royal Pacific EUR:", e);
  process.exitCode = 1;
});
