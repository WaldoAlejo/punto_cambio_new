import prisma from "../lib/prisma.js";

/**
 * Script para RECALCULAR y CORREGIR todos los saldos de AMAZONAS USD
 *
 * Problema detectado: Los saldos_nuevo están mal calculados en la BD
 * Solución: Recalcular cada movimiento basándose en:
 *   - saldo_nuevo = saldo_anterior + monto
 */

async function fixAmazonasSaldos() {
  try {
    console.log("🔧 INICIANDO CORRECCIÓN DE SALDOS - AMAZONAS USD\n");

    // 1. Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
      return;
    }

    // 2. Buscar USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" },
    });

    if (!usd) {
      console.log("❌ No se encontró USD");
      return;
    }

    console.log(`📍 Punto: ${punto.nombre}`);
    console.log(`💵 Moneda: ${usd.codigo}\n`);

    // 3. Obtener TODOS los movimientos ordenados por fecha
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
      orderBy: { fecha: "asc" },
    });

    console.log(`📋 Total de movimientos a revisar: ${movimientos.length}\n`);

    // 4. Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        activo: true,
      },
      orderBy: { fecha_asignacion: "desc" },
    });

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);
    console.log(`💰 Saldo inicial: $${inicial.toFixed(2)}\n`);

    // 5. RECALCULAR cada movimiento
    console.log("🔄 RECALCULANDO SALDOS...\n");
    console.log(
      "MOV  FECHA       TIPO            MONTO      SALDO_ANT  SALDO_NUEVO_BD  SALDO_NUEVO_CORRECTO  ESTADO"
    );
    console.log("=".repeat(120));

    let saldoActual = inicial;
    let movimientosCorregidos = 0;
    let movimientosCorrectos = 0;

    const correcciones: Array<{
      id: string;
      saldoNuevoActual: number;
      saldoNuevoCorrecto: number;
    }> = [];

    for (let i = 0; i < movimientos.length; i++) {
      const m = movimientos[i];
      const monto = Number(m.monto);
      const saldoAnterior = Number(m.saldo_anterior);
      const saldoNuevoBD = Number(m.saldo_nuevo);

      // Calcular el saldo nuevo CORRECTO
      const saldoNuevoCorrecto = saldoAnterior + monto;

      // Verificar si está correcto
      const esCorrecto = Math.abs(saldoNuevoBD - saldoNuevoCorrecto) < 0.01;
      const estado = esCorrecto ? "✅ OK" : "❌ ERROR";

      if (!esCorrecto) {
        movimientosCorregidos++;
        correcciones.push({
          id: m.id,
          saldoNuevoActual: saldoNuevoBD,
          saldoNuevoCorrecto: saldoNuevoCorrecto,
        });
      } else {
        movimientosCorrectos++;
      }

      // Mostrar el movimiento
      const fecha = m.fecha.toISOString().split("T")[0];
      console.log(
        `${String(i + 1).padStart(3)}  ${fecha} ${m.tipo_movimiento.padEnd(
          15
        )} ${monto >= 0 ? "+" : ""}${monto
          .toFixed(2)
          .padStart(10)} ${saldoAnterior.toFixed(2).padStart(11)} ${saldoNuevoBD
          .toFixed(2)
          .padStart(16)} ${saldoNuevoCorrecto
          .toFixed(2)
          .padStart(20)}  ${estado}`
      );

      // Actualizar saldo actual para el siguiente movimiento
      saldoActual = saldoNuevoCorrecto;
    }

    console.log("\n" + "=".repeat(120));
    console.log(`\n📊 RESUMEN:`);
    console.log(`   ✅ Movimientos correctos: ${movimientosCorrectos}`);
    console.log(`   ❌ Movimientos con error: ${movimientosCorregidos}`);
    console.log(`   📝 Total: ${movimientos.length}`);

    if (correcciones.length > 0) {
      console.log(`\n🔧 CORRECCIONES A APLICAR:\n`);
      correcciones.forEach((c, idx) => {
        console.log(
          `   ${idx + 1}. Movimiento ${c.id.substring(
            0,
            8
          )}... : $${c.saldoNuevoActual.toFixed(
            2
          )} → $${c.saldoNuevoCorrecto.toFixed(2)} (diferencia: $${(
            c.saldoNuevoCorrecto - c.saldoNuevoActual
          ).toFixed(2)})`
        );
      });

      // Preguntar si aplicar correcciones
      console.log(
        `\n⚠️  ¿Deseas aplicar estas correcciones a la base de datos?`
      );
      console.log(
        `   Esto actualizará ${correcciones.length} registros en MovimientoSaldo`
      );
      console.log(
        `\n   Para aplicar, ejecuta: npx tsx server/scripts/fix-amazonas-saldos.ts --apply\n`
      );

      // Si se pasa --apply, aplicar las correcciones
      if (process.argv.includes("--apply")) {
        console.log(`\n🚀 APLICANDO CORRECCIONES...\n`);

        for (const correccion of correcciones) {
          await prisma.movimientoSaldo.update({
            where: { id: correccion.id },
            data: { saldo_nuevo: correccion.saldoNuevoCorrecto },
          });
          console.log(
            `   ✅ Actualizado ${correccion.id.substring(
              0,
              8
            )}... : $${correccion.saldoNuevoCorrecto.toFixed(2)}`
          );
        }

        // Actualizar el saldo final en la tabla Saldo
        const saldoFinal = saldoActual;
        await prisma.saldo.update({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: usd.id,
            },
          },
          data: { cantidad: saldoFinal },
        });

        console.log(
          `\n   ✅ Saldo final actualizado en tabla Saldo: $${saldoFinal.toFixed(
            2
          )}`
        );
        console.log(`\n✅ CORRECCIONES APLICADAS EXITOSAMENTE\n`);
      }
    } else {
      console.log(
        `\n✅ No se encontraron errores. Todos los saldos están correctos.\n`
      );
    }

    // Mostrar saldo final
    console.log(`\n💰 SALDO FINAL CORRECTO: $${saldoActual.toFixed(2)}`);
    console.log(`   Efectivo físico contado: $79.17`);
    console.log(`   Diferencia: $${(saldoActual - 79.17).toFixed(2)}\n`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAmazonasSaldos();
