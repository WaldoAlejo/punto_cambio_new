import prisma from "../lib/prisma.js";

async function validateAllPoints() {
  try {
    console.log("\n" + "=".repeat(100));
    console.log("🔍 VALIDACIÓN DE SALDOS - TODOS LOS PUNTOS DE ATENCIÓN");
    console.log("=".repeat(100));

    // Obtener todos los puntos de atención activos
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });

    // Obtener solo las monedas que tienen saldo en algún punto
    const saldosExistentes = await prisma.saldo.findMany({
      where: {
        OR: [{ cantidad: { not: 0 } }],
      },
      include: {
        moneda: true,
      },
      distinct: ["moneda_id"],
    });

    const monedasConSaldo = saldosExistentes.map((s) => s.moneda);
    const monedasUnicas = Array.from(
      new Set(monedasConSaldo.map((m) => m.id))
    ).map((id) => monedasConSaldo.find((m) => m.id === id)!);

    console.log(`\n📍 Puntos de atención encontrados: ${puntos.length}`);
    console.log(
      `💱 Monedas con saldo: ${monedasUnicas.map((m) => m.codigo).join(", ")}\n`
    );

    const problemas: Array<{
      punto: string;
      moneda: string;
      saldoSistema: number;
      saldoCalculado: number;
      diferencia: number;
      movimientos: number;
    }> = [];

    // Validar cada punto con cada moneda
    for (const punto of puntos) {
      console.log(`\n${"─".repeat(100)}`);
      console.log(`📍 ${punto.nombre.toUpperCase()}`);
      console.log(`${"─".repeat(100)}`);

      for (const moneda of monedasUnicas) {
        // Obtener saldo actual del sistema
        const saldo = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
        });

        const saldoSistema = Number(saldo?.cantidad || 0);

        // Obtener saldo inicial
        const saldoInicial = await prisma.saldoInicial.findFirst({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
            activo: true,
          },
        });

        const inicial = Number(saldoInicial?.cantidad_inicial || 0);

        // Obtener todos los movimientos
        const movimientos = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
          orderBy: { created_at: "asc" },
        });

        // Calcular saldo basado en movimientos
        let saldoCalculado = inicial;
        let totalIngresos = 0;
        let totalEgresos = 0;

        movimientos.forEach((m) => {
          const monto = Number(m.monto);
          if (m.tipo_movimiento === "INGRESO") {
            totalIngresos += monto;
            saldoCalculado += monto;
          } else if (m.tipo_movimiento === "EGRESO") {
            totalEgresos += Math.abs(monto);
            saldoCalculado += monto; // monto ya es negativo
          } else if (m.tipo_movimiento === "AJUSTE") {
            saldoCalculado += monto;
          } else if (m.tipo_movimiento === "SALDO_INICIAL") {
            // Ya está incluido en 'inicial'
          }
        });

        const diferencia = saldoSistema - saldoCalculado;
        const tieneDiferencia = Math.abs(diferencia) > 0.01;

        // Mostrar información
        if (saldoSistema !== 0 || movimientos.length > 0) {
          console.log(`\n  💱 ${moneda.codigo}:`);
          console.log(
            `     Saldo inicial:    ${moneda.simbolo}${inicial.toFixed(2)}`
          );
          console.log(
            `     Total ingresos:   ${moneda.simbolo}${totalIngresos.toFixed(
              2
            )}`
          );
          console.log(
            `     Total egresos:    ${moneda.simbolo}${totalEgresos.toFixed(2)}`
          );
          console.log(
            `     Saldo calculado:  ${moneda.simbolo}${saldoCalculado.toFixed(
              2
            )}`
          );
          console.log(
            `     Saldo en sistema: ${moneda.simbolo}${saldoSistema.toFixed(2)}`
          );
          console.log(`     Movimientos:      ${movimientos.length}`);

          if (tieneDiferencia) {
            console.log(
              `     ⚠️  DIFERENCIA:    ${moneda.simbolo}${diferencia.toFixed(
                2
              )} ❌`
            );
            problemas.push({
              punto: punto.nombre,
              moneda: moneda.codigo,
              saldoSistema,
              saldoCalculado,
              diferencia,
              movimientos: movimientos.length,
            });
          } else {
            console.log(`     ✅ CORRECTO`);
          }
        }
      }
    }

    // Resumen de problemas
    console.log(`\n\n${"=".repeat(100)}`);
    console.log("📊 RESUMEN DE VALIDACIÓN");
    console.log(`${"=".repeat(100)}\n`);

    if (problemas.length === 0) {
      console.log("✅ ¡TODOS LOS SALDOS SON CORRECTOS!");
      console.log(
        "   No se encontraron discrepancias entre el sistema y los movimientos registrados.\n"
      );
    } else {
      console.log(`⚠️  SE ENCONTRARON ${problemas.length} DISCREPANCIAS:\n`);

      problemas.forEach((p, i) => {
        console.log(`${i + 1}. ${p.punto} - ${p.moneda}`);
        console.log(`   Saldo sistema:   $${p.saldoSistema.toFixed(2)}`);
        console.log(`   Saldo calculado: $${p.saldoCalculado.toFixed(2)}`);
        console.log(`   Diferencia:      $${p.diferencia.toFixed(2)}`);
        console.log(`   Movimientos:     ${p.movimientos}`);
        console.log();
      });

      console.log("📝 RECOMENDACIONES:");
      console.log(
        "   1. Revisar los movimientos de cada punto con discrepancias"
      );
      console.log("   2. Verificar si hay movimientos duplicados o faltantes");
      console.log("   3. Validar la cadena de saldo_anterior → saldo_nuevo");
      console.log(
        "   4. Ejecutar scripts de análisis detallado para cada punto\n"
      );
    }

    console.log(`${"=".repeat(100)}\n`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

validateAllPoints();
