import prisma from "../server/lib/prisma";

async function main() {
  // Saldos generales
  const saldos = await prisma.saldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
    },
  });
  console.log("Saldos generales:", saldos);

  // Saldos Servientrega
  const servientrega = await prisma.servientregaSaldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      monto_total: true,
      monto_usado: true,
      billetes: true,
      monedas_fisicas: true,
    },
  });
  console.log("Saldos Servientrega:", servientrega);

  // Saldos servicios externos
  const externos = await prisma.servicioExternoSaldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      servicio: true,
      moneda_id: true,
      cantidad: true,
      billetes: true,
      monedas_fisicas: true,
    },
  });
  console.log("Saldos Servicios Externos:", externos);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
