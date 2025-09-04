const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function updateCurrencyBehaviors() {
  try {
    console.log("🔄 Actualizando comportamientos de divisas...");

    // Configuraciones específicas según los ejemplos dados
    const currencyBehaviors = [
      {
        codigo: "EUR",
        comportamiento_compra: "MULTIPLICA",
        comportamiento_venta: "DIVIDE",
        descripcion: "Euro: compra multiplica, venta divide",
      },
      {
        codigo: "ARS",
        comportamiento_compra: "DIVIDE",
        comportamiento_venta: "MULTIPLICA",
        descripcion: "Peso Argentino: compra divide, venta multiplica",
      },
      {
        codigo: "AUD",
        comportamiento_compra: "MULTIPLICA",
        comportamiento_venta: "DIVIDE",
        descripcion: "Dólar Australiano: compra multiplica, venta divide",
      },
      {
        codigo: "USD",
        comportamiento_compra: "MULTIPLICA",
        comportamiento_venta: "DIVIDE",
        descripcion: "Dólar Americano: comportamiento estándar",
      },
      {
        codigo: "COP",
        comportamiento_compra: "MULTIPLICA",
        comportamiento_venta: "DIVIDE",
        descripcion: "Peso Colombiano: comportamiento estándar",
      },
    ];

    for (const config of currencyBehaviors) {
      const result = await prisma.moneda.updateMany({
        where: { codigo: config.codigo },
        data: {
          comportamiento_compra: config.comportamiento_compra,
          comportamiento_venta: config.comportamiento_venta,
        },
      });

      if (result.count > 0) {
        console.log(`✅ ${config.descripcion} - Actualizada`);
      } else {
        console.log(`⚠️  ${config.codigo} - No encontrada en la base de datos`);
      }
    }

    // Verificar todas las monedas existentes
    const allCurrencies = await prisma.moneda.findMany({
      select: {
        codigo: true,
        nombre: true,
        comportamiento_compra: true,
        comportamiento_venta: true,
      },
    });

    console.log("\n📊 Estado actual de todas las monedas:");
    allCurrencies.forEach((currency) => {
      console.log(
        `${currency.codigo} (${currency.nombre}): Compra ${currency.comportamiento_compra}, Venta ${currency.comportamiento_venta}`
      );
    });

    console.log("\n🎉 Actualización completada exitosamente!");
  } catch (error) {
    console.error("❌ Error al actualizar comportamientos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCurrencyBehaviors();
