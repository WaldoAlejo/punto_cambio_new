/**
 * ANÁLISIS COMPLETO DE TODAS LAS TRANSACCIONES
 * Verifica que todo esté correctamente reflejado en los movimientos de saldo
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valores físicos reportados al final del 9/4
const SALDO_FINAL_REPORTADO = {
  USD: 4021.46,
  EUR: 52.74,
};

async function main() {
  console.log("=".repeat(100));
  console.log("ANÁLISIS COMPLETO DE TRANSACCIONES - PLAZA DEL VALLE - 9/4/2026");
  console.log("=".repeat(100));

  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`\n📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  // ============================================
  // 1. CAMBIOS DE DIVISA
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("1️⃣  CAMBIOS DE DIVISA");
  console.log("=".repeat(100));

  const cambios9Abril = await prisma.cambioDivisa.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\nTotal cambios de divisa: ${cambios9Abril.length}`);

  const resumenCambios: Record<string, { ingresos: number; egresos: number }> = {};

  for (const cambio of cambios9Abril) {
    const hora = new Date(cambio.fecha).toLocaleTimeString('es-EC', { hour12: true });
    const origen = cambio.monedaOrigen.codigo;
    const destino = cambio.monedaDestino.codigo;
    const montoOrigen = Number(cambio.monto_origen);
    const montoDestino = Number(cambio.monto_destino);

    if (!resumenCambios[origen]) resumenCambios[origen] = { ingresos: 0, egresos: 0 };
    if (!resumenCambios[destino]) resumenCambios[destino] = { ingresos: 0, egresos: 0 };

    console.log(`\n   ${hora} | ${cambio.numero_recibo}`);
    console.log(`      Operación: ${cambio.tipo_operacion}`);
    console.log(`      Origen: ${montoOrigen.toFixed(2)} ${origen} → Destino: ${montoDestino.toFixed(2)} ${destino}`);
    console.log(`      Estado: ${cambio.estado}`);

    // Si es COMPRA: ingresa divisa origen, egresa USD
    // Si es VENTA: ingresa USD, egresa divisa destino
    if (cambio.tipo_operacion === "COMPRA") {
      // Cliente vende divisa extranjera, compra USD
      if (origen !== "USD") {
        resumenCambios[origen].ingresos += montoOrigen;
        console.log(`      → Ingreso ${origen}: +${montoOrigen.toFixed(2)}`);
      }
      if (destino === "USD") {
        resumenCambios.USD.egresos += montoDestino;
        console.log(`      → Egreso USD: -${montoDestino.toFixed(2)}`);
      }
    } else if (cambio.tipo_operacion === "VENTA") {
      // Cliente compra divisa extranjera, vende USD
      if (origen === "USD") {
        resumenCambios.USD.ingresos += montoOrigen;
        console.log(`      → Ingreso USD: +${montoOrigen.toFixed(2)}`);
      }
      if (destino !== "USD") {
        resumenCambios[destino].egresos += montoDestino;
        console.log(`      → Egreso ${destino}: -${montoDestino.toFixed(2)}`);
      }
    }
  }

  console.log("\n   📊 RESUMEN CAMBIOS DE DIVISA:");
  for (const [moneda, datos] of Object.entries(resumenCambios)) {
    console.log(`      ${moneda}: Ingresos +${datos.ingresos.toFixed(2)}, Egresos -${datos.egresos.toFixed(2)}`);
  }

  // ============================================
  // 2. TRANSFERENCIAS
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("2️⃣  TRANSFERENCIAS ENTRE PUNTOS");
  console.log("=".repeat(100));

  const transferenciasEnviadas = await prisma.transferencia.findMany({
    where: {
      origen_id: punto.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
      estado: "COMPLETADO",
    },
    include: { moneda: true },
  });

  const transferenciasRecibidas = await prisma.transferencia.findMany({
    where: {
      destino_id: punto.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
      estado: "COMPLETADO",
    },
    include: { moneda: true },
  });

  console.log(`\nTransferencias ENVIADAS: ${transferenciasEnviadas.length}`);
  for (const t of transferenciasEnviadas) {
    console.log(`   - ${t.moneda.codigo}: -${Number(t.monto).toFixed(2)}`);
  }

  console.log(`\nTransferencias RECIBIDAS: ${transferenciasRecibidas.length}`);
  for (const t of transferenciasRecibidas) {
    console.log(`   - ${t.moneda.codigo}: +${Number(t.monto).toFixed(2)}`);
  }

  // ============================================
  // 3. SERVICIOS EXTERNOS
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("3️⃣  SERVICIOS EXTERNOS (Western, Yaganaste, etc.)");
  console.log("=".repeat(100));

  const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
    },
    include: { moneda: true },
    orderBy: { fecha: "asc" },
  });

  console.log(`\nTotal movimientos servicios externos: ${serviciosExternos.length}`);

  const resumenServicios: Record<string, { ingresos: number; egresos: number }> = {};

  for (const serv of serviciosExternos) {
    const moneda = serv.moneda.codigo;
    if (!resumenServicios[moneda]) {
      resumenServicios[moneda] = { ingresos: 0, egresos: 0 };
    }

    const monto = Number(serv.monto);
    if (serv.tipo_movimiento === "INGRESO") {
      resumenServicios[moneda].ingresos += monto;
    } else if (serv.tipo_movimiento === "EGRESO") {
      resumenServicios[moneda].egresos += monto;
    }

    const hora = new Date(serv.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`   ${hora} | ${serv.servicio} | ${serv.tipo_movimiento} | ${monto.toFixed(2)} ${moneda}`);
  }

  console.log("\n   📊 RESUMEN SERVICIOS EXTERNOS:");
  for (const [moneda, datos] of Object.entries(resumenServicios)) {
    console.log(`      ${moneda}: Ingresos +${datos.ingresos.toFixed(2)}, Egresos -${datos.egresos.toFixed(2)}`);
  }

  // ============================================
  // 4. MOVIMIENTOS DE SALDO (Tabla MovimientoSaldo)
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("4️⃣  MOVIMIENTOS DE SALDO (Tabla MovimientoSaldo)");
  console.log("=".repeat(100));

  const monedas = await prisma.moneda.findMany({
    where: { codigo: { in: ["USD", "EUR"] } },
  });

  const resumenMovimientos: Record<string, { ingresos: number; egresos: number; ajustes: number }> = {};

  for (const moneda of monedas) {
    console.log(`\n💱 ${moneda.codigo}:`);

    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
    });

    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustes = 0;

    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      if (mov.tipo_movimiento === "INGRESO") {
        totalIngresos += monto;
      } else if (mov.tipo_movimiento === "EGRESO") {
        totalEgresos += monto;
      } else if (mov.tipo_movimiento === "AJUSTE") {
        totalAjustes += monto;
      }
    }

    resumenMovimientos[moneda.codigo] = { ingresos: totalIngresos, egresos: totalEgresos, ajustes: totalAjustes };

    console.log(`   Total movimientos: ${movimientos.length}`);
    console.log(`   INGRESOS: +${totalIngresos.toFixed(2)}`);
    console.log(`   EGRESOS: -${totalEgresos.toFixed(2)}`);
    console.log(`   AJUSTES: ${totalAjustes >= 0 ? "+" : ""}${totalAjustes.toFixed(2)}`);
    console.log(`   RESULTADO NETO: ${(totalIngresos - totalEgresos + totalAjustes).toFixed(2)}`);
  }

  // ============================================
  // 5. COMPARACIÓN Y VERIFICACIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("5️⃣  VERIFICACIÓN: ¿Coinciden los movimientos con las transacciones?");
  console.log("=".repeat(100));

  for (const moneda of monedas) {
    console.log(`\n💱 ${moneda.codigo}:`);

    // Calcular totales por tipo de transacción
    const cambiosIngresos = resumenCambios[moneda.codigo]?.ingresos || 0;
    const cambiosEgresos = resumenCambios[moneda.codigo]?.egresos || 0;

    const serviciosIngresos = resumenServicios[moneda.codigo]?.ingresos || 0;
    const serviciosEgresos = resumenServicios[moneda.codigo]?.egresos || 0;

    // Transferencias
    let transIngresos = 0;
    let transEgresos = 0;
    for (const t of transferenciasRecibidas) {
      if (t.moneda.codigo === moneda.codigo) transIngresos += Number(t.monto);
    }
    for (const t of transferenciasEnviadas) {
      if (t.moneda.codigo === moneda.codigo) transEgresos += Number(t.monto);
    }

    // Totales esperados
    const totalEsperadoIngresos = cambiosIngresos + serviciosIngresos + transIngresos;
    const totalEsperadoEgresos = cambiosEgresos + serviciosEgresos + transEgresos;

    // Totales en MovimientoSaldo
    const totalMovIngresos = resumenMovimientos[moneda.codigo]?.ingresos || 0;
    const totalMovEgresos = resumenMovimientos[moneda.codigo]?.egresos || 0;

    console.log(`\n   INGRESOS:`);
    console.log(`      Cambios de divisa: +${cambiosIngresos.toFixed(2)}`);
    console.log(`      Servicios externos: +${serviciosIngresos.toFixed(2)}`);
    console.log(`      Transferencias recibidas: +${transIngresos.toFixed(2)}`);
    console.log(`      ─────────────────────────`);
    console.log(`      TOTAL ESPERADO: +${totalEsperadoIngresos.toFixed(2)}`);
    console.log(`      TOTAL EN MOVIMIENTOSALDO: +${totalMovIngresos.toFixed(2)}`);
    const difIngresos = totalMovIngresos - totalEsperadoIngresos;
    console.log(`      DIFERENCIA: ${difIngresos >= 0 ? "+" : ""}${difIngresos.toFixed(2)} ${Math.abs(difIngresos) < 0.01 ? "✅" : "❌"}`);

    console.log(`\n   EGRESOS:`);
    console.log(`      Cambios de divisa: -${cambiosEgresos.toFixed(2)}`);
    console.log(`      Servicios externos: -${serviciosEgresos.toFixed(2)}`);
    console.log(`      Transferencias enviadas: -${transEgresos.toFixed(2)}`);
    console.log(`      ─────────────────────────`);
    console.log(`      TOTAL ESPERADO: -${totalEsperadoEgresos.toFixed(2)}`);
    console.log(`      TOTAL EN MOVIMIENTOSALDO: -${totalMovEgresos.toFixed(2)}`);
    const difEgresos = totalMovEgresos - totalEsperadoEgresos;
    console.log(`      DIFERENCIA: ${difEgresos >= 0 ? "+" : ""}${difEgresos.toFixed(2)} ${Math.abs(difEgresos) < 0.01 ? "✅" : "❌"}`);
  }

  // ============================================
  // 6. CÁLCULO FINAL CON SALDO INICIAL
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("6️⃣  CÁLCULO FINAL (con saldo inicial del día)");
  console.log("=".repeat(100));

  for (const moneda of monedas) {
    console.log(`\n💱 ${moneda.codigo}:`);

    // Buscar saldo inicial del 9/4
    const primerMovimiento = await prisma.movimientoSaldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
        fecha: {
          gte: inicio9Abril,
          lt: fin9Abril,
        },
      },
      orderBy: { fecha: "asc" },
    });

    let saldoInicial = 0;
    if (primerMovimiento) {
      saldoInicial = Number(primerMovimiento.saldo_anterior);
      console.log(`   Saldo inicial (según primer movimiento): ${saldoInicial.toFixed(2)}`);
    } else {
      console.log(`   ⚠️  No se encontró saldo inicial`);
    }

    const movs = resumenMovimientos[moneda.codigo];
    const resultadoDia = movs.ingresos - movs.egresos + movs.ajustes;
    const saldoCalculado = saldoInicial + resultadoDia;

    console.log(`   Resultado del día: ${resultadoDia >= 0 ? "+" : ""}${resultadoDia.toFixed(2)}`);
    console.log(`   ─────────────────────────`);
    console.log(`   SALDO CALCULADO: ${saldoCalculado.toFixed(2)}`);
    console.log(`   SALDO REPORTADO: ${SALDO_FINAL_REPORTADO[moneda.codigo as keyof typeof SALDO_FINAL_REPORTADO].toFixed(2)}`);
    
    const diferencia = saldoCalculado - SALDO_FINAL_REPORTADO[moneda.codigo as keyof typeof SALDO_FINAL_REPORTADO];
    console.log(`   DIFERENCIA: ${diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}`);

    if (Math.abs(diferencia) < 0.01) {
      console.log(`   ✅ CUADRA PERFECTAMENTE`);
    } else {
      console.log(`   ❌ NO CUADRA`);
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("ANÁLISIS COMPLETADO");
  console.log("=".repeat(100));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
