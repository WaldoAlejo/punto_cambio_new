import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== ANÁLISIS DETALLADO: PLAZA DEL VALLE - USD ===\n");

  const punto = await prisma.puntoAtencion.findFirst({
    where: { nombre: "PLAZA DEL VALLE", activo: true },
  });

  if (!punto) {
    console.log("❌ Punto no encontrado");
    return;
  }

  const moneda = await prisma.moneda.findFirst({
    where: { codigo: "USD", activo: true },
  });

  if (!moneda) {
    console.log("❌ Moneda no encontrada");
    return;
  }

  // Saldo en BD
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
    },
  });

  console.log(`📍 Punto: ${punto.nombre}`);
  console.log(`💱 Moneda: ${moneda.codigo}`);
  console.log(`\nSaldo en BD:`);
  console.log(`  Cantidad: ${saldo?.cantidad}`);
  console.log(`  Billetes: ${saldo?.billetes}`);
  console.log(`  Monedas: ${saldo?.monedas_fisicas}`);
  console.log(`  Físico: ${Number(saldo?.billetes || 0) + Number(saldo?.monedas_fisicas || 0)}`);

  // Saldo Inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
      activo: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  console.log(`\nSaldo Inicial:`);
  console.log(`  Cantidad: ${saldoInicial?.cantidad_inicial}`);
  console.log(`  Fecha: ${saldoInicial?.fecha_asignacion}`);

  // Movimientos
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: moneda.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\nMovimientos: ${movimientos.length}`);
  console.log(`────────────────────────────────────────────────────────────`);

  let runningBalance = Number(saldoInicial?.cantidad_inicial || 0);
  let totalIngreso = 0;
  let totalEgreso = 0;

  // Agrupar por tipo
  const porTipo = new Map<string, number>();
  for (const mov of movimientos) {
    const actual = porTipo.get(mov.tipo_movimiento) || 0;
    porTipo.set(mov.tipo_movimiento, actual + 1);
  }

  console.log(`\nResumen por tipo de movimiento:`);
  for (const [tipo, count] of porTipo) {
    console.log(`  ${tipo}: ${count}`);
  }

  console.log(`\nMovimientos detallado:`);
  for (let i = 0; i < movimientos.length; i++) {
    const mov = movimientos[i];
    const monto = Number(mov.monto);

    if (
      mov.tipo_movimiento === "EGRESO" ||
      mov.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
    ) {
      runningBalance -= Math.abs(monto);
      totalEgreso += Math.abs(monto);
    } else if (
      mov.tipo_movimiento === "INGRESO" ||
      mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE" ||
      mov.tipo_movimiento === "TRANSFERENCIA_DEVOLUCION"
    ) {
      runningBalance += Math.abs(monto);
      totalIngreso += Math.abs(monto);
    } else {
      runningBalance += monto;
    }

    if (i < 5 || i >= movimientos.length - 5) {
      console.log(
        `  ${i + 1}. [${mov.fecha.toISOString().split("T")[0]}] ${mov.tipo_movimiento.padEnd(25)} | ${monto > 0 ? "+" : ""}${monto.toFixed(2)} | Balance: ${runningBalance.toFixed(2)}`
      );
      if (i === 4 && movimientos.length > 10) {
        console.log(`  ...`);
      }
    }
  }

  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\nSaldoInicial:     ${Number(saldoInicial?.cantidad_inicial || 0).toFixed(2)}`);
  console.log(`Total Ingresos:  +${totalIngreso.toFixed(2)}`);
  console.log(`Total Egresos:   -${totalEgreso.toFixed(2)}`);
  console.log(`───────────────────────────────────────────────────────────`);
  console.log(`Saldo Calculado:  ${runningBalance.toFixed(2)}`);
  console.log(`Saldo BD:         ${Number(saldo?.cantidad || 0).toFixed(2)}`);
  console.log(`\nDiferencia: ${(runningBalance - Number(saldo?.cantidad || 0)).toFixed(2)}`);

  if (Math.abs(runningBalance - Number(saldo?.cantidad || 0)) > 0.01) {
    console.log(
      `\n⚠️ MISMATCH ENCONTRADO: ${runningBalance.toFixed(2)} vs ${Number(saldo?.cantidad || 0).toFixed(2)}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
