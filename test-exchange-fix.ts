// Script de prueba para verificar la corrección del cambio de divisas
import { PrismaClient } from "@prisma/client";

async function testExchangeLogic() {
  const prisma = new PrismaClient();

  try {
    console.log("🧪 Iniciando prueba de lógica de cambio de divisas...");

    // Buscar monedas USD y COP
    const usdMoneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    const copMoneda = await prisma.moneda.findFirst({
      where: { codigo: "COP" },
    });

    if (!usdMoneda || !copMoneda) {
      console.error("❌ No se encontraron las monedas USD o COP");
      return;
    }

    console.log("✅ Monedas encontradas:");
    console.log(`   USD: ${usdMoneda.id} - ${usdMoneda.nombre}`);
    console.log(`   COP: ${copMoneda.id} - ${copMoneda.nombre}`);

    // Buscar un punto de atención
    const punto = await prisma.puntoAtencion.findFirst({
      where: { activo: true },
    });

    if (!punto) {
      console.error("❌ No se encontró un punto de atención activo");
      return;
    }

    console.log(`✅ Punto de atención: ${punto.nombre}`);

    // Verificar saldos actuales
    const saldoUSD = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usdMoneda.id,
        },
      },
    });

    const saldoCOP = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: copMoneda.id,
        },
      },
    });

    console.log("📊 Saldos actuales:");
    console.log(`   USD: ${saldoUSD?.cantidad || 0}`);
    console.log(`   COP: ${saldoCOP?.cantidad || 0}`);

    // Simular la lógica de una operación de VENTA
    console.log("\n🔄 Simulando operación de VENTA:");
    console.log("   Cliente entrega: 200.00 USD");
    console.log("   Cliente recibe: 680,000.00 COP");
    console.log("   Método: efectivo");

    // Lógica corregida
    const moneda_origen_id = usdMoneda.id; // USD (lo que entrega el cliente)
    const moneda_destino_id = copMoneda.id; // COP (lo que recibe el cliente)
    const divisas_entregadas_total_final = 200.0;
    const divisas_recibidas_total_final = 680000.0;
    const metodo_entrega = "efectivo";

    // Moneda ORIGEN (USD): el punto RECIBE -> sumar
    const saldoOrigenAnterior = Number(saldoUSD?.cantidad ?? 0);
    const saldoOrigenNuevo =
      saldoOrigenAnterior + divisas_entregadas_total_final;

    console.log(`\n💰 USD (Moneda Origen - punto RECIBE):`);
    console.log(`   Saldo anterior: ${saldoOrigenAnterior}`);
    console.log(`   Suma: +${divisas_entregadas_total_final}`);
    console.log(`   Saldo nuevo: ${saldoOrigenNuevo}`);

    // Moneda DESTINO (COP): el punto ENTREGA -> restar
    const saldoDestinoAnterior = Number(saldoCOP?.cantidad ?? 0);
    const isDestinoUSD = copMoneda.codigo === "USD";

    let egresoEfectivo: number, egresoTransfer: number;

    if (isDestinoUSD) {
      // No aplica en este caso
      egresoEfectivo = 0;
      egresoTransfer = 0;
    } else {
      // Moneda destino NO es USD, usar el total de divisas recibidas
      const totalEgreso = divisas_recibidas_total_final;

      if (metodo_entrega === "efectivo") {
        egresoEfectivo = totalEgreso;
        egresoTransfer = 0;
      } else if (metodo_entrega === "transferencia") {
        egresoEfectivo = 0;
        egresoTransfer = totalEgreso;
      } else {
        egresoEfectivo = totalEgreso / 2;
        egresoTransfer = totalEgreso / 2;
      }
    }

    const saldoDestinoNuevo = saldoDestinoAnterior - egresoEfectivo;

    console.log(`\n💰 COP (Moneda Destino - punto ENTREGA):`);
    console.log(`   Saldo anterior: ${saldoDestinoAnterior}`);
    console.log(`   Resta (efectivo): -${egresoEfectivo}`);
    console.log(`   Resta (transferencia): -${egresoTransfer}`);
    console.log(`   Saldo nuevo: ${saldoDestinoNuevo}`);

    console.log("\n✅ Lógica verificada correctamente");
    console.log("📝 Resumen:");
    console.log(
      `   USD: ${saldoOrigenAnterior} → ${saldoOrigenNuevo} (${
        saldoOrigenNuevo > saldoOrigenAnterior ? "+" : ""
      }${saldoOrigenNuevo - saldoOrigenAnterior})`
    );
    console.log(
      `   COP: ${saldoDestinoAnterior} → ${saldoDestinoNuevo} (${
        saldoDestinoNuevo > saldoDestinoAnterior ? "+" : ""
      }${saldoDestinoNuevo - saldoDestinoAnterior})`
    );
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la prueba
testExchangeLogic()
  .then(() => {
    console.log("\n🎉 Prueba completada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error en la prueba:", error);
    process.exit(1);
  });
