import prisma from "../server/lib/prisma";

async function testFlujoAmazonasEuroADolar() {
  // Datos reales
  const usuarioId = "9a0345af-b68d-4996-beb5-d4da66646c43"; // Cristian Cevallos
  const puntoId = "59f57d03-58f1-494f-abc1-d91377a3fef1"; // Punto Amazonas

  // Busca la moneda EUR y USD
  const euro = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });
  const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
  if (!euro || !usd) {
    console.error("No se encontró EUR o USD en monedas");
    return;
  }

  // Limpieza previa de movimientos de prueba
  await prisma.servicioExternoMovimiento.deleteMany({
    where: {
      punto_atencion_id: puntoId,
      moneda_id: usd.id,
      servicio: "YAGANASTE",
      usuario_id: usuarioId,
      descripcion: "Cambio de 200 EUR a USD a tasa 1.10"
    },
  });

  // Simula el cambio de 200 EUR a USD con tasa 1.10
  const montoEuros = 200;
  const tasa = 1.10;
  const montoUSD = +(montoEuros * tasa).toFixed(2);

  // Crea el movimiento de ingreso en USD
  const movimiento = await prisma.servicioExternoMovimiento.create({
    data: {
      punto_atencion_id: puntoId,
      servicio: "YAGANASTE",
      tipo_movimiento: "INGRESO",
      moneda_id: usd.id,
      monto: montoUSD,
      usuario_id: usuarioId,
      billetes: montoUSD,
      monedas_fisicas: 0,
      descripcion: "Cambio de 200 EUR a USD a tasa 1.10",
    },
  });

  // Actualiza el saldo USD del punto
  let saldo = await prisma.saldo.findFirst({
    where: { punto_atencion_id: puntoId, moneda_id: usd.id },
  });
  if (!saldo) {
    saldo = await prisma.saldo.create({
      data: {
        punto_atencion_id: puntoId,
        moneda_id: usd.id,
        cantidad: montoUSD,
        billetes: montoUSD,
        monedas_fisicas: 0,
      },
    });
  } else {
    await prisma.saldo.update({
      where: { id: saldo.id },
      data: {
        cantidad: Number(saldo.cantidad) + montoUSD,
        billetes: (Number(saldo.billetes) || 0) + montoUSD,
      },
    });
  }

  // Muestra el saldo final
  const saldoFinal = await prisma.saldo.findFirst({
    where: { punto_atencion_id: puntoId, moneda_id: usd.id },
  });
  console.log("Saldo final Amazonas USD:", saldoFinal);

  // Limpieza de prueba
  await prisma.servicioExternoMovimiento.delete({ where: { id: movimiento.id } });
  // (Opcional: comentar la siguiente línea si quieres dejar el saldo)
  // await prisma.saldo.update({ where: { id: saldoFinal.id }, data: { cantidad: saldo.cantidad, billetes: saldo.billetes } });
}

testFlujoAmazonasEuroADolar()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
