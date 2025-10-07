import prisma from "../lib/prisma.js";

/**
 * Script para buscar evidencia de movimientos eliminados
 * Busca en CambioDivisa transacciones que deberían haber generado movimientos
 */

async function findDeletedMovements() {
  try {
    console.log("🔍 BUSCANDO MOVIMIENTOS ELIMINADOS - AMAZONAS USD\n");

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

    // 3. Buscar transacciones en el período crítico
    console.log(
      "🕐 PERÍODO CRÍTICO #1: 6 oct 7:47 PM - 8:27 PM (salto +$500)\n"
    );

    const periodo1Inicio = new Date("2025-10-06T19:47:00");
    const periodo1Fin = new Date("2025-10-06T20:27:00");

    const transacciones1 = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: periodo1Inicio,
          lte: periodo1Fin,
        },
        OR: [{ moneda_origen_id: usd.id }, { moneda_destino_id: usd.id }],
      },
      orderBy: { fecha: "asc" },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
      },
    });

    console.log(`📋 Transacciones encontradas: ${transacciones1.length}\n`);

    if (transacciones1.length > 0) {
      console.log(
        "FECHA       HORA     ORIGEN → DESTINO      MONTO ORIGEN  MONTO DESTINO"
      );
      console.log("=".repeat(90));

      for (const t of transacciones1) {
        const fecha = t.fecha.toISOString().split("T")[0];
        const hora = t.fecha.toISOString().split("T")[1].substring(0, 8);

        console.log(
          `${fecha} ${hora} ${t.monedaOrigen.codigo} → ${
            t.monedaDestino.codigo
          }  ${Number(t.monto_origen).toFixed(2).padStart(13)}  ${Number(
            t.monto_destino
          )
            .toFixed(2)
            .padStart(13)}`
        );

        // Verificar si existe el movimiento correspondiente
        const movimientoOrigen = await prisma.movimientoSaldo.findFirst({
          where: {
            referencia_id: t.id,
            tipo_referencia: "EXCHANGE",
            moneda_id: t.moneda_origen_id,
          },
        });

        const movimientoDestino = await prisma.movimientoSaldo.findFirst({
          where: {
            referencia_id: t.id,
            tipo_referencia: "EXCHANGE",
            moneda_id: t.moneda_destino_id,
          },
        });

        if (!movimientoOrigen) {
          console.log(
            `   ⚠️  FALTA movimiento EGRESO de ${
              t.moneda_origen.codigo
            } por $${Number(t.monto_origen).toFixed(2)}`
          );
        }
        if (!movimientoDestino) {
          console.log(
            `   ⚠️  FALTA movimiento INGRESO de ${
              t.moneda_destino.codigo
            } por $${Number(t.monto_destino).toFixed(2)}`
          );
        }
      }
    }

    console.log("\n" + "=".repeat(90));
    console.log(
      "\n🕐 PERÍODO CRÍTICO #2: 6 oct 9:01 PM - 7 oct 2:25 PM (salto -$500)\n"
    );

    const periodo2Inicio = new Date("2025-10-06T21:01:00");
    const periodo2Fin = new Date("2025-10-07T14:25:00");

    const transacciones2 = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: periodo2Inicio,
          lte: periodo2Fin,
        },
        OR: [{ moneda_origen_id: usd.id }, { moneda_destino_id: usd.id }],
      },
      orderBy: { fecha: "asc" },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
      },
    });

    console.log(`📋 Transacciones encontradas: ${transacciones2.length}\n`);

    if (transacciones2.length > 0) {
      console.log(
        "FECHA       HORA     ORIGEN → DESTINO      MONTO ORIGEN  MONTO DESTINO"
      );
      console.log("=".repeat(90));

      for (const t of transacciones2) {
        const fecha = t.fecha.toISOString().split("T")[0];
        const hora = t.fecha.toISOString().split("T")[1].substring(0, 8);

        console.log(
          `${fecha} ${hora} ${t.monedaOrigen.codigo} → ${
            t.monedaDestino.codigo
          }  ${Number(t.monto_origen).toFixed(2).padStart(13)}  ${Number(
            t.monto_destino
          )
            .toFixed(2)
            .padStart(13)}`
        );

        // Verificar si existe el movimiento correspondiente
        const movimientoOrigen = await prisma.movimientoSaldo.findFirst({
          where: {
            referencia_id: t.id,
            tipo_referencia: "EXCHANGE",
            moneda_id: t.moneda_origen_id,
          },
        });

        const movimientoDestino = await prisma.movimientoSaldo.findFirst({
          where: {
            referencia_id: t.id,
            tipo_referencia: "EXCHANGE",
            moneda_id: t.moneda_destino_id,
          },
        });

        if (!movimientoOrigen) {
          console.log(
            `   ⚠️  FALTA movimiento EGRESO de ${
              t.moneda_origen.codigo
            } por $${Number(t.monto_origen).toFixed(2)}`
          );
        }
        if (!movimientoDestino) {
          console.log(
            `   ⚠️  FALTA movimiento INGRESO de ${
              t.moneda_destino.codigo
            } por $${Number(t.monto_destino).toFixed(2)}`
          );
        }
      }
    }

    console.log("\n" + "=".repeat(90));

    // 4. Buscar TODOS los movimientos de USD en AMAZONAS y verificar referencias
    console.log("\n🔍 VERIFICANDO TODAS LAS REFERENCIAS...\n");

    const todosMovimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
      },
      orderBy: { fecha: "asc" },
    });

    let referenciasFaltantes = 0;

    for (const m of todosMovimientos) {
      if (m.tipo_referencia === "EXCHANGE" && m.referencia_id) {
        const transaccion = await prisma.cambioDivisa.findUnique({
          where: { id: m.referencia_id },
        });

        if (!transaccion) {
          const fecha = m.fecha.toISOString().split("T")[0];
          const hora = m.fecha.toISOString().split("T")[1].substring(0, 8);
          console.log(
            `⚠️  Movimiento ${fecha} ${hora} ${m.tipo_movimiento} $${Number(
              m.monto
            ).toFixed(2)} - Referencia EXCHANGE no existe: ${m.referencia_id}`
          );
          referenciasFaltantes++;
        }
      }
    }

    if (referenciasFaltantes === 0) {
      console.log("✅ Todas las referencias existen\n");
    } else {
      console.log(`\n❌ ${referenciasFaltantes} referencias faltantes\n`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findDeletedMovements();
