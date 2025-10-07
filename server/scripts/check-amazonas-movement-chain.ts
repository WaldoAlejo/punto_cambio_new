import prisma from "../lib/prisma.js";

/**
 * Script para verificar la CADENA DE MOVIMIENTOS en AMAZONAS
 * Detecta si hay saltos donde saldo_anterior != saldo_nuevo del movimiento anterior
 */

async function checkAmazonasMovementChain() {
  try {
    console.log("🔗 VERIFICACIÓN DE CADENA DE MOVIMIENTOS - AMAZONAS USD\n");

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

    console.log(`📋 Total de movimientos: ${movimientos.length}\n`);

    // 4. Verificar la cadena
    console.log("🔍 VERIFICANDO CADENA DE MOVIMIENTOS:\n");
    console.log(
      "MOV  FECHA       HORA     TIPO            MONTO      SALDO_ANT  SALDO_NUEVO  ESPERADO_ANT  ESTADO"
    );
    console.log("=".repeat(120));

    let cadenaRota = 0;
    let cadenaOK = 0;
    let saldoEsperado = 0;

    for (let i = 0; i < movimientos.length; i++) {
      const m = movimientos[i];
      const monto = Number(m.monto);
      const saldoAnterior = Number(m.saldo_anterior);
      const saldoNuevo = Number(m.saldo_nuevo);

      // Para el primer movimiento, el saldo_anterior debería ser 0 o el saldo inicial
      let esperadoAnterior =
        i === 0 ? 0 : Number(movimientos[i - 1].saldo_nuevo);

      // Verificar si la cadena está rota
      const diferencia = Math.abs(saldoAnterior - esperadoAnterior);
      const cadenaCorrecta = diferencia < 0.01;

      let estado = "✅ OK";
      if (!cadenaCorrecta) {
        estado = `❌ ROTA (Δ $${(saldoAnterior - esperadoAnterior).toFixed(
          2
        )})`;
        cadenaRota++;
      } else {
        cadenaOK++;
      }

      // Verificar también que saldo_nuevo = saldo_anterior + monto
      const saldoNuevoCalculado = saldoAnterior + monto;
      const calculoCorrecto = Math.abs(saldoNuevo - saldoNuevoCalculado) < 0.01;

      if (!calculoCorrecto) {
        estado += ` | ⚠️ CÁLCULO INCORRECTO`;
      }

      const fecha = m.fecha.toISOString().split("T")[0];
      const hora = m.fecha.toISOString().split("T")[1].substring(0, 8);

      console.log(
        `${String(i + 1).padStart(
          3
        )}  ${fecha} ${hora} ${m.tipo_movimiento.padEnd(15)} ${
          monto >= 0 ? "+" : ""
        }${monto.toFixed(2).padStart(10)} ${saldoAnterior
          .toFixed(2)
          .padStart(11)} ${saldoNuevo
          .toFixed(2)
          .padStart(12)} ${esperadoAnterior.toFixed(2).padStart(13)}  ${estado}`
      );

      saldoEsperado = saldoNuevo;
    }

    console.log("\n" + "=".repeat(120));
    console.log(`\n📊 RESUMEN DE CADENA:\n`);
    console.log(`   ✅ Enlaces correctos: ${cadenaOK}`);
    console.log(`   ❌ Enlaces rotos: ${cadenaRota}`);
    console.log(`   📝 Total: ${movimientos.length}`);

    if (cadenaRota > 0) {
      console.log(`\n⚠️  La cadena de movimientos tiene ${cadenaRota} saltos`);
      console.log(
        `   Esto indica que hubo movimientos eliminados o saldos modificados manualmente\n`
      );
    } else {
      console.log(`\n✅ La cadena de movimientos es continua y correcta\n`);
    }

    // Mostrar saldo final
    const ultimoMovimiento = movimientos[movimientos.length - 1];
    if (ultimoMovimiento) {
      console.log(
        `💰 Saldo final en BD: $${Number(ultimoMovimiento.saldo_nuevo).toFixed(
          2
        )}`
      );
      console.log(`   Efectivo físico: $79.17`);
      console.log(
        `   Diferencia: $${(
          Number(ultimoMovimiento.saldo_nuevo) - 79.17
        ).toFixed(2)}\n`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAmazonasMovementChain();
