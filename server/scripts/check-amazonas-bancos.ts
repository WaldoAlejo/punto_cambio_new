import prisma from "../lib/prisma.js";

async function checkAmazonasBancos() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    console.log(`📍 Punto: ${punto.nombre}`);

    // Buscar USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!usd) {
      console.log("❌ No se encontró USD");
      return;
    }

    // Obtener el saldo actual
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    console.log("\n💰 Saldo actual en BD:");
    console.log(
      "   Efectivo (cantidad):",
      Number(saldo?.cantidad || 0).toFixed(2)
    );
    console.log("   Billetes:", Number(saldo?.billetes || 0).toFixed(2));
    console.log(
      "   Monedas físicas:",
      Number(saldo?.monedas_fisicas || 0).toFixed(2)
    );
    console.log("   Bancos:", Number(saldo?.bancos || 0).toFixed(2));

    // Buscar movimientos con "banco" o "deposito" en la descripción
    const movimientosBanco = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        OR: [
          { descripcion: { contains: "banco", mode: "insensitive" } },
          { descripcion: { contains: "deposito", mode: "insensitive" } },
          { descripcion: { contains: "depósito", mode: "insensitive" } },
          { descripcion: { contains: "transferencia", mode: "insensitive" } },
        ],
      },
      orderBy: { fecha: "desc" },
      take: 20,
    });

    console.log(`\n🏦 Movimientos relacionados con bancos (últimos 20):`);
    console.log(`   Total encontrados: ${movimientosBanco.length}`);

    let totalDepositado = 0;
    movimientosBanco.forEach((m) => {
      const monto = Number(m.monto);
      const tipo = m.tipo || "UNKNOWN";
      console.log(
        `   ${m.fecha.toISOString().split("T")[0]} ${tipo.padEnd(15)} ${
          monto >= 0 ? "+" : ""
        }${monto.toFixed(2).padStart(10)} - ${
          m.descripcion || "Sin descripción"
        }`
      );
      if (tipo === "EGRESO" && monto < 0) {
        totalDepositado += Math.abs(monto);
      }
    });

    console.log(
      `\n💵 Total depositado en bancos: $${totalDepositado.toFixed(2)}`
    );
    console.log(`\n🧮 Cálculo esperado:`);
    console.log(
      `   Saldo sistema: $${Number(saldo?.cantidad || 0).toFixed(2)}`
    );
    console.log(`   - Depositado en bancos: $${totalDepositado.toFixed(2)}`);
    console.log(
      `   = Efectivo esperado: $${(
        Number(saldo?.cantidad || 0) - totalDepositado
      ).toFixed(2)}`
    );
    console.log(`\n   Efectivo contado: $79.17`);
    console.log(
      `   Diferencia: $${(
        Number(saldo?.cantidad || 0) -
        totalDepositado -
        79.17
      ).toFixed(2)}`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAmazonasBancos();
