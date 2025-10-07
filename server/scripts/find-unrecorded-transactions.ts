import prisma from "../lib/prisma.js";

async function findUnrecordedTransactions() {
  try {
    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró el punto AMAZONAS");
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

    console.log("\n" + "=".repeat(80));
    console.log("🔍 BÚSQUEDA DE TRANSACCIONES NO REGISTRADAS - AMAZONAS USD");
    console.log("=".repeat(80));

    // 1. Buscar transacciones de cambio que involucren AMAZONAS
    console.log("\n📊 1. TRANSACCIONES DE CAMBIO (Tabla CambioDivisa):");
    console.log("-".repeat(80));

    const transacciones = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: new Date("2025-10-06"),
          lte: new Date("2025-10-08"),
        },
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
        usuario: true,
      },
      orderBy: { fecha: "asc" },
    });

    if (transacciones.length === 0) {
      console.log("   ℹ️  No se encontraron transacciones de cambio");
    } else {
      console.log(`   Total: ${transacciones.length} transacciones\n`);

      let totalUsdEntregado = 0;
      let totalUsdRecibido = 0;

      transacciones.forEach((t, i) => {
        const fecha = new Date(t.fecha).toLocaleString("es-EC");
        console.log(`   ${i + 1}. ${fecha}`);
        console.log(
          `      ${t.monedaOrigen.codigo} → ${t.monedaDestino.codigo}`
        );
        console.log(
          `      Monto origen: ${t.monto_origen} | Monto destino: ${t.monto_destino}`
        );
        console.log(`      Usuario: ${t.usuario.nombre}`);

        // Contar USD entregado o recibido
        if (t.monedaOrigen.codigo === "USD") {
          totalUsdEntregado += Number(t.monto_origen);
          console.log(`      ⬇️  USD ENTREGADO: $${t.monto_origen}`);
        }
        if (t.monedaDestino.codigo === "USD") {
          totalUsdRecibido += Number(t.monto_destino);
          console.log(`      ⬆️  USD RECIBIDO: $${t.monto_destino}`);
        }
        console.log();
      });

      console.log(
        `   📉 Total USD entregado (egresos): $${totalUsdEntregado.toFixed(2)}`
      );
      console.log(
        `   📈 Total USD recibido (ingresos): $${totalUsdRecibido.toFixed(2)}`
      );
      console.log(
        `   💰 Efecto neto en USD: $${(
          totalUsdRecibido - totalUsdEntregado
        ).toFixed(2)}`
      );
    }

    // 2. Buscar movimientos de saldo en el período crítico
    console.log("\n📊 2. MOVIMIENTOS DE SALDO REGISTRADOS:");
    console.log("-".repeat(80));

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        fecha: {
          gte: new Date("2025-10-06"),
          lte: new Date("2025-10-08"),
        },
      },
      include: {
        usuario: true,
      },
      orderBy: { created_at: "asc" },
    });

    console.log(`   Total: ${movimientos.length} movimientos\n`);

    let totalIngresos = 0;
    let totalEgresos = 0;

    movimientos.forEach((m, i) => {
      const fecha = new Date(m.fecha).toLocaleString("es-EC");
      const createdAt = new Date(m.created_at).toLocaleString("es-EC");
      const monto = Number(m.monto);

      console.log(`   ${i + 1}. [${m.tipo_movimiento}] ${fecha}`);
      console.log(`      Monto: $${monto.toFixed(2)}`);
      console.log(
        `      Saldo: $${Number(m.saldo_anterior).toFixed(2)} → $${Number(
          m.saldo_nuevo
        ).toFixed(2)}`
      );
      console.log(`      Usuario: ${m.usuario.nombre}`);
      console.log(`      Descripción: ${m.descripcion || "N/A"}`);
      console.log(`      Creado: ${createdAt}`);

      if (m.tipo_movimiento === "INGRESO") {
        totalIngresos += monto;
      } else if (m.tipo_movimiento === "EGRESO") {
        totalEgresos += Math.abs(monto);
      }
      console.log();
    });

    console.log(`   📈 Total ingresos: $${totalIngresos.toFixed(2)}`);
    console.log(`   📉 Total egresos: $${totalEgresos.toFixed(2)}`);

    // 3. Comparar transacciones vs movimientos
    console.log("\n📊 3. ANÁLISIS DE COHERENCIA:");
    console.log("-".repeat(80));

    // Cada transacción debería generar movimientos de saldo
    console.log(`   Transacciones de cambio: ${transacciones.length}`);
    console.log(`   Movimientos de saldo: ${movimientos.length}`);

    // Buscar transacciones que no tengan movimiento correspondiente
    console.log(
      "\n   🔎 Verificando si cada transacción tiene su movimiento..."
    );

    for (const trans of transacciones) {
      const tieneMovimiento = movimientos.some((m) => {
        const diffMs = Math.abs(
          new Date(m.fecha).getTime() - new Date(trans.fecha).getTime()
        );
        const diffMinutes = diffMs / (1000 * 60);

        // Buscar movimiento cercano en tiempo
        if (diffMinutes > 5) return false;

        // Verificar si el monto coincide
        if (trans.monedaOrigen.codigo === "USD") {
          return Math.abs(Number(m.monto)) === Number(trans.monto_origen);
        }
        if (trans.monedaDestino.codigo === "USD") {
          return Number(m.monto) === Number(trans.monto_destino);
        }

        return false;
      });

      if (!tieneMovimiento) {
        console.log(`   ⚠️  TRANSACCIÓN SIN MOVIMIENTO:`);
        console.log(`      ID: ${trans.id}`);
        console.log(
          `      Fecha: ${new Date(trans.fecha).toLocaleString("es-EC")}`
        );
        console.log(
          `      ${trans.monedaOrigen.codigo} ${trans.monto_origen} → ${trans.monedaDestino.codigo} ${trans.monto_destino}`
        );
      }
    }

    // 4. Resumen final
    console.log("\n📊 4. RESUMEN Y CONCLUSIONES:");
    console.log("-".repeat(80));

    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    console.log(
      `   💵 Saldo en sistema: $${Number(saldoActual?.cantidad || 0).toFixed(
        2
      )}`
    );
    console.log(`   💵 Efectivo físico: $79.17`);
    console.log(
      `   ⚠️  Faltante: $${(Number(saldoActual?.cantidad || 0) - 79.17).toFixed(
        2
      )}`
    );

    console.log(`\n   📝 Posibles causas del faltante:`);
    console.log(`      • Retiros no registrados en el sistema`);
    console.log(
      `      • Depósitos bancarios registrados como EGRESO pero dinero aún en caja`
    );
    console.log(`      • Errores en el conteo físico`);
    console.log(
      `      • Transacciones registradas pero dinero no entregado/recibido`
    );
    console.log(`      • Robo o pérdida de efectivo`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findUnrecordedTransactions();
