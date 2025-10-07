import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 CORRECCIÓN DE SALDO EUR EN AMAZONAS\n");

  const dryRun = !process.argv.includes("--apply");

  if (dryRun) {
    console.log("⚠️  MODO SIMULACIÓN (usa --apply para aplicar cambios)\n");
  } else {
    console.log("✅ MODO APLICACIÓN - Los cambios se guardarán en la BD\n");
  }

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

  if (!saldo) {
    console.log("❌ No se encontró el saldo de EUR en AMAZONAS");
    return;
  }

  // Obtener el último movimiento
  const ultimoMovimiento = await prisma.movimientoSaldo.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
    },
    orderBy: { fecha: "desc" },
  });

  if (!ultimoMovimiento) {
    console.log("❌ No se encontraron movimientos de EUR");
    return;
  }

  const saldoActual = Number(saldo.cantidad);
  const saldoEsperado = Number(ultimoMovimiento.saldo_nuevo);
  const diferencia = saldoEsperado - saldoActual;

  console.log("📊 ANÁLISIS:");
  console.log(`   Saldo actual en tabla 'Saldo': €${saldoActual.toFixed(2)}`);
  console.log(
    `   Saldo esperado (último movimiento): €${saldoEsperado.toFixed(2)}`
  );
  console.log(`   Diferencia: €${diferencia.toFixed(2)}`);

  if (Math.abs(diferencia) < 0.01) {
    console.log("\n✅ El saldo ya es correcto, no se necesita corrección");
    return;
  }

  console.log("\n🔍 ÚLTIMO MOVIMIENTO:");
  console.log(`   ID: ${ultimoMovimiento.id}`);
  console.log(`   Fecha: ${ultimoMovimiento.fecha.toISOString()}`);
  console.log(`   Tipo: ${ultimoMovimiento.tipo_movimiento}`);
  console.log(`   Monto: €${Number(ultimoMovimiento.monto).toFixed(2)}`);
  console.log(
    `   Saldo anterior: €${Number(ultimoMovimiento.saldo_anterior).toFixed(2)}`
  );
  console.log(
    `   Saldo nuevo: €${Number(ultimoMovimiento.saldo_nuevo).toFixed(2)}`
  );

  console.log("\n🔧 CORRECCIÓN A APLICAR:");
  console.log(`   Actualizar tabla 'Saldo':`);
  console.log(
    `   - cantidad: €${saldoActual.toFixed(2)} → €${saldoEsperado.toFixed(2)}`
  );

  if (dryRun) {
    console.log("\n⚠️  SIMULACIÓN - No se aplicaron cambios");
    console.log("   Ejecuta con --apply para aplicar la corrección");
  } else {
    console.log("\n⏳ Aplicando corrección...");

    await prisma.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: eur.id,
        },
      },
      data: {
        cantidad: saldoEsperado,
      },
    });

    console.log("✅ Corrección aplicada exitosamente");

    // Verificar
    const saldoActualizado = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: eur.id,
        },
      },
    });

    console.log("\n📊 VERIFICACIÓN:");
    console.log(
      `   Nuevo saldo en tabla 'Saldo': €${Number(
        saldoActualizado?.cantidad || 0
      ).toFixed(2)}`
    );
    console.log(`   Saldo esperado: €${saldoEsperado.toFixed(2)}`);

    if (
      Math.abs(Number(saldoActualizado?.cantidad || 0) - saldoEsperado) < 0.01
    ) {
      console.log("   ✅ Verificación exitosa");
    } else {
      console.log("   ❌ Error en la verificación");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
