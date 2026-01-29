import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Monedas que realmente se usan en el punto de cambio
const MONEDAS_ACTIVAS = [
  "USD", // Dólar estadounidense
  "EUR", // Euro
  "COP", // Peso colombiano
  "PEN", // Sol peruano
  "ARS", // Peso argentino
  "BRL", // Real brasileño
  "CAD", // Dólar canadiense
  "GBP", // Libra esterlina
  "CHF", // Franco suizo
  "MXN", // Peso mexicano
  "CLP", // Peso chileno
  "BOB", // Boliviano
  "VES", // Bolívar venezolano
];

async function optimizarMonedas() {
  try {
    console.log("🔧 Optimizando lista de monedas activas...\n");

    // 1. Desactivar TODAS las monedas primero
    const desactivadas = await prisma.moneda.updateMany({
      where: {
        activo: true,
      },
      data: {
        activo: false,
      },
    });

    console.log(`✅ ${desactivadas.count} monedas desactivadas`);

    // 2. Activar solo las monedas que se usan
    const activadas = await prisma.moneda.updateMany({
      where: {
        codigo: {
          in: MONEDAS_ACTIVAS,
        },
      },
      data: {
        activo: true,
      },
    });

    console.log(`✅ ${activadas.count} monedas activadas\n`);

    // 3. Mostrar las monedas activas
    const monedasActivas = await prisma.moneda.findMany({
      where: {
        activo: true,
      },
      orderBy: {
        orden_display: "asc",
      },
    });

    console.log("📋 Monedas activas:");
    monedasActivas.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ${m.codigo} - ${m.nombre} (${m.simbolo})`);
    });

    console.log("\n✅ Optimización completada");
  } catch (error) {
    console.error("❌ Error optimizando monedas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

optimizarMonedas();
