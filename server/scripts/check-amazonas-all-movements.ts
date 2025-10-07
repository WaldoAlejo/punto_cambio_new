import prisma from "../lib/prisma.js";

async function checkAmazonasAllMovements() {
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

    // Obtener TODOS los movimientos
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
      orderBy: { fecha: "asc" },
    });

    console.log(`\n📋 Total de movimientos: ${movimientos.length}\n`);

    let saldoCalculado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;

    console.log(
      "FECHA       TIPO            MONTO      SALDO ANT  SALDO NUEVO  DESCRIPCIÓN"
    );
    console.log("=".repeat(100));

    movimientos.forEach((m) => {
      const monto = Number(m.monto);
      const saldoAnt = Number(m.saldo_anterior);
      const saldoNuevo = Number(m.saldo_nuevo);

      if (m.tipo_movimiento === "INGRESO") {
        totalIngresos += Math.abs(monto);
      } else if (m.tipo_movimiento === "EGRESO") {
        totalEgresos += Math.abs(monto);
      }

      console.log(
        `${m.fecha.toISOString().split("T")[0]} ${m.tipo_movimiento.padEnd(
          15
        )} ${monto >= 0 ? "+" : ""}${monto.toFixed(2).padStart(10)} ${saldoAnt
          .toFixed(2)
          .padStart(11)} ${saldoNuevo.toFixed(2).padStart(12)}  ${
          m.descripcion || "Sin descripción"
        }`
      );
    });

    // Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        activo: true,
      },
      orderBy: { fecha_asignacion: "desc" },
    });

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);

    console.log("\n" + "=".repeat(100));
    console.log(`\n📊 Resumen:`);
    console.log(`   Saldo inicial: $${inicial.toFixed(2)}`);
    console.log(`   + Total ingresos: $${totalIngresos.toFixed(2)}`);
    console.log(`   - Total egresos: $${totalEgresos.toFixed(2)}`);
    console.log(
      `   = Saldo calculado: $${(
        inicial +
        totalIngresos -
        totalEgresos
      ).toFixed(2)}`
    );

    const ultimoMovimiento = movimientos[movimientos.length - 1];
    if (ultimoMovimiento) {
      console.log(
        `\n   Último saldo_nuevo registrado: $${Number(
          ultimoMovimiento.saldo_nuevo
        ).toFixed(2)}`
      );
    }

    // Obtener saldo actual de la tabla Saldo
    const saldo = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    console.log(
      `   Saldo en tabla Saldo: $${Number(saldo?.cantidad || 0).toFixed(2)}`
    );
    console.log(`\n   💰 Efectivo físico contado: $79.17`);
    console.log(
      `   ❌ Faltante: $${(Number(saldo?.cantidad || 0) - 79.17).toFixed(2)}`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAmazonasAllMovements();
