import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkNegativeBalances() {
  console.log("🔍 Revisando saldos negativos...\n");

  // Buscar saldos negativos
  const saldosNegativos = await prisma.saldo.findMany({
    where: {
      cantidad: {
        lt: 0,
      },
    },
    include: {
      puntoAtencion: true,
      moneda: true,
    },
    orderBy: [
      { puntoAtencion: { nombre: "asc" } },
      { moneda: { codigo: "asc" } },
    ],
  });

  console.log(`❌ Encontrados ${saldosNegativos.length} saldos negativos:\n`);

  for (const saldo of saldosNegativos) {
    console.log(
      `📍 ${saldo.puntoAtencion.nombre} - ${saldo.moneda.codigo}: ${saldo.cantidad}`
    );
  }

  // Análisis específico de SANTA FE
  console.log("\n🔍 Análisis detallado de SANTA FE:\n");

  const santaFe = await prisma.puntoAtencion.findFirst({
    where: { nombre: "SANTA FE" },
  });

  if (!santaFe) {
    console.log("❌ No se encontró el punto SANTA FE");
    return;
  }

  const saldosSantaFe = await prisma.saldo.findMany({
    where: { punto_atencion_id: santaFe.id },
    include: { moneda: true },
    orderBy: { moneda: { codigo: "asc" } },
  });

  console.log("📊 Saldos actuales en SANTA FE:");
  for (const saldo of saldosSantaFe) {
    const status = Number(saldo.cantidad) < 0 ? "❌" : "✅";
    console.log(`${status} ${saldo.moneda.codigo}: ${saldo.cantidad}`);
  }

  // Revisar saldos iniciales de SANTA FE
  console.log("\n💰 Saldos iniciales de SANTA FE:");
  const saldosIniciales = await prisma.saldoInicial.findMany({
    where: {
      punto_atencion_id: santaFe.id,
      activo: true,
    },
    include: { moneda: true },
    orderBy: { moneda: { codigo: "asc" } },
  });

  for (const saldoInicial of saldosIniciales) {
    console.log(
      `💰 ${saldoInicial.moneda.codigo}: ${saldoInicial.cantidad_inicial}`
    );
  }

  // Revisar movimientos de SANTA FE para una moneda específica con saldo negativo
  const saldoNegativo = saldosSantaFe.find((s) => Number(s.cantidad) < 0);
  if (saldoNegativo) {
    console.log(
      `\n🔍 Análisis de movimientos para ${saldoNegativo.moneda.codigo} en SANTA FE:`
    );

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: santaFe.id,
        moneda_id: saldoNegativo.moneda_id,
      },
      orderBy: { created_at: "asc" },
      take: 20, // Últimos 20 movimientos
    });

    console.log(`📝 Últimos ${movimientos.length} movimientos:`);
    let acumulado = 0;

    // Obtener saldo inicial
    const saldoInicial = saldosIniciales.find(
      (si) => si.moneda_id === saldoNegativo.moneda_id
    );
    if (saldoInicial) {
      acumulado = Number(saldoInicial.cantidad_inicial);
      console.log(`💰 Saldo inicial: ${acumulado}`);
    }

    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      let operacion = "";

      switch (mov.tipo_movimiento) {
        case "INGRESO":
        case "TRANSFERENCIA_ENTRANTE":
          acumulado += monto;
          operacion = `+${monto}`;
          break;
        case "EGRESO":
        case "TRANSFERENCIA_SALIENTE":
          acumulado -= monto;
          operacion = `-${monto}`;
          break;
        case "CAMBIO_DIVISA":
          if (mov.descripcion?.includes("ingreso por cambio")) {
            acumulado += monto;
            operacion = `+${monto} (cambio in)`;
          } else if (mov.descripcion?.includes("egreso por cambio")) {
            acumulado -= monto;
            operacion = `-${monto} (cambio out)`;
          } else {
            operacion = `±${monto} (cambio ?)`;
          }
          break;
        case "AJUSTE":
          // No incluir ajustes en el cálculo
          operacion = `AJUSTE ${monto} (ignorado)`;
          break;
        default:
          operacion = `${monto} (${mov.tipo_movimiento})`;
      }

      console.log(
        `📝 ${mov.created_at.toISOString().split("T")[0]} | ${
          mov.tipo_movimiento
        } | ${operacion} | Acum: ${acumulado} | ${
          mov.descripcion || "Sin descripción"
        }`
      );
    }

    console.log(`\n📊 Saldo calculado: ${acumulado}`);
    console.log(`📊 Saldo en BD: ${saldoNegativo.cantidad}`);
    console.log(`📊 Diferencia: ${Number(saldoNegativo.cantidad) - acumulado}`);
  }
}

checkNegativeBalances()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
