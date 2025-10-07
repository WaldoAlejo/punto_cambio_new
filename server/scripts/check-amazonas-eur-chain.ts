import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔗 VERIFICACIÓN DE CADENA DE MOVIMIENTOS - AMAZONAS EUR\n");

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

  const movements = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`📋 Total de movimientos: ${movements.length}\n`);
  console.log("🔍 VERIFICANDO CADENA DE MOVIMIENTOS:\n");

  console.log(
    "MOV  FECHA       HORA     TIPO            MONTO      SALDO_ANT  SALDO_NUEVO  ESPERADO_ANT  ESTADO"
  );
  console.log("=".repeat(120));

  let expectedSaldoAnterior = 0;
  let brokenLinks = 0;
  let correctLinks = 0;

  movements.forEach((mov, index) => {
    const fecha = mov.fecha.toISOString().split("T")[0];
    const hora = mov.fecha.toISOString().split("T")[1].substring(0, 8);
    const monto = Number(mov.monto);
    const saldoAnterior = Number(mov.saldo_anterior);
    const saldoNuevo = Number(mov.saldo_nuevo);

    // Verificar si el cálculo es correcto
    const calculatedSaldoNuevo = saldoAnterior + monto;
    const isCalculationCorrect =
      Math.abs(calculatedSaldoNuevo - saldoNuevo) < 0.01;

    // Verificar si la cadena es correcta
    const isChainCorrect =
      Math.abs(saldoAnterior - expectedSaldoAnterior) < 0.01;

    const difference = saldoAnterior - expectedSaldoAnterior;

    let status = "✅ OK";
    if (!isChainCorrect) {
      status = `❌ ROTA (Δ €${difference.toFixed(2)})`;
      brokenLinks++;
    } else {
      correctLinks++;
    }

    const montoStr =
      monto >= 0
        ? `+${monto.toFixed(2).padStart(10)}`
        : monto.toFixed(2).padStart(11);

    console.log(
      `${String(index + 1).padStart(
        3
      )}  ${fecha} ${hora} ${mov.tipo_movimiento.padEnd(
        15
      )} ${montoStr}  ${saldoAnterior.toFixed(2).padStart(11)}  ${saldoNuevo
        .toFixed(2)
        .padStart(11)}  ${expectedSaldoAnterior
        .toFixed(2)
        .padStart(12)}  ${status}`
    );

    expectedSaldoAnterior = saldoNuevo;
  });

  console.log("=".repeat(120));

  console.log("\n📊 RESUMEN DE CADENA:\n");
  console.log(`   ✅ Enlaces correctos: ${correctLinks}`);
  console.log(`   ❌ Enlaces rotos: ${brokenLinks}`);
  console.log(`   📝 Total: ${movements.length}`);

  if (brokenLinks > 0) {
    console.log(`\n⚠️  La cadena de movimientos tiene ${brokenLinks} salto(s)`);
    console.log(
      "   Esto indica que hubo movimientos eliminados o saldos modificados manualmente"
    );
  } else {
    console.log("\n✅ La cadena de movimientos es consistente");
  }

  // Obtener saldo de la tabla
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  const saldoFinalMovimientos =
    movements.length > 0
      ? Number(movements[movements.length - 1].saldo_nuevo)
      : 0;
  const saldoTabla = Number(saldo?.cantidad || 0);

  console.log(
    `\n💰 Saldo final en movimientos: €${saldoFinalMovimientos.toFixed(2)}`
  );
  console.log(`   Saldo en tabla 'Saldo': €${saldoTabla.toFixed(2)}`);
  console.log(
    `   Diferencia: €${(saldoTabla - saldoFinalMovimientos).toFixed(2)}`
  );

  if (Math.abs(saldoTabla - saldoFinalMovimientos) > 0.01) {
    console.log(`\n❌ LA TABLA 'Saldo' NO COINCIDE CON LOS MOVIMIENTOS`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
