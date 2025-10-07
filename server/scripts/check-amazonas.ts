import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAmazonas() {
  try {
    // Buscar el punto AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    console.log("📍 Punto encontrado:", punto.nombre, "(ID:", punto.id + ")");

    // Buscar moneda USD
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!moneda) {
      console.log("❌ No se encontró la moneda USD");
      return;
    }

    // Buscar saldo USD
    const saldo = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
    });

    console.log("\n💰 Saldo registrado en BD:");
    console.log("   Saldo actual (cantidad):", Number(saldo?.cantidad || 0));

    // Buscar saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        activo: true,
      },
      orderBy: {
        fecha_asignacion: "desc",
      },
    });

    console.log(
      "   Saldo inicial:",
      Number(saldoInicial?.cantidad_inicial || 0)
    );

    // Calcular desde movimientos
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        NOT: {
          descripcion: { contains: "bancos" },
        },
      },
      orderBy: { fecha: "asc" },
    });

    console.log("\n📊 Movimientos encontrados:", movimientos.length);

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);
    let totalIngresos = 0;
    let totalEgresos = 0;

    movimientos.forEach((mov) => {
      const tipo = mov.tipo_movimiento;
      const monto = Number(mov.monto);

      if (tipo === "SALDO_INICIAL") {
        // Ya incluido en 'inicial', skip
      } else if (tipo === "INGRESO") {
        totalIngresos += Math.abs(monto);
      } else if (tipo === "EGRESO") {
        totalEgresos += Math.abs(monto);
      } else if (tipo === "AJUSTE") {
        if (monto >= 0) {
          totalIngresos += monto;
        } else {
          totalEgresos += Math.abs(monto);
        }
      }
    });

    const saldoCalculado = inicial + totalIngresos - totalEgresos;

    console.log("\n🧮 Cálculo:");
    console.log("   Inicial:", inicial.toFixed(2));
    console.log("   + Ingresos:", totalIngresos.toFixed(2));
    console.log("   - Egresos:", totalEgresos.toFixed(2));
    console.log("   = Calculado:", saldoCalculado.toFixed(2));
    console.log(
      "\n📌 Diferencia:",
      (Number(saldo?.cantidad || 0) - saldoCalculado).toFixed(2)
    );

    // Mostrar últimos 10 movimientos
    console.log("\n📋 Últimos 10 movimientos:");
    const ultimos = movimientos.slice(-10);
    ultimos.forEach((mov) => {
      console.log(
        "   ",
        mov.fecha.toISOString().split("T")[0],
        mov.tipo_movimiento.padEnd(10),
        Number(mov.monto).toFixed(2).padStart(10),
        (mov.descripcion || "").substring(0, 40)
      );
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAmazonas();
