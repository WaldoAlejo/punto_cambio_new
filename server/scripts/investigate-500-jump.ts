import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 INVESTIGACIÓN DETALLADA DEL SALTO DE $500\n");

  // Obtener movimientos #5 y #6
  const movements = await prisma.movimientoSaldo.findMany({
    where: {
      puntoAtencion: { nombre: "AMAZONAS" },
      moneda: { codigo: "USD" },
    },
    include: {
      puntoAtencion: true,
      moneda: true,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`📊 Total de movimientos encontrados: ${movements.length}\n`);

  // Analizar movimientos #5 y #6
  const mov5 = movements[4]; // índice 4 = movimiento #5
  const mov6 = movements[5]; // índice 5 = movimiento #6

  console.log("=".repeat(80));
  console.log("MOVIMIENTO #5");
  console.log("=".repeat(80));
  console.log(`ID: ${mov5.id}`);
  console.log(`Fecha: ${mov5.fecha.toISOString()}`);
  console.log(`Tipo: ${mov5.tipo_movimiento}`);
  console.log(`Monto: $${Number(mov5.monto).toFixed(2)}`);
  console.log(`Saldo anterior: $${Number(mov5.saldo_anterior).toFixed(2)}`);
  console.log(`Saldo nuevo: $${Number(mov5.saldo_nuevo).toFixed(2)}`);
  console.log(`Referencia ID: ${mov5.referencia_id}`);
  console.log(`Tipo referencia: ${mov5.tipo_referencia}`);

  console.log("\n" + "=".repeat(80));
  console.log("MOVIMIENTO #6");
  console.log("=".repeat(80));
  console.log(`ID: ${mov6.id}`);
  console.log(`Fecha: ${mov6.fecha.toISOString()}`);
  console.log(`Tipo: ${mov6.tipo_movimiento}`);
  console.log(`Monto: $${Number(mov6.monto).toFixed(2)}`);
  console.log(`Saldo anterior: $${Number(mov6.saldo_anterior).toFixed(2)}`);
  console.log(`Saldo nuevo: $${Number(mov6.saldo_nuevo).toFixed(2)}`);
  console.log(`Referencia ID: ${mov6.referencia_id}`);
  console.log(`Tipo referencia: ${mov6.tipo_referencia}`);

  console.log("\n" + "=".repeat(80));
  console.log("ANÁLISIS DEL SALTO");
  console.log("=".repeat(80));

  const expectedSaldoAnterior = Number(mov5.saldo_nuevo);
  const actualSaldoAnterior = Number(mov6.saldo_anterior);
  const difference = actualSaldoAnterior - expectedSaldoAnterior;

  console.log(`Saldo nuevo de mov #5: $${expectedSaldoAnterior.toFixed(2)}`);
  console.log(`Saldo anterior de mov #6: $${actualSaldoAnterior.toFixed(2)}`);
  console.log(`Diferencia: $${difference.toFixed(2)}`);

  if (Math.abs(difference) > 0.01) {
    console.log(`\n⚠️  SALTO DETECTADO: $${difference.toFixed(2)}`);
  }

  // Verificar si la referencia del movimiento #6 es un EXCHANGE
  if (mov6.tipo_referencia === "EXCHANGE") {
    console.log("\n" + "=".repeat(80));
    console.log("VERIFICANDO TRANSACCIÓN DE CAMBIO");
    console.log("=".repeat(80));

    const exchange = await prisma.cambioDivisa.findUnique({
      where: { id: mov6.referencia_id },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        puntoAtencion: true,
      },
    });

    if (exchange) {
      console.log(`ID: ${exchange.id}`);
      console.log(`Fecha: ${exchange.fecha.toISOString()}`);
      console.log(`Punto: ${exchange.puntoAtencion.nombre}`);
      console.log(
        `${exchange.monedaOrigen.codigo} → ${exchange.monedaDestino.codigo}`
      );
      console.log(`Monto origen: ${Number(exchange.monto_origen).toFixed(2)}`);
      console.log(
        `Monto destino: ${Number(exchange.monto_destino).toFixed(2)}`
      );
      console.log(`Tasa: ${Number(exchange.tasa_cambio).toFixed(4)}`);

      // Buscar TODOS los movimientos asociados a este exchange
      console.log("\n📋 Movimientos asociados a este EXCHANGE:");
      const relatedMovements = await prisma.movimientoSaldo.findMany({
        where: {
          referencia_id: exchange.id,
          tipo_referencia: "EXCHANGE",
        },
        include: {
          puntoAtencion: true,
          moneda: true,
        },
        orderBy: { fecha: "asc" },
      });

      console.log(`Total: ${relatedMovements.length} movimientos\n`);

      relatedMovements.forEach((m, idx) => {
        console.log(`Movimiento ${idx + 1}:`);
        console.log(`  Punto: ${m.puntoAtencion.nombre}`);
        console.log(`  Moneda: ${m.moneda.codigo}`);
        console.log(`  Tipo: ${m.tipo_movimiento}`);
        console.log(`  Monto: ${Number(m.monto).toFixed(2)}`);
        console.log(`  Saldo anterior: ${Number(m.saldo_anterior).toFixed(2)}`);
        console.log(`  Saldo nuevo: ${Number(m.saldo_nuevo).toFixed(2)}`);
        console.log("");
      });
    }
  }

  // Buscar si hay algún movimiento con el mismo timestamp pero diferente
  console.log("\n" + "=".repeat(80));
  console.log("BUSCANDO MOVIMIENTOS CERCANOS EN TIEMPO");
  console.log("=".repeat(80));

  const timeWindow = 5 * 60 * 1000; // 5 minutos
  const mov6Time = mov6.fecha.getTime();

  const nearbyMovements = await prisma.movimientoSaldo.findMany({
    where: {
      puntoAtencion: { nombre: "AMAZONAS" },
      fecha: {
        gte: new Date(mov6Time - timeWindow),
        lte: new Date(mov6Time + timeWindow),
      },
    },
    include: {
      puntoAtencion: true,
      moneda: true,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(
    `Movimientos en ventana de ±5 minutos: ${nearbyMovements.length}\n`
  );

  nearbyMovements.forEach((m) => {
    const timeDiff = (m.fecha.getTime() - mov6Time) / 1000;
    console.log(
      `${m.fecha.toISOString()} (${timeDiff > 0 ? "+" : ""}${timeDiff.toFixed(
        0
      )}s) ` +
        `${m.moneda.codigo} ${m.tipo_movimiento} $${Number(m.monto).toFixed(2)}`
    );
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
