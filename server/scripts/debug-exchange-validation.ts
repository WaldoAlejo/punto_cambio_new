import prisma from "../lib/prisma.js";

async function debugExchangeValidation() {
  try {
    // Simular la petición del usuario
    const requestBody = {
      tipo_operacion: "COMPRA", // COMPRA de EUR (el punto compra EUR del cliente)
      moneda_origen_id: "", // EUR (lo que el cliente ENTREGA)
      moneda_destino_id: "", // USD (lo que el cliente RECIBE)
      monto_origen: 250, // 250 EUR
      monto_destino: 275, // 275 USD
    };

    // Buscar AMAZONAS
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: { contains: "AMAZONAS", mode: "insensitive" } },
    });

    if (!punto) {
      console.log("❌ No se encontró AMAZONAS");
      return;
    }

    // Buscar monedas
    const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
    const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });

    if (!usd || !eur) {
      console.log("❌ No se encontraron las monedas");
      return;
    }

    requestBody.moneda_origen_id = eur.id;
    requestBody.moneda_destino_id = usd.id;

    console.log("📋 PETICIÓN ORIGINAL:");
    console.log(`   Tipo operación: ${requestBody.tipo_operacion}`);
    console.log(`   Moneda origen: EUR (${eur.id})`);
    console.log(`   Moneda destino: USD (${usd.id})`);
    console.log(`   Monto origen: ${requestBody.monto_origen} EUR`);
    console.log(`   Monto destino: ${requestBody.monto_destino} USD`);

    // Simular la normalización del middleware (líneas 304-341)
    let moneda_origen_id = requestBody.moneda_origen_id;
    let moneda_destino_id = requestBody.moneda_destino_id;
    let monto_origen = requestBody.monto_origen;
    let monto_destino = requestBody.monto_destino;

    const isCompra = requestBody.tipo_operacion === "COMPRA";
    const isVenta = requestBody.tipo_operacion === "VENTA";

    console.log("\n🔄 NORMALIZACIÓN DEL MIDDLEWARE:");
    console.log(`   ¿Es COMPRA? ${isCompra}`);
    console.log(`   ¿Es VENTA? ${isVenta}`);
    console.log(`   ¿USD está como origen? ${moneda_origen_id === usd.id}`);
    console.log(`   ¿USD está como destino? ${moneda_destino_id === usd.id}`);

    // Si es COMPRA y USD está como DESTINO, invertir (línea 322-328)
    // (el cliente entrega divisa y recibe USD, el punto entrega USD)
    if (isCompra && moneda_destino_id === usd.id) {
      console.log(
        "   ⚠️  SE INVIERTE - COMPRA con USD destino (el punto entrega USD)"
      );
      [moneda_origen_id, moneda_destino_id] = [
        moneda_destino_id,
        moneda_origen_id,
      ];
      [monto_origen, monto_destino] = [monto_destino, monto_origen];
    }
    // Si es VENTA y USD está como ORIGEN, invertir (línea 331-337)
    // (el cliente entrega USD y recibe divisa, el punto entrega divisa)
    else if (isVenta && moneda_origen_id === usd.id) {
      console.log(
        "   ⚠️  SE INVIERTE - VENTA con USD origen (el punto entrega divisa)"
      );
      [moneda_origen_id, moneda_destino_id] = [
        moneda_destino_id,
        moneda_origen_id,
      ];
      [monto_origen, monto_destino] = [monto_destino, monto_origen];
    } else {
      console.log("   ✅ NO SE INVIERTE - Las monedas quedan como están");
    }

    console.log("\n📋 DESPUÉS DE NORMALIZACIÓN:");
    console.log(
      `   Moneda origen: ${
        moneda_origen_id === usd.id ? "USD" : "EUR"
      } (${moneda_origen_id})`
    );
    console.log(
      `   Moneda destino: ${
        moneda_destino_id === usd.id ? "USD" : "EUR"
      } (${moneda_destino_id})`
    );
    console.log(`   Monto origen: ${monto_origen}`);
    console.log(`   Monto destino: ${monto_destino}`);

    // Obtener saldos actuales
    const saldoUSD = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: usd.id,
        },
      },
    });

    const saldoEUR = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: eur.id,
        },
      },
    });

    console.log("\n💰 SALDOS ACTUALES:");
    console.log(`   USD: $${Number(saldoUSD?.cantidad || 0).toFixed(2)}`);
    console.log(`   EUR: €${Number(saldoEUR?.cantidad || 0).toFixed(2)}`);

    console.log("\n🔍 VALIDACIÓN:");
    console.log(
      `   Moneda a validar: ${moneda_origen_id === usd.id ? "USD" : "EUR"}`
    );
    console.log(`   Monto requerido: ${monto_origen}`);
    console.log(
      `   Saldo disponible: ${
        moneda_origen_id === usd.id
          ? Number(saldoUSD?.cantidad || 0).toFixed(2)
          : Number(saldoEUR?.cantidad || 0).toFixed(2)
      }`
    );

    const saldoActual =
      moneda_origen_id === usd.id
        ? Number(saldoUSD?.cantidad || 0)
        : Number(saldoEUR?.cantidad || 0);

    if (saldoActual < monto_origen) {
      console.log("\n❌ VALIDACIÓN FALLA:");
      console.log(`   Saldo actual: ${saldoActual.toFixed(2)}`);
      console.log(`   Monto requerido: ${monto_origen}`);
      console.log(`   Déficit: ${(monto_origen - saldoActual).toFixed(2)}`);
      console.log("\n   Error: SALDO_INSUFICIENTE_CAMBIO");
    } else {
      console.log("\n✅ VALIDACIÓN PASA:");
      console.log(`   Saldo actual: ${saldoActual.toFixed(2)}`);
      console.log(`   Monto requerido: ${monto_origen}`);
      console.log(`   Sobrante: ${(saldoActual - monto_origen).toFixed(2)}`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugExchangeValidation();
