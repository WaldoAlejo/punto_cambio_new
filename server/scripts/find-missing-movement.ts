import prisma from "../lib/prisma.js";

async function findMissingMovement() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    // Buscar USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!usd) {
      console.log("❌ No se encontró USD");
      return;
    }

    console.log(
      `📍 Buscando movimientos entre 2025-10-06 23:00 y 2025-10-07 12:00\n`
    );

    // Buscar todos los movimientos en ese rango de tiempo
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        fecha: {
          gte: new Date("2025-10-06T23:00:00Z"),
          lte: new Date("2025-10-07T12:00:00Z"),
        },
      },
      orderBy: { fecha: "asc" },
    });

    console.log(`Movimientos encontrados: ${movimientos.length}\n`);

    movimientos.forEach((m) => {
      const monto = Number(m.monto);
      const saldoAnt = Number(m.saldo_anterior);
      const saldoNuevo = Number(m.saldo_nuevo);

      console.log(`${m.fecha.toISOString()}`);
      console.log(`  Tipo: ${m.tipo_movimiento}`);
      console.log(`  Monto: ${monto >= 0 ? "+" : ""}${monto.toFixed(2)}`);
      console.log(`  Saldo anterior: $${saldoAnt.toFixed(2)}`);
      console.log(`  Saldo nuevo: $${saldoNuevo.toFixed(2)}`);
      console.log(`  Descripción: ${m.descripcion || "Sin descripción"}`);
      console.log(`  ID: ${m.id}`);
      console.log("");
    });

    // Buscar TODOS los movimientos del 6 y 7 de octubre
    console.log("\n" + "=".repeat(80));
    console.log("📋 TODOS los movimientos del 6 y 7 de octubre:\n");

    const todosMovimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        fecha: {
          gte: new Date("2025-10-06T00:00:00Z"),
          lte: new Date("2025-10-07T23:59:59Z"),
        },
      },
      orderBy: { created_at: "asc" }, // Ordenar por fecha de creación, no por fecha del movimiento
    });

    console.log(`Total: ${todosMovimientos.length}\n`);

    let saldoAnteriorEsperado = null;
    todosMovimientos.forEach((m, index) => {
      const monto = Number(m.monto);
      const saldoAnt = Number(m.saldo_anterior);
      const saldoNuevo = Number(m.saldo_nuevo);

      const discrepancia =
        saldoAnteriorEsperado !== null &&
        Math.abs(saldoAnteriorEsperado - saldoAnt) > 0.01;

      console.log(
        `${index + 1}. ${m.fecha.toISOString()} ${
          discrepancia ? "⚠️  DISCREPANCIA" : ""
        }`
      );
      console.log(
        `   ${m.tipo_movimiento.padEnd(15)} ${monto >= 0 ? "+" : ""}${monto
          .toFixed(2)
          .padStart(10)}`
      );
      console.log(
        `   Saldo: $${saldoAnt.toFixed(2)} → $${saldoNuevo.toFixed(2)}`
      );
      if (discrepancia) {
        console.log(
          `   ❌ Se esperaba saldo anterior: $${saldoAnteriorEsperado?.toFixed(
            2
          )}`
        );
        console.log(
          `   ❌ Diferencia: $${(
            saldoAnt - (saldoAnteriorEsperado || 0)
          ).toFixed(2)}`
        );
      }
      console.log(`   ${m.descripcion || "Sin descripción"}`);
      console.log(`   Created: ${m.created_at.toISOString()}`);
      console.log("");

      saldoAnteriorEsperado = saldoNuevo;
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findMissingMovement();
