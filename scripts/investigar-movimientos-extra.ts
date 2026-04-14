/**
 * INVESTIGACIÓN DETALLADA DE MOVIMIENTOS EXTRA
 * Revisa cada movimiento de USD para identificar los $800.00 extra
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("INVESTIGACIÓN DETALLADA - MOVIMIENTOS USD EXTRA");
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

  console.log(`\n📍 Punto: ${punto.nombre}\n`);

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  // Obtener moneda USD
  const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
  if (!usd) {
    console.error("❌ No se encontró USD");
    return;
  }

  // ============================================
  // 1. TODOS LOS MOVIMIENTOS USD DEL 9/4
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("1️⃣  TODOS LOS MOVIMIENTOS USD DEL 9/4/2026");
  console.log("=".repeat(100));

  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: usd.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\nTotal movimientos: ${movimientos.length}\n`);
  console.log(`${"#".padEnd(4)} | ${"Hora".padEnd(12)} | ${"Tipo".padEnd(10)} | ${"Monto".padStart(12)} | ${"Saldo Ant".padStart(12)} | ${"Saldo Nuev".padStart(12)} | Descripción`);
  console.log("-".repeat(150));

  let contador = 1;
  for (const mov of movimientos) {
    const hora = new Date(mov.fecha).toLocaleTimeString('es-EC', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tipo = mov.tipo_movimiento;
    const monto = Number(mov.monto).toFixed(2);
    const saldoAnt = Number(mov.saldo_anterior).toFixed(2);
    const saldoNuev = Number(mov.saldo_nuevo).toFixed(2);
    const desc = (mov.descripcion || "").substring(0, 50);

    // Marcar movimientos sospechosos (grandes montos)
    const esSospechoso = Number(mov.monto) >= 500 || (mov.descripcion || "").includes("1775764188730");
    const marker = esSospechoso ? "🔍" : "  ";

    console.log(`${marker}${contador.toString().padEnd(2)} | ${hora.padEnd(12)} | ${tipo.padEnd(10)} | ${monto.padStart(12)} | ${saldoAnt.padStart(12)} | ${saldoNuev.padStart(12)} | ${desc}`);
    contador++;
  }

  // ============================================
  // 2. BUSCAR REFERENCIAS A CAM-1775764188730
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("2️⃣  BÚSQUEDA DE REFERENCIAS A CAM-1775764188730");
  console.log("=".repeat(100));

  const movimientosConReferencia = movimientos.filter(m => 
    (m.descripcion || "").includes("1775764188730") ||
    (m.descripcion || "").includes("1775764188730")
  );

  console.log(`\nMovimientos que contienen la referencia: ${movimientosConReferencia.length}\n`);

  for (const mov of movimientosConReferencia) {
    const hora = new Date(mov.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`ID: ${mov.id}`);
    console.log(`Hora: ${hora}`);
    console.log(`Tipo: ${mov.tipo_movimiento}`);
    console.log(`Monto: ${Number(mov.monto).toFixed(2)}`);
    console.log(`Saldo anterior: ${Number(mov.saldo_anterior).toFixed(2)}`);
    console.log(`Saldo nuevo: ${Number(mov.saldo_nuevo).toFixed(2)}`);
    console.log(`Descripción: ${mov.descripcion}`);
    console.log(`Referencia ID: ${mov.referencia_id}`);
    console.log("-".repeat(80));
  }

  // ============================================
  // 3. ANÁLISIS DE LA TRANSACCIÓN CAM-1775764188730
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("3️⃣  ANÁLISIS DE LA TRANSACCIÓN CAM-1775764188730");
  console.log("=".repeat(100));

  // Buscar el cambio de divisa
  const cambio = await prisma.cambioDivisa.findFirst({
    where: {
      numero_recibo: {
        contains: "1775764188730",
      },
    },
    include: {
      monedaOrigen: true,
      monedaDestino: true,
    },
  });

  if (cambio) {
    console.log("\n✓ Cambio de divisa encontrado:");
    console.log(`   ID: ${cambio.id}`);
    console.log(`   Número recibo: ${cambio.numero_recibo}`);
    console.log(`   Fecha: ${cambio.fecha.toISOString()}`);
    console.log(`   Tipo: ${cambio.tipo_operacion}`);
    console.log(`   Moneda origen: ${cambio.monedaOrigen.codigo} - ${Number(cambio.monto_origen).toFixed(2)}`);
    console.log(`   Moneda destino: ${cambio.monedaDestino.codigo} - ${Number(cambio.monto_destino).toFixed(2)}`);
    console.log(`   Estado: ${cambio.estado}`);
    console.log(`   usd_recibido_efectivo: ${cambio.usd_recibido_efectivo}`);
    console.log(`   usd_recibido_transfer: ${cambio.usd_recibido_transfer}`);
    console.log(`   usd_entregado_efectivo: ${cambio.usd_entregado_efectivo}`);
    console.log(`   usd_entregado_transfer: ${cambio.usd_entregado_transfer}`);

    // Buscar movimientos relacionados con este cambio
    const movimientosRelacionados = await prisma.movimientoSaldo.findMany({
      where: {
        referencia_id: cambio.id,
      },
    });

    console.log(`\n   Movimientos de saldo relacionados: ${movimientosRelacionados.length}`);
    for (const mov of movimientosRelacionados) {
      const moneda = await prisma.moneda.findUnique({ where: { id: mov.moneda_id } });
      console.log(`   - ${mov.tipo_movimiento} | ${Number(mov.monto).toFixed(2)} ${moneda?.codigo} | ${mov.descripcion?.substring(0, 40)}`);
    }
  } else {
    console.log("\n⚠️  No se encontró el cambio de divisa (puede haber sido eliminado)");
  }

  // ============================================
  // 4. CALCULAR CUÁNTO DEBERÍA SER VS CUÁNTO ES
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("4️⃣  ANÁLISIS DE DIFERENCIA");
  console.log("=".repeat(100));

  // Sumar todos los ingresos
  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalAjustes = 0;

  for (const mov of movimientos) {
    if (mov.tipo_movimiento === "INGRESO") totalIngresos += Number(mov.monto);
    else if (mov.tipo_movimiento === "EGRESO") totalEgresos += Number(mov.monto);
    else if (mov.tipo_movimiento === "AJUSTE") totalAjustes += Number(mov.monto);
  }

  console.log(`\nTotales según MovimientoSaldo:`);
  console.log(`   INGRESOS: +${totalIngresos.toFixed(2)}`);
  console.log(`   EGRESOS: -${totalEgresos.toFixed(2)}`);
  console.log(`   AJUSTES: ${totalAjustes >= 0 ? "+" : ""}${totalAjustes.toFixed(2)}`);
  console.log(`   NETO: ${(totalIngresos - totalEgresos + totalAjustes).toFixed(2)}`);

  // Identificar los $800.00 extra
  console.log(`\n🔍 Buscando los $800.00 extra...`);
  
  const movimientos800 = movimientos.filter(m => Math.abs(Number(m.monto) - 800) < 0.01);
  console.log(`\nMovimientos con monto ~$800.00: ${movimientos800.length}`);
  
  for (const mov of movimientos800) {
    const hora = new Date(mov.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`\n   Hora: ${hora}`);
    console.log(`   Tipo: ${mov.tipo_movimiento}`);
    console.log(`   Monto: ${Number(mov.monto).toFixed(2)}`);
    console.log(`   Descripción: ${mov.descripcion}`);
    console.log(`   Referencia ID: ${mov.referencia_id}`);
  }

  // ============================================
  // 5. VERIFICAR SI ES LA MISMA ANULACIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("5️⃣  ¿ES LA MISMA ANULACIÓN?");
  console.log("=".repeat(100));

  // La transacción original tenía:
  // - EUR: Egreso de €645.16
  // - USD: Ingreso de $800.00

  // El reverso debería tener:
  // - EUR: Ingreso de €645.16 (reverso del egreso)
  // - USD: Egreso de $800.00 (reverso del ingreso)

  console.log("\nAnálisis de la transacción CAM-1775764188730:");
  console.log("   ORIGINAL (2:49:48 p.m.):");
  console.log("      EUR: EGRESO -€645.16");
  console.log("      USD: INGRESO +$800.00");
  console.log("\n   REVERSO (3:37:55 p.m.):");
  console.log("      EUR: AJUSTE +€645.00 (debería ser +€645.16)");
  console.log("      USD: AJUSTE -$800.00 ✓");

  // Verificar los movimientos de las 3:37:55 p.m.
  const movimientos337 = movimientos.filter(m => {
    const hora = new Date(m.fecha);
    return hora.getHours() === 15 && hora.getMinutes() === 37;
  });

  console.log(`\nMovimientos a las 3:37 p.m.: ${movimientos337.length}`);
  for (const mov of movimientos337) {
    const hora = new Date(mov.fecha).toLocaleTimeString('es-EC', { hour12: true });
    const moneda = await prisma.moneda.findUnique({ where: { id: mov.moneda_id } });
    console.log(`   ${hora} | ${moneda?.codigo} | ${mov.tipo_movimiento} | ${Number(mov.monto).toFixed(2)} | ${mov.descripcion?.substring(0, 40)}`);
  }

  // ============================================
  // 6. CONCLUSIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("6️⃣  CONCLUSIÓN");
  console.log("=".repeat(100));

  const ingreso800 = movimientos.find(m => 
    Math.abs(Number(m.monto) - 800) < 0.01 && 
    m.tipo_movimiento === "INGRESO"
  );

  const ajuste800 = movimientos.find(m => 
    Math.abs(Number(m.monto) - 800) < 0.01 && 
    m.tipo_movimiento === "AJUSTE" &&
    Number(m.monto) < 0
  );

  if (ingreso800 && ajuste800) {
    console.log("\n✅ Se encontró el par de movimientos de $800.00:");
    console.log(`   INGRESO: +$800.00 a las ${new Date(ingreso800.fecha).toLocaleTimeString('es-EC', { hour12: true })}`);
    console.log(`   AJUSTE: -$800.00 a las ${new Date(ajuste800.fecha).toLocaleTimeString('es-EC', { hour12: true })}`);
    console.log("\n   Esto corresponde a:");
    console.log("   - Ingreso: La transacción original (cliente entregó $800.00)");
    console.log("   - Ajuste: El reverso (se devolvieron $800.00)");
    console.log("\n   💡 Los $800.00 SÍ están correctamente compensados (ingreso + ajuste negativo)");
  }

  // Verificar el problema real
  console.log("\n📊 PROBLEMA REAL IDENTIFICADO:");
  
  // Calcular lo que debería haber en ingresos sin la transacción anulada
  const ingresosSinAnulacion = totalIngresos - 800; // Quitamos los $800 de la transacción anulada
  console.log(`\n   INGRESOS totales en DB: $${totalIngresos.toFixed(2)}`);
  console.log(`   Menos transacción anulada: -$800.00`);
  console.log(`   INGRESOS válidos: $${ingresosSinAnulacion.toFixed(2)}`);
  
  // Los egresos de la transacción anulada
  const egresosEURanulacion = 645.16;
  console.log(`\n   EGRESOS EUR de anulación: €${egresosEURanulacion.toFixed(2)}`);
  console.log(`   REVERSO EUR registrado: €645.00`);
  console.log(`   DIFERENCIA: €${(645.16 - 645.00).toFixed(2)}`);

  console.log("\n" + "=".repeat(100));
  console.log("INVESTIGACIÓN COMPLETADA");
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
