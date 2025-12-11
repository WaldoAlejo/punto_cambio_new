import prisma from "../server/lib/prisma";

async function testFlujoBilletesMonedas() {
  // 1. Crear saldo inicial
  const puntoId = "test-punto-1";
  const monedaId = "test-moneda-1";

  // Limpieza previa
  await prisma.saldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId } });
  await prisma.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId } });

  // 2. Crear movimiento de ingreso con billetes y monedas
  await prisma.servicioExternoMovimiento.create({
    data: {
      punto_atencion_id: puntoId,
      servicio: "YAGANASTE",
      tipo_movimiento: "INGRESO",
      moneda_id: monedaId,
      monto: 1000,
      usuario_id: "test-user",
      billetes: 800,
      monedas_fisicas: 200,
    },
  });

  // 3. Ejecutar query de actualización (simulación manual)
  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    where: { punto_atencion_id: puntoId, moneda_id: monedaId },
    select: { billetes: true, monedas_fisicas: true },
  });
  const sumBilletes = movimientos.reduce((acc, m) => acc + Number(m.billetes || 0), 0);
  const sumMonedas = movimientos.reduce((acc, m) => acc + Number(m.monedas_fisicas || 0), 0);

  await prisma.saldo.create({
    data: {
      id: "test-saldo-1",
      punto_atencion_id: puntoId,
      moneda_id: monedaId,
      cantidad: 1000,
      billetes: sumBilletes,
      monedas_fisicas: sumMonedas,
    },
  });

  // 4. Validar resultado
  const saldo = await prisma.saldo.findUnique({ where: { id: "test-saldo-1" } });
  console.log("Saldo final:", saldo);

  // Limpieza final
  await prisma.saldo.delete({ where: { id: "test-saldo-1" } });
  await prisma.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId } });
}

testFlujoBilletesMonedas()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
