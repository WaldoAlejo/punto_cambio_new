import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyzeSantaFeDetailed() {
  console.log("🔍 ANÁLISIS DETALLADO SANTA FE - DESDE 28 SEPTIEMBRE");
  console.log("=".repeat(80));

  try {
    // Obtener el punto de atención SANTA FE
    const puntoAtencion = await prisma.puntoAtencion.findFirst({
      where: { nombre: "SANTA FE" },
    });

    if (!puntoAtencion) {
      console.log("❌ No se encontró el punto SANTA FE");
      return;
    }

    console.log(`📍 Punto: ${puntoAtencion.nombre} (ID: ${puntoAtencion.id})`);
    console.log("");

    // Obtener la moneda USD
    const monedaUSD = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!monedaUSD) {
      console.log("❌ No se encontró la moneda USD");
      return;
    }

    // Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
        activo: true,
      },
    });

    console.log("💰 SALDO INICIAL:");
    console.log(`   USD: ${saldoInicial?.cantidad_inicial || 0}`);
    console.log("");

    // Obtener todos los movimientos desde el 28 de septiembre
    const movimientos = await prisma.movimiento.findMany({
      where: {
        punto_atencion_id: puntoAtencion.id,
        moneda_id: monedaUSD.id,
        fecha: {
          gte: new Date("2024-09-28T00:00:00.000Z"),
        },
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

    console.log(`📊 MOVIMIENTOS ENCONTRADOS: ${movimientos.length}`);
    console.log("");

    // Agrupar por día
    const movimientosPorDia = new Map<string, typeof movimientos>();

    movimientos.forEach((mov) => {
      const fecha = mov.fecha.toISOString().split("T")[0];
      if (!movimientosPorDia.has(fecha)) {
        movimientosPorDia.set(fecha, []);
      }
      movimientosPorDia.get(fecha)!.push(mov);
    });

    // Análisis día por día
    let saldoAcumulado = saldoInicial?.cantidad_inicial || 0;

    console.log("📅 ANÁLISIS DÍA POR DÍA:");
    console.log("=".repeat(80));

    for (const [fecha, movsDia] of Array.from(
      movimientosPorDia.entries()
    ).sort()) {
      console.log(`\n📆 ${fecha}`);
      console.log(`   Saldo inicial del día: ${saldoAcumulado.toFixed(2)} USD`);
      console.log("   Movimientos:");

      let ingresosDia = 0;
      let egresosDia = 0;

      movsDia.forEach((mov, index) => {
        const hora = mov.fecha.toTimeString().split(" ")[0];
        const signo = [
          "INGRESO",
          "TRANSFERENCIA_ENTRANTE",
          "SALDO_INICIAL",
        ].includes(mov.tipo)
          ? "+"
          : "-";
        const monto = Math.abs(mov.monto);

        if (signo === "+") {
          ingresosDia += monto;
          saldoAcumulado += monto;
        } else {
          egresosDia += monto;
          saldoAcumulado -= monto;
        }

        console.log(
          `   ${(index + 1)
            .toString()
            .padStart(2)}. [${hora}] ${signo}${monto.toFixed(
            2
          )} ${mov.tipo.padEnd(20)} | ${
            mov.descripcion || "Sin descripción"
          } | Usuario: ${
            mov.usuario?.nombre || "N/A"
          } | Saldo: ${saldoAcumulado.toFixed(2)}`
        );
      });

      console.log(
        `   ─────────────────────────────────────────────────────────────`
      );
      console.log(`   📈 Ingresos del día: +${ingresosDia.toFixed(2)} USD`);
      console.log(`   📉 Egresos del día:  -${egresosDia.toFixed(2)} USD`);
      console.log(`   💰 Saldo final día:  ${saldoAcumulado.toFixed(2)} USD`);
      console.log(
        `   📊 Movimiento neto:  ${(ingresosDia - egresosDia).toFixed(2)} USD`
      );
    }

    console.log("\n" + "=".repeat(80));
    console.log("📋 RESUMEN GENERAL:");

    // Calcular totales
    const totalIngresos = movimientos
      .filter((m) =>
        ["INGRESO", "TRANSFERENCIA_ENTRANTE", "SALDO_INICIAL"].includes(m.tipo)
      )
      .reduce((sum, m) => sum + Math.abs(m.monto), 0);

    const totalEgresos = movimientos
      .filter((m) =>
        ["EGRESO", "TRANSFERENCIA_SALIENTE", "CAMBIO_DIVISA"].includes(m.tipo)
      )
      .reduce((sum, m) => sum + Math.abs(m.monto), 0);

    console.log(
      `💰 Saldo inicial:     ${(saldoInicial?.cantidad_inicial || 0).toFixed(
        2
      )} USD`
    );
    console.log(`📈 Total ingresos:    +${totalIngresos.toFixed(2)} USD`);
    console.log(`📉 Total egresos:     -${totalEgresos.toFixed(2)} USD`);
    console.log(
      `🔄 Movimiento neto:   ${(totalIngresos - totalEgresos).toFixed(2)} USD`
    );
    console.log(
      `💳 Saldo final calc:  ${(
        (saldoInicial?.cantidad_inicial || 0) +
        totalIngresos -
        totalEgresos
      ).toFixed(2)} USD`
    );
    console.log(`💳 Saldo actual BD:   ${saldoAcumulado.toFixed(2)} USD`);

    // Verificar inconsistencias
    const saldoCalculado =
      (saldoInicial?.cantidad_inicial || 0) + totalIngresos - totalEgresos;
    const diferencia = Math.abs(saldoCalculado - saldoAcumulado);

    if (diferencia > 0.01) {
      console.log(`⚠️  INCONSISTENCIA DETECTADA: ${diferencia.toFixed(2)} USD`);
    } else {
      console.log(`✅ CÁLCULOS CONSISTENTES`);
    }

    // Identificar movimientos problemáticos
    console.log("\n🚨 MOVIMIENTOS CRÍTICOS:");
    const movimientosGrandes = movimientos.filter(
      (m) => Math.abs(m.monto) > 100
    );
    movimientosGrandes.forEach((mov) => {
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
        `   ${fecha} ${hora} | ${signo}${Math.abs(mov.monto).toFixed(2)} | ${
          mov.tipo
        } | ${mov.descripcion || "Sin descripción"}`
      );
    });
  } catch (error) {
    console.error("❌ Error en el análisis:", error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSantaFeDetailed().catch(console.error);
