import prisma from "../lib/prisma.js";

async function checkAPIResponse() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    console.log(`📍 Punto encontrado: ${punto.nombre} (ID: ${punto.id})`);

    // Simular lo que hace el API endpoint
    const saldos = await prisma.saldo.findMany({
      where: { punto_atencion_id: punto.id },
      include: {
        moneda: {
          select: { id: true, codigo: true, nombre: true, simbolo: true },
        },
      },
      orderBy: { moneda: { codigo: "asc" } },
    });

    console.log("\n💰 Respuesta del API (simulada):");
    const payload = saldos.map((s) => ({
      moneda_id: s.moneda_id,
      moneda_codigo: s.moneda?.codigo ?? null,
      moneda_nombre: s.moneda?.nombre ?? null,
      moneda_simbolo: s.moneda?.simbolo ?? null,
      saldo: parseFloat(s.cantidad.toString()),
    }));

    console.log(JSON.stringify(payload, null, 2));

    // Buscar específicamente USD
    const usdSaldo = payload.find((s) => s.moneda_codigo === "USD");
    if (usdSaldo) {
      console.log(`\n💵 USD Balance: $${usdSaldo.saldo}`);
    }

    // Verificar el valor raw en la BD
    const usdMoneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (usdMoneda) {
      const saldoRaw = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: usdMoneda.id,
          },
        },
      });

      console.log("\n🔍 Valor RAW en BD:");
      console.log("   cantidad:", saldoRaw?.cantidad);
      console.log("   billetes:", saldoRaw?.billetes);
      console.log("   monedas_fisicas:", saldoRaw?.monedas_fisicas);
      console.log("   bancos:", saldoRaw?.bancos);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPIResponse();
