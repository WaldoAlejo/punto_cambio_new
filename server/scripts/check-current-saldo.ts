import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 VERIFICANDO SALDO ACTUAL DE AMAZONAS USD\n");

  // Buscar AMAZONAS
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: "AMAZONAS" },
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

  // Obtener el saldo actual
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
    },
  });

  console.log("💰 SALDO EN TABLA 'Saldo':");
  console.log(`   Cantidad: $${Number(saldo?.cantidad || 0).toFixed(2)}`);
  console.log(`   Billetes: $${Number(saldo?.billetes || 0).toFixed(2)}`);
  console.log(`   Monedas: $${Number(saldo?.monedas_fisicas || 0).toFixed(2)}`);
  console.log(`   Bancos: $${Number(saldo?.bancos || 0).toFixed(2)}`);

  // Obtener el último movimiento
  const ultimoMovimiento = await prisma.movimientoSaldo.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
    },
    orderBy: { fecha: "desc" },
  });

  console.log("\n📋 ÚLTIMO MOVIMIENTO:");
  if (ultimoMovimiento) {
    console.log(`   Fecha: ${ultimoMovimiento.fecha.toISOString()}`);
    console.log(`   Tipo: ${ultimoMovimiento.tipo_movimiento}`);
    console.log(`   Monto: $${Number(ultimoMovimiento.monto).toFixed(2)}`);
    console.log(
      `   Saldo anterior: $${Number(ultimoMovimiento.saldo_anterior).toFixed(
        2
      )}`
    );
    console.log(
      `   Saldo nuevo: $${Number(ultimoMovimiento.saldo_nuevo).toFixed(2)}`
    );
  }

  // Calcular el saldo esperado desde el inicio
  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\n📊 TOTAL DE MOVIMIENTOS: ${todosMovimientos.length}`);

  let saldoCalculado = 0;
  todosMovimientos.forEach((m, idx) => {
    saldoCalculado += Number(m.monto);
  });

  console.log(`\n🧮 CÁLCULO DESDE CERO:`);
  console.log(`   Suma de todos los montos: $${saldoCalculado.toFixed(2)}`);
  console.log(
    `   Saldo en tabla 'Saldo': $${Number(saldo?.cantidad || 0).toFixed(2)}`
  );
  console.log(
    `   Último saldo_nuevo: $${Number(
      ultimoMovimiento?.saldo_nuevo || 0
    ).toFixed(2)}`
  );

  const diferenciaSaldo = Number(saldo?.cantidad || 0) - saldoCalculado;
  const diferenciaUltimo =
    Number(ultimoMovimiento?.saldo_nuevo || 0) - saldoCalculado;

  console.log(`\n⚠️  DIFERENCIAS:`);
  console.log(`   Tabla Saldo vs Calculado: $${diferenciaSaldo.toFixed(2)}`);
  console.log(`   Último mov vs Calculado: $${diferenciaUltimo.toFixed(2)}`);

  if (Math.abs(diferenciaSaldo) > 0.01) {
    console.log(`\n❌ HAY INCONSISTENCIA EN LA TABLA 'Saldo'`);
  }

  if (Math.abs(diferenciaUltimo) > 0.01) {
    console.log(`\n❌ HAY INCONSISTENCIA EN LA CADENA DE MOVIMIENTOS`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
