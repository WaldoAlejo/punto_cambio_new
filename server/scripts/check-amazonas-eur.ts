import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 VERIFICANDO SALDO DE EUR EN AMAZONAS\n");

  // Buscar AMAZONAS
  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: "AMAZONAS" },
  });

  if (!punto) {
    console.log("❌ No se encontró el punto AMAZONAS");
    return;
  }

  // Buscar EUR
  const eur = await prisma.moneda.findFirst({
    where: { codigo: "EUR" },
  });

  if (!eur) {
    console.log("❌ No se encontró EUR");
    return;
  }

  // Obtener el saldo actual
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log("💰 SALDO EN TABLA 'Saldo':");
  console.log(`   Cantidad: €${Number(saldo?.cantidad || 0).toFixed(2)}`);
  console.log(`   Billetes: €${Number(saldo?.billetes || 0).toFixed(2)}`);
  console.log(`   Monedas: €${Number(saldo?.monedas_fisicas || 0).toFixed(2)}`);
  console.log(`   Bancos: €${Number(saldo?.bancos || 0).toFixed(2)}`);

  // Obtener todos los movimientos de EUR
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\n📋 MOVIMIENTOS DE EUR: ${movimientos.length}`);

  if (movimientos.length > 0) {
    console.log("\n🔍 ÚLTIMOS 10 MOVIMIENTOS:");
    const ultimos = movimientos.slice(-10);

    ultimos.forEach((m, idx) => {
      const fecha = m.fecha.toISOString().split("T")[0];
      const hora = m.fecha.toISOString().split("T")[1].substring(0, 8);
      console.log(
        `${idx + 1}. ${fecha} ${hora} ${m.tipo_movimiento.padEnd(15)} ` +
          `€${Number(m.monto).toFixed(2).padStart(10)} ` +
          `Saldo: €${Number(m.saldo_nuevo).toFixed(2)}`
      );
    });

    const ultimoMov = movimientos[movimientos.length - 1];
    console.log(`\n📊 ÚLTIMO MOVIMIENTO:`);
    console.log(`   Fecha: ${ultimoMov.fecha.toISOString()}`);
    console.log(`   Tipo: ${ultimoMov.tipo_movimiento}`);
    console.log(`   Monto: €${Number(ultimoMov.monto).toFixed(2)}`);
    console.log(`   Saldo nuevo: €${Number(ultimoMov.saldo_nuevo).toFixed(2)}`);
  }

  // Calcular saldo desde cero
  let saldoCalculado = 0;
  movimientos.forEach((m) => {
    saldoCalculado += Number(m.monto);
  });

  console.log(`\n🧮 VERIFICACIÓN:`);
  console.log(`   Suma de todos los montos: €${saldoCalculado.toFixed(2)}`);
  console.log(
    `   Saldo en tabla 'Saldo': €${Number(saldo?.cantidad || 0).toFixed(2)}`
  );

  const diferencia = Number(saldo?.cantidad || 0) - saldoCalculado;
  console.log(`   Diferencia: €${diferencia.toFixed(2)}`);

  if (Math.abs(diferencia) > 0.01) {
    console.log(`\n❌ HAY INCONSISTENCIA EN EL SALDO DE EUR`);
  } else {
    console.log(`\n✅ El saldo de EUR es consistente`);
  }

  // Verificar si hay suficiente EUR para vender 250
  console.log(`\n💶 VERIFICACIÓN PARA VENTA DE 250 EUR:`);
  const saldoActual = Number(saldo?.cantidad || 0);
  console.log(`   Saldo actual: €${saldoActual.toFixed(2)}`);
  console.log(`   Cantidad a vender: €250.00`);
  console.log(`   Saldo después de venta: €${(saldoActual - 250).toFixed(2)}`);

  if (saldoActual >= 250) {
    console.log(`   ✅ HAY SUFICIENTE EUR para la venta`);
  } else {
    console.log(
      `   ❌ NO HAY SUFICIENTE EUR (falta €${(250 - saldoActual).toFixed(2)})`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
