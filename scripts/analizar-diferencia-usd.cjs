// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analizarDiferenciaUSD() {
  console.log("🔍 ANÁLISIS DE DIFERENCIA USD - PLAZA DEL VALLE");
  console.log("=================================================\n");

  try {
    // 1. Buscar el punto Plaza del Valle
    const punto = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "Plaza del Valle",
          mode: "insensitive",
        },
      },
    });

    if (!punto) {
      console.error("❌ No se encontró el punto Plaza del Valle");
      return;
    }

    // 2. Buscar moneda USD
    const usd = await prisma.moneda.findFirst({
      where: { codigo: "USD" }
    });

    if (!usd) {
      console.error("❌ No se encontró la moneda USD");
      return;
    }

    console.log(`✅ Punto: ${punto.nombre}`);
    console.log(`✅ Moneda: USD\n`);

    // 3. Saldo actual
    const saldoGeneral = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id
      }
    });

    const cantidadSistema = saldoGeneral ? Number(saldoGeneral.cantidad) : 0;
    const cantidadFisica = 1575.51;
    const diferencia = cantidadSistema - cantidadFisica;

    console.log("💰 SALDOS USD:");
    console.log("----------------------------");
    console.log(`  Saldo físico reportado:  $${cantidadFisica.toFixed(2)}`);
    console.log(`  Saldo en sistema:        $${cantidadSistema.toFixed(2)}`);
    console.log(`  Diferencia:              $${diferencia.toFixed(2)}\n`);

    // 4. Buscar movimientos de exactamente $30 en USD
    console.log("🎯 MOVIMIENTOS DE $30.00 USD:");
    console.log("---------------------------------------");

    const movimientos30 = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        monto: 30,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 20,
    });

    if (movimientos30.length > 0) {
      console.log("\n  MOVIMIENTOS DE SALDO GENERAL:");
      for (const mov of movimientos30) {
        console.log(
          `    ${mov.fecha.toISOString().substring(0, 19)} | ${mov.tipo_movimiento.padEnd(
            8
          )} | $${Number(mov.monto).toFixed(2)} | Saldo: ${Number(mov.saldo_anterior).toFixed(2)} → ${Number(mov.saldo_nuevo).toFixed(2)}`
        );
        console.log(`       ${mov.descripcion || "Sin descripción"}`);
      }
    } else {
      console.log("\n  No hay movimientos de exactamente $30 en saldo general");
    }

    // 5. Servicios externos
    const servicios30 = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        monto: 30,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 20,
    });

    if (servicios30.length > 0) {
      console.log("\n  SERVICIOS EXTERNOS:");
      for (const mov of servicios30) {
        console.log(
          `    ${mov.fecha.toISOString().substring(0, 19)} | ${mov.servicio.padEnd(
            15
          )} | ${mov.tipo_movimiento.padEnd(8)} | $${Number(mov.monto).toFixed(2)}`
        );
        console.log(`       ${mov.descripcion || "Sin descripción"}`);
      }
    } else {
      console.log("\n  No hay movimientos de $30 en servicios externos");
    }

    // 6. Buscar todos los movimientos recientes en USD
    const dosHorasAtras = new Date();
    dosHorasAtras.setHours(dosHorasAtras.getHours() - 48);

    console.log("\n\n📋 TODOS LOS MOVIMIENTOS USD (últimas 48 horas):");
    console.log("-----------------------------------------------");

    const todosMovimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usd.id,
        fecha: {
          gte: dosHorasAtras,
        },
      },
      orderBy: {
        fecha: "desc",
      },
      take: 50,
    });

    if (todosMovimientos.length > 0) {
      for (const mov of todosMovimientos) {
        const signo = mov.tipo_movimiento === "INGRESO" ? "+" : "-";
        console.log(
          `  ${mov.fecha.toISOString().substring(0, 19)} | ${mov.tipo_movimiento.padEnd(
            8
          )} | ${signo}$${Number(mov.monto).toFixed(2).padStart(10)} | Saldo: $${Number(mov.saldo_nuevo).toFixed(2)}`
        );
        if (mov.descripcion) {
          console.log(`     ${mov.descripcion}`);
        }
      }
    } else {
      console.log("  No hay movimientos recientes");
    }

    // 7. Cambios que involucran USD
    console.log("\n\n💱 CAMBIOS CON USD (últimas 48 horas):");
    console.log("----------------------------------------");

    const cambiosUSD = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: punto.id,
        fecha: {
          gte: dosHorasAtras,
        },
        OR: [
          { moneda_origen_id: usd.id },
          { moneda_destino_id: usd.id }
        ]
      },
      include: {
        monedaOrigen: true,
        monedaDestino: true,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 20,
    });

    if (cambiosUSD.length > 0) {
      for (const cambio of cambiosUSD) {
        console.log(
          `\n  ${cambio.fecha.toISOString().substring(0, 19)} | Estado: ${cambio.estado}`
        );
        console.log(
          `    Cliente entrega: ${Number(cambio.divisas_entregadas_total)} ${cambio.monedaOrigen.codigo}`
        );
        console.log(
          `    Cliente recibe:  ${Number(cambio.divisas_recibidas_total)} ${cambio.monedaDestino.codigo}`
        );
        console.log(
          `    Tasa: ${Number(cambio.tasa_cambio_billetes || cambio.tasa_cambio_monedas)}`
        );
        
        if (cambio.estado === "ANULADO") {
          console.log(`    ⚠️  ANULADO`);
        }
        if (cambio.observacion) {
          console.log(`    Obs: ${cambio.observacion}`);
        }
      }
    } else {
      console.log("  No hay cambios con USD");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

analizarDiferenciaUSD();
