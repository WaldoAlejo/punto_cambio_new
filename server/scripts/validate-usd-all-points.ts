import prisma from "../lib/prisma.js";

async function validateUsdAllPoints() {
  try {
    console.log("\n" + "=".repeat(100));
    console.log("🔍 VALIDACIÓN DE SALDOS USD - TODOS LOS PUNTOS DE ATENCIÓN");
    console.log("=".repeat(100));

    // Obtener USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!usd) {
      console.log("❌ No se encontró USD");
      return;
    }

    // Obtener todos los puntos de atención activos
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });

    console.log(`\n📍 Puntos de atención: ${puntos.length}`);
    console.log(`💱 Moneda: USD\n`);

    const problemas: Array<{
      punto: string;
      saldoSistema: number;
      saldoCalculado: number;
      diferencia: number;
      movimientos: number;
      discrepanciaCadena: boolean;
    }> = [];

    for (const punto of puntos) {
      console.log(`\n${"─".repeat(100)}`);
      console.log(`📍 ${punto.nombre.toUpperCase()}`);
      console.log(`${"─".repeat(100)}`);

      // Obtener saldo actual del sistema
      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: usd.id,
          },
        },
      });

      const saldoSistema = Number(saldo?.cantidad || 0);

      // Obtener saldo inicial
      const saldoInicial = await prisma.saldoInicial.findFirst({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
          activo: true,
        },
      });

      const inicial = Number(saldoInicial?.cantidad_inicial || 0);

      // Obtener todos los movimientos
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
        orderBy: { created_at: "asc" },
      });

      // Calcular saldo basado en movimientos
      let saldoCalculado = inicial;
      let totalIngresos = 0;
      let totalEgresos = 0;
      let totalAjustes = 0;

      movimientos.forEach((m) => {
        const monto = Number(m.monto);
        if (m.tipo_movimiento === "INGRESO") {
          totalIngresos += monto;
          saldoCalculado += monto;
        } else if (m.tipo_movimiento === "EGRESO") {
          totalEgresos += Math.abs(monto);
          saldoCalculado += monto; // monto ya es negativo
        } else if (m.tipo_movimiento === "AJUSTE") {
          totalAjustes += monto;
          saldoCalculado += monto;
        }
      });

      // Verificar cadena de movimientos
      let discrepanciaCadena = false;
      let saldoEsperado = inicial;

      for (let i = 0; i < movimientos.length; i++) {
        const mov = movimientos[i];
        const saldoAnterior = Number(mov.saldo_anterior);
        const saldoNuevo = Number(mov.saldo_nuevo);
        const monto = Number(mov.monto);

        // Verificar que saldo_anterior coincida con el saldo esperado
        if (Math.abs(saldoAnterior - saldoEsperado) > 0.01) {
          if (!discrepanciaCadena) {
            console.log(`\n⚠️  DISCREPANCIAS EN CADENA DE MOVIMIENTOS:`);
            discrepanciaCadena = true;
          }
          console.log(`   Movimiento #${i + 1} (${mov.tipo_movimiento}):`);
          console.log(`   Esperado: $${saldoEsperado.toFixed(2)}`);
          console.log(`   Real:     $${saldoAnterior.toFixed(2)}`);
          console.log(
            `   Diferencia: $${(saldoAnterior - saldoEsperado).toFixed(2)}`
          );
          console.log(
            `   Fecha: ${new Date(mov.fecha).toLocaleString("es-EC")}`
          );
        }

        // Actualizar saldo esperado
        saldoEsperado = saldoNuevo;
      }

      const diferencia = saldoSistema - saldoCalculado;
      const tieneDiferencia = Math.abs(diferencia) > 0.01;

      // Mostrar información
      console.log(`\n💰 Resumen:`);
      console.log(`   Saldo inicial:    $${inicial.toFixed(2)}`);
      console.log(`   Total ingresos:   $${totalIngresos.toFixed(2)}`);
      console.log(`   Total egresos:    $${totalEgresos.toFixed(2)}`);
      if (totalAjustes !== 0) {
        console.log(`   Total ajustes:    $${totalAjustes.toFixed(2)}`);
      }
      console.log(`   Saldo calculado:  $${saldoCalculado.toFixed(2)}`);
      console.log(`   Saldo en sistema: $${saldoSistema.toFixed(2)}`);
      console.log(`   Movimientos:      ${movimientos.length}`);

      if (tieneDiferencia || discrepanciaCadena) {
        if (tieneDiferencia) {
          console.log(`   ⚠️  DIFERENCIA:    $${diferencia.toFixed(2)} ❌`);
        }
        if (discrepanciaCadena) {
          console.log(`   ⚠️  CADENA ROTA ❌`);
        }
        problemas.push({
          punto: punto.nombre,
          saldoSistema,
          saldoCalculado,
          diferencia,
          movimientos: movimientos.length,
          discrepanciaCadena,
        });
      } else {
        console.log(`   ✅ CORRECTO`);
      }
    }

    // Resumen de problemas
    console.log(`\n\n${"=".repeat(100)}`);
    console.log("📊 RESUMEN DE VALIDACIÓN USD");
    console.log(`${"=".repeat(100)}\n`);

    if (problemas.length === 0) {
      console.log("✅ ¡TODOS LOS SALDOS USD SON CORRECTOS!");
      console.log(
        "   No se encontraron discrepancias en ningún punto de atención.\n"
      );
    } else {
      console.log(
        `⚠️  SE ENCONTRARON ${problemas.length} PUNTOS CON PROBLEMAS:\n`
      );

      problemas.forEach((p, i) => {
        console.log(`${i + 1}. ${p.punto}`);
        console.log(`   Saldo sistema:   $${p.saldoSistema.toFixed(2)}`);
        console.log(`   Saldo calculado: $${p.saldoCalculado.toFixed(2)}`);
        console.log(`   Diferencia:      $${p.diferencia.toFixed(2)}`);
        console.log(`   Movimientos:     ${p.movimientos}`);
        if (p.discrepanciaCadena) {
          console.log(`   ⚠️  Cadena de movimientos rota`);
        }
        console.log();
      });

      console.log("📝 PRÓXIMOS PASOS:");
      console.log("   1. Para cada punto con problemas, ejecutar:");
      console.log(
        "      npx tsx server/scripts/check-amazonas-all-movements.ts"
      );
      console.log("      (modificar el script para el punto específico)");
      console.log("   2. Investigar las causas de las discrepancias");
      console.log("   3. Verificar conteos físicos de efectivo");
      console.log("   4. Registrar ajustes si es necesario\n");
    }

    console.log(`${"=".repeat(100)}\n`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

validateUsdAllPoints();
