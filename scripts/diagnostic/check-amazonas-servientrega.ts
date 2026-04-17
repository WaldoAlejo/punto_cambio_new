import "dotenv/config";
import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const puntos = await prisma.puntoAtencion.findMany({
    where: {
      nombre: {
        contains: "AMAZONAS",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      nombre: true,
      ciudad: true,
      provincia: true,
      servientrega_agencia_codigo: true,
      servientrega_agencia_nombre: true,
    },
    orderBy: { nombre: "asc" },
  });

  const usd = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (!usd) {
    console.error("❌ No se encontró la moneda USD");
    return;
  }

  console.log("📍 Puntos Amazonas encontrados:");
  console.log(JSON.stringify(puntos, null, 2));

  for (const punto of puntos) {
    const saldo = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: punto.id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usd.id,
        },
      },
      select: {
        id: true,
        cantidad: true,
        billetes: true,
        monedas_fisicas: true,
        bancos: true,
        updated_at: true,
      },
    });

    const asignaciones = await prisma.servicioExternoAsignacion.findMany({
      where: {
        punto_atencion_id: punto.id,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usd.id,
      },
      select: {
        id: true,
        monto: true,
        tipo: true,
        fecha: true,
        observaciones: true,
        usuarioAsignador: {
          select: {
            nombre: true,
            username: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
      take: 10,
    });

    console.log("\n==============================");
    console.log(`Punto: ${punto.nombre}`);
    console.log("Saldo Servientrega:");
    console.log(
      JSON.stringify(
        saldo
          ? {
              ...saldo,
              cantidad: Number(saldo.cantidad),
              billetes: Number(saldo.billetes),
              monedas_fisicas: Number(saldo.monedas_fisicas),
              bancos: Number(saldo.bancos),
            }
          : null,
        null,
        2
      )
    );
    console.log("Últimas asignaciones:");
    console.log(
      JSON.stringify(
        asignaciones.map((item) => ({
          ...item,
          monto: Number(item.monto),
          asignado_por:
            item.usuarioAsignador?.nombre || item.usuarioAsignador?.username || "Sistema",
        })),
        null,
        2
      )
    );
  }
}

main()
  .catch((error) => {
    console.error("❌ Error revisando Amazonas Servientrega:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });