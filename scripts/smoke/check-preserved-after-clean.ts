import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const [usuarios, puntos, monedas, jornadas] = await Promise.all([
      prisma.usuario.count(),
      prisma.puntoAtencion.count(),
      prisma.moneda.count(),
      prisma.jornada.count(),
    ]);

    console.log("Preserved counts after seed:clean:");
    console.log({ usuarios, puntosAtencion: puntos, monedas, jornadas });

    const lastJornada = await prisma.jornada.findFirst({
      orderBy: [{ fecha_inicio: "desc" }, { id: "desc" }],
      select: {
        id: true,
        punto_atencion_id: true,
        usuario_id: true,
        estado: true,
        fecha_inicio: true,
        fecha_salida: true,
      },
    });

    console.log("Sample last Jornada:");
    console.log(lastJornada);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("SMOKE_PRESERVED_FAILED", e);
  process.exit(1);
});
