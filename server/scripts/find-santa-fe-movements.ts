import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findSantaFeMovements() {
  console.log("🔍 BÚSQUEDA DE MOVIMIENTOS SANTA FE");
  console.log("=".repeat(50));

  try {
    // Obtener el punto de atención SANTA FE
    const puntoAtencion = await prisma.puntoAtencion.findFirst({
      where: { nombre: "SANTA FE" },
    });

    if (!puntoAtencion) {
      console.log("❌ No se encontró el punto SANTA FE");
      return;
    }

    // Obtener la moneda USD
    const monedaUSD = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!monedaUSD) {
      console.log("❌ No se encontró la moneda USD");
      return;
    }

    console.log(`📍 Punto: ${puntoAtencion.nombre} (ID: ${puntoAtencion.id})`);
    console.log(`💰 Moneda: ${monedaUSD.codigo} (ID: ${monedaUSD.id})`);
    console.log("");

    // Buscar el primer y último movimiento
    const primerMovimiento = await prisma.movimiento.findFirst({
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
      },
      orderBy: {
        fecha: "asc",
      },
    });

    const ultimoMovimiento = await prisma.movimiento.findFirst({
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    if (!primerMovimiento) {
      console.log("❌ No se encontraron movimientos para SANTA FE USD");
      return;
    }

    console.log("📅 RANGO DE MOVIMIENTOS:");
    console.log(
      `   Primer movimiento: ${primerMovimiento.fecha.toISOString()}`
    );
    console.log(
      `   Último movimiento: ${ultimoMovimiento?.fecha.toISOString()}`
    );
    console.log("");

    // Contar movimientos por mes
    const movimientosPorMes = await prisma.movimiento.groupBy({
      by: ["fecha"],
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
      },
      _count: {
        id: true,
      },
    });

    // Agrupar por mes
    const conteoMeses = new Map<string, number>();
    movimientosPorMes.forEach((mov) => {
      const mes = mov.fecha.toISOString().substring(0, 7); // YYYY-MM
      conteoMeses.set(mes, (conteoMeses.get(mes) || 0) + mov._count.id);
    });

    console.log("📊 MOVIMIENTOS POR MES:");
    Array.from(conteoMeses.entries())
      .sort()
      .forEach(([mes, cantidad]) => {
        console.log(`   ${mes}: ${cantidad} movimientos`);
      });

    console.log("");

    // Obtener todos los movimientos para análisis completo
    const todosMovimientos = await prisma.movimiento.findMany({
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
      },
      orderBy: {
        fecha: "asc",
      },
      include: {
        usuario: {
          select: { nombre: true },
        },
      },
    });

    console.log(`📋 TOTAL MOVIMIENTOS: ${todosMovimientos.length}`);
    console.log("");

    // Mostrar los primeros 10 movimientos
    console.log("🔝 PRIMEROS 10 MOVIMIENTOS:");
    todosMovimientos.slice(0, 10).forEach((mov, index) => {
      const fecha = mov.fecha.toISOString().split("T")[0];
      const hora = mov.fecha.toTimeString().split(" ")[0];
      const signo = [
        "INGRESO",
        "TRANSFERENCIA_ENTRANTE",
        "SALDO_INICIAL",
      ].includes(mov.tipo)
        ? "+"
        : "-";

      console.log(
        `   ${(index + 1)
          .toString()
          .padStart(2)}. ${fecha} ${hora} | ${signo}${Math.abs(
          mov.monto
        ).toFixed(2)} | ${mov.tipo.padEnd(20)} | ${
          mov.descripcion || "Sin descripción"
        }`
      );
    });

    console.log("");

    // Mostrar los últimos 10 movimientos
    console.log("🔚 ÚLTIMOS 10 MOVIMIENTOS:");
    todosMovimientos.slice(-10).forEach((mov, index) => {
      const fecha = mov.fecha.toISOString().split("T")[0];
      const hora = mov.fecha.toTimeString().split(" ")[0];
      const signo = [
        "INGRESO",
        "TRANSFERENCIA_ENTRANTE",
        "SALDO_INICIAL",
      ].includes(mov.tipo)
        ? "+"
        : "-";

      console.log(
        `   ${(index + 1)
          .toString()
          .padStart(2)}. ${fecha} ${hora} | ${signo}${Math.abs(
          mov.monto
        ).toFixed(2)} | ${mov.tipo.padEnd(20)} | ${
          mov.descripcion || "Sin descripción"
        }`
      );
    });
  } catch (error) {
    console.error("❌ Error en la búsqueda:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findSantaFeMovements().catch(console.error);
