import prisma from "../lib/prisma.js";

async function checkScalaMovements() {
  try {
    // Buscar SCALA
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "SCALA", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto SCALA");
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

    console.log("\n" + "=".repeat(100));
    console.log("🔍 ANÁLISIS DETALLADO - SCALA USD");
    console.log("=".repeat(100));

    // Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        activo: true,
      },
    });

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);
    console.log(`\n💰 Saldo inicial: $${inicial.toFixed(2)}`);

    // Obtener todos los movimientos
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
      include: {
        usuario: true,
      },
      orderBy: { created_at: "asc" },
    });

    console.log(`📊 Total de movimientos: ${movimientos.length}\n`);

    // Calcular y mostrar cada movimiento
    let saldoEsperado = inicial;
    let totalIngresos = 0;
    let totalEgresos = 0;

    console.log("=".repeat(100));
    console.log("HISTORIAL DE MOVIMIENTOS");
    console.log("=".repeat(100));

    movimientos.forEach((m, i) => {
      const fecha = new Date(m.fecha).toLocaleString("es-EC");
      const createdAt = new Date(m.created_at).toLocaleString("es-EC");
      const monto = Number(m.monto);
      const saldoAnterior = Number(m.saldo_anterior);
      const saldoNuevo = Number(m.saldo_nuevo);

      // Verificar discrepancia
      const discrepancia = Math.abs(saldoAnterior - saldoEsperado) > 0.01;

      console.log(`\n${i + 1}. [${m.tipo_movimiento}] ${fecha}`);
      console.log(`   Monto: $${monto.toFixed(2)}`);
      console.log(`   Usuario: ${m.usuario.nombre}`);
      console.log(`   Descripción: ${m.descripcion || "N/A"}`);

      if (discrepancia) {
        console.log(`   ⚠️  DISCREPANCIA:`);
        console.log(`   Saldo esperado: $${saldoEsperado.toFixed(2)}`);
        console.log(`   Saldo anterior: $${saldoAnterior.toFixed(2)}`);
        console.log(
          `   Diferencia:     $${(saldoAnterior - saldoEsperado).toFixed(2)}`
        );
      } else {
        console.log(`   Saldo anterior: $${saldoAnterior.toFixed(2)}`);
      }

      console.log(`   Saldo nuevo:    $${saldoNuevo.toFixed(2)}`);
      console.log(`   Creado:         ${createdAt}`);

      // Actualizar totales
      if (m.tipo_movimiento === "INGRESO") {
        totalIngresos += monto;
      } else if (m.tipo_movimiento === "EGRESO") {
        totalEgresos += Math.abs(monto);
      }

      saldoEsperado = saldoNuevo;
    });

    // Resumen
    console.log("\n" + "=".repeat(100));
    console.log("📊 RESUMEN");
    console.log("=".repeat(100));

    const saldoCalculado = inicial + totalIngresos - totalEgresos;
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    console.log(`\nSaldo inicial:       $${inicial.toFixed(2)}`);
    console.log(`Total ingresos:      $${totalIngresos.toFixed(2)}`);
    console.log(`Total egresos:       $${totalEgresos.toFixed(2)}`);
    console.log(`Saldo calculado:     $${saldoCalculado.toFixed(2)}`);
    console.log(
      `Saldo en sistema:    $${Number(saldoActual?.cantidad || 0).toFixed(2)}`
    );

    // Buscar los movimientos problemáticos específicos
    console.log("\n" + "=".repeat(100));
    console.log("🔍 ANÁLISIS DE DISCREPANCIAS CRÍTICAS");
    console.log("=".repeat(100));

    // Movimiento #44
    if (movimientos.length >= 44) {
      const mov44 = movimientos[43]; // índice 43 = movimiento #44
      const mov43 = movimientos[42];

      console.log(`\n⚠️  DISCREPANCIA #1 - Movimiento #44:`);
      console.log(`   Fecha: ${new Date(mov44.fecha).toLocaleString("es-EC")}`);
      console.log(`   Tipo: ${mov44.tipo_movimiento}`);
      console.log(`   Monto: $${Number(mov44.monto).toFixed(2)}`);
      console.log(`   Descripción: ${mov44.descripcion}`);
      console.log(`   Usuario: ${mov44.usuario.nombre}`);
      console.log(
        `\n   Saldo del movimiento anterior (#43): $${Number(
          mov43.saldo_nuevo
        ).toFixed(2)}`
      );
      console.log(
        `   Saldo anterior registrado en #44:   $${Number(
          mov44.saldo_anterior
        ).toFixed(2)}`
      );
      console.log(
        `   Diferencia no explicada:             $${(
          Number(mov44.saldo_anterior) - Number(mov43.saldo_nuevo)
        ).toFixed(2)}`
      );
    }

    // Movimiento #46
    if (movimientos.length >= 46) {
      const mov46 = movimientos[45]; // índice 45 = movimiento #46
      const mov45 = movimientos[44];

      console.log(`\n⚠️  DISCREPANCIA #2 - Movimiento #46:`);
      console.log(`   Fecha: ${new Date(mov46.fecha).toLocaleString("es-EC")}`);
      console.log(`   Tipo: ${mov46.tipo_movimiento}`);
      console.log(`   Monto: $${Number(mov46.monto).toFixed(2)}`);
      console.log(`   Descripción: ${mov46.descripcion}`);
      console.log(`   Usuario: ${mov46.usuario.nombre}`);
      console.log(
        `\n   Saldo del movimiento anterior (#45): $${Number(
          mov45.saldo_nuevo
        ).toFixed(2)}`
      );
      console.log(
        `   Saldo anterior registrado en #46:   $${Number(
          mov46.saldo_anterior
        ).toFixed(2)}`
      );
      console.log(
        `   Diferencia no explicada:             $${(
          Number(mov46.saldo_anterior) - Number(mov45.saldo_nuevo)
        ).toFixed(2)}`
      );
    }

    console.log("\n" + "=".repeat(100));
    console.log("💡 CONCLUSIÓN");
    console.log("=".repeat(100));
    console.log(`\nHay un patrón similar a AMAZONAS:`);
    console.log(
      `1. El saldo "salta" hacia arriba en el movimiento #44 (+$15,604.96)`
    );
    console.log(
      `2. El saldo "cae" de vuelta en el movimiento #46 (-$15,604.96)`
    );
    console.log(
      `\nEsto sugiere que hubo un RETIRO NO REGISTRADO de aproximadamente $15,605`
    );
    console.log(
      `entre los movimientos #43 y #44, que luego fue "corregido" manualmente.`
    );
    console.log(
      `\n⚠️  RECOMENDACIÓN: Investigar qué pasó con ese dinero entre esas fechas.\n`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkScalaMovements();
