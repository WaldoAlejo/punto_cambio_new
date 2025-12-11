import prisma from "../server/lib/prisma";

async function testFlujoBilletesMonedas() {
  // 1. Usar datos reales
  const puntoId = "59f57d03-58f1-494f-abc1-d91377a3fef1"; // Amazonas
  const usuarioId = "9a0345af-b68d-4996-beb5-d4da66646c43"; // Cristian Cevallos
  // Buscar moneda USD
  const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
  if (!usd) {
    throw new Error("No se encontró la moneda USD");
  }
  const monedaId = usd.id;


  // Limpieza previa completa
  await prisma.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
  await prisma.saldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId } });
  await prisma.servicioExternoSaldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });

  // 2. Intentar crear INGRESO sin saldo asignado (debe fallar)
  let ingresoSinSaldoPermitido = false;
  try {
    await prisma.servicioExternoMovimiento.create({
      data: {
        punto_atencion_id: puntoId,
        servicio: "YAGANASTE",
        tipo_movimiento: "INGRESO",
        moneda_id: monedaId,
        monto: 1000,
        usuario_id: usuarioId,
        billetes: 800,
        monedas_fisicas: 200,
      },
    });
    ingresoSinSaldoPermitido = true;
  } catch (err) {
    console.log("Correcto: No se permite INGRESO sin saldo asignado para YAGANASTE");
  }
  if (ingresoSinSaldoPermitido) {
    console.error("ERROR: Se permitió INGRESO sin saldo asignado (debería fallar)");
    // Limpiar si se creó algo por error
    await prisma.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
    await prisma.servicioExternoSaldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
  }

  // 3. Asignar saldo inicial al servicio externo (solo si no existe)
  let saldoServicio = await prisma.servicioExternoSaldo.findFirst({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
  if (!saldoServicio) {
    saldoServicio = await prisma.servicioExternoSaldo.create({
      data: {
        punto_atencion_id: puntoId,
        servicio: "YAGANASTE",
        moneda_id: monedaId,
        cantidad: 5000,
        billetes: 3000,
        monedas_fisicas: 2000,
      },
    });
  }

  // 4. Ahora sí, crear INGRESO (debe funcionar)
  const movimiento = await prisma.servicioExternoMovimiento.create({
    data: {
      punto_atencion_id: puntoId,
      servicio: "YAGANASTE",
      tipo_movimiento: "INGRESO",
      moneda_id: monedaId,
      monto: 1000,
      usuario_id: usuarioId,
      billetes: 800,
      monedas_fisicas: 200,
    },
  });
  console.log("Movimiento creado correctamente:", movimiento);

  // Limpieza final
  await prisma.servicioExternoMovimiento.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
  await prisma.servicioExternoSaldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId, servicio: "YAGANASTE" } });
  await prisma.saldo.deleteMany({ where: { punto_atencion_id: puntoId, moneda_id: monedaId } });
}

testFlujoBilletesMonedas()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
