import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyzeSantaFeMovements() {
  console.log("🔍 Análisis completo de movimientos SANTA FE - USD\n");

  const santaFe = await prisma.puntoAtencion.findFirst({
    where: { nombre: "SANTA FE" },
  });
  const usd = await prisma.moneda.findFirst({
    where: { codigo: "USD" },
  });

  if (!santaFe || !usd) {
    console.log("❌ No se encontró SANTA FE o USD");
    return;
  }

  // Obtener TODOS los movimientos
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: santaFe.id,
      moneda_id: usd.id,
    },
    orderBy: { created_at: "asc" },
  });

  console.log(`📝 Total de movimientos: ${movimientos.length}\n`);

  let saldoAcumulado = 0;
  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalSaldoInicial = 0;
  let totalAjustes = 0;
  let totalTransferenciasEntrantes = 0;
  let totalTransferenciasSalientes = 0;
  let totalCambiosIngreso = 0;
  let totalCambiosEgreso = 0;

  console.log("📊 RESUMEN POR TIPO DE MOVIMIENTO:\n");

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const fecha = mov.created_at.toISOString().split("T")[0];

    switch (mov.tipo_movimiento) {
      case "SALDO_INICIAL":
        saldoAcumulado += monto;
        totalSaldoInicial += monto;
        console.log(
          `💰 ${fecha} | SALDO_INICIAL | +${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )}`
        );
        break;
      case "INGRESO":
        saldoAcumulado += monto;
        totalIngresos += monto;
        console.log(
          `📈 ${fecha} | INGRESO | +${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )} | ${mov.descripcion || "Sin descripción"}`
        );
        break;
      case "EGRESO":
        saldoAcumulado -= monto;
        totalEgresos += monto;
        console.log(
          `📉 ${fecha} | EGRESO | -${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )} | ${mov.descripcion || "Sin descripción"}`
        );
        break;
      case "TRANSFERENCIA_ENTRANTE":
        saldoAcumulado += monto;
        totalTransferenciasEntrantes += monto;
        console.log(
          `⬅️ ${fecha} | TRANSF_ENTRANTE | +${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )} | ${mov.descripcion || "Sin descripción"}`
        );
        break;
      case "TRANSFERENCIA_SALIENTE":
        saldoAcumulado -= monto;
        totalTransferenciasSalientes += monto;
        console.log(
          `➡️ ${fecha} | TRANSF_SALIENTE | -${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )} | ${mov.descripcion || "Sin descripción"}`
        );
        break;
      case "CAMBIO_DIVISA":
        if (mov.descripcion?.toLowerCase().includes("ingreso por cambio")) {
          saldoAcumulado += monto;
          totalCambiosIngreso += monto;
          console.log(
            `🔄 ${fecha} | CAMBIO_DIVISA | +${monto} | Acum: ${saldoAcumulado.toFixed(
              2
            )} | ${mov.descripcion}`
          );
        } else if (
          mov.descripcion?.toLowerCase().includes("egreso por cambio")
        ) {
          saldoAcumulado -= monto;
          totalCambiosEgreso += monto;
          console.log(
            `🔄 ${fecha} | CAMBIO_DIVISA | -${monto} | Acum: ${saldoAcumulado.toFixed(
              2
            )} | ${mov.descripcion}`
          );
        } else {
          console.log(
            `🔄 ${fecha} | CAMBIO_DIVISA | ±${monto} | Acum: ${saldoAcumulado.toFixed(
              2
            )} | ${mov.descripcion} (NO PROCESADO)`
          );
        }
        break;
      case "AJUSTE":
        totalAjustes += monto;
        console.log(
          `⚙️ ${fecha} | AJUSTE | ${monto} | Acum: ${saldoAcumulado.toFixed(
            2
          )} | ${mov.descripcion || "Sin descripción"} (IGNORADO EN CÁLCULO)`
        );
        break;
      default:
        console.log(
          `❓ ${fecha} | ${
            mov.tipo_movimiento
          } | ${monto} | Acum: ${saldoAcumulado.toFixed(2)} | ${
            mov.descripcion || "Sin descripción"
          } (NO PROCESADO)`
        );
    }
  }

  console.log("\n📊 RESUMEN FINAL:\n");
  console.log(`💰 Saldo inicial: +${totalSaldoInicial.toFixed(2)}`);
  console.log(`📈 Total ingresos: +${totalIngresos.toFixed(2)}`);
  console.log(`📉 Total egresos: -${totalEgresos.toFixed(2)}`);
  console.log(
    `⬅️ Transferencias entrantes: +${totalTransferenciasEntrantes.toFixed(2)}`
  );
  console.log(
    `➡️ Transferencias salientes: -${totalTransferenciasSalientes.toFixed(2)}`
  );
  console.log(`🔄 Cambios ingreso: +${totalCambiosIngreso.toFixed(2)}`);
  console.log(`🔄 Cambios egreso: -${totalCambiosEgreso.toFixed(2)}`);
  console.log(`⚙️ Ajustes (ignorados): ${totalAjustes.toFixed(2)}`);

  const totalEntradas =
    totalSaldoInicial +
    totalIngresos +
    totalTransferenciasEntrantes +
    totalCambiosIngreso;
  const totalSalidas =
    totalEgresos + totalTransferenciasSalientes + totalCambiosEgreso;

  console.log(`\n🟢 Total entradas: ${totalEntradas.toFixed(2)}`);
  console.log(`🔴 Total salidas: ${totalSalidas.toFixed(2)}`);
  console.log(
    `📊 Saldo calculado: ${(totalEntradas - totalSalidas).toFixed(2)}`
  );
  console.log(`📊 Saldo acumulado: ${saldoAcumulado.toFixed(2)}`);

  // Verificar saldo en BD
  const saldoBD = await prisma.saldo.findFirst({
    where: {
      punto_atencion_id: santaFe.id,
      moneda_id: usd.id,
    },
  });

  console.log(`📊 Saldo en BD: ${saldoBD?.cantidad || "No encontrado"}`);

  if (saldoAcumulado < 0) {
    console.log("\n⚠️ ANÁLISIS DEL SALDO NEGATIVO:");
    console.log(
      `❌ El punto SANTA FE tiene más salidas (${totalSalidas.toFixed(
        2
      )}) que entradas (${totalEntradas.toFixed(2)})`
    );
    console.log(`❌ Déficit: ${(totalSalidas - totalEntradas).toFixed(2)} USD`);
    console.log("\n🔍 Posibles causas:");
    console.log("1. Egresos excesivos sin ingresos correspondientes");
    console.log(
      "2. Transferencias salientes sin transferencias entrantes de compensación"
    );
    console.log("3. Cambios de divisa desfavorables");
    console.log("4. Saldo inicial insuficiente para cubrir las operaciones");
  }
}

analyzeSantaFeMovements()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
