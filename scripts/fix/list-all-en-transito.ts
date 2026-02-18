import "dotenv/config";
import { PrismaClient, EstadoTransferencia } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const transfers = await prisma.transferencia.findMany({
      where: { estado: EstadoTransferencia.EN_TRANSITO },
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
      take: 100,
    });
    if (transfers.length === 0) {
      console.log("No hay transferencias EN_TRANSITO.");
      return;
    }
    console.log(`Transferencias EN_TRANSITO encontradas: ${transfers.length}`);
    for (const t of transfers) {
      console.log(`- Recibo: ${t.numero_recibo || "(sin recibo)"} | id: ${t.id} | origen: ${t.origen_id} | destino: ${t.destino_id} | monto: ${t.monto} | via: ${t.via} | fecha: ${t.fecha.toISOString()}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error al listar EN_TRANSITO:", e);
  process.exitCode = 1;
});
