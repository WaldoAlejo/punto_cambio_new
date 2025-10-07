import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixAmazonas() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró AMAZONAS");
      return;
    }

    // Buscar USD
    const moneda = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!moneda) {
      console.log("❌ No se encontró USD");
      return;
    }

    console.log("📍 Punto:", punto.nombre);
    console.log("💵 Moneda:", moneda.codigo);
    console.log("");

    // Calcular saldo correcto
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

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        NOT: {
          descripcion: { contains: "bancos" },
        },
      },
    });

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

    console.log("🧮 Cálculo:");
    console.log("   Inicial:", inicial.toFixed(2));
    console.log("   + Ingresos:", totalIngresos.toFixed(2));
    console.log("   - Egresos:", totalEgresos.toFixed(2));
    console.log("   = Calculado:", saldoCalculado.toFixed(2));
    console.log("");

    // Actualizar saldo
    console.log("🔧 Actualizando saldo...");

    const resultado = await prisma.saldo.upsert({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
      update: {
        cantidad: saldoCalculado,
      },
      create: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        cantidad: saldoCalculado,
        billetes: 0,
        monedas_fisicas: 0,
        bancos: 0,
      },
    });

    console.log("✅ Saldo actualizado:");
    console.log("   Cantidad:", Number(resultado.cantidad));
    console.log("   Bancos:", Number(resultado.bancos));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAmazonas();
