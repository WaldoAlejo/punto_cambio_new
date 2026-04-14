/**
 * INVESTIGACIÓN DE LA TRANSACCIÓN RECREADA
 * Buscar si la transacción se volvió a hacer con otro número de recibo
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("INVESTIGACIÓN DE LA TRANSACCIÓN RECREADA");
  console.log("=".repeat(100));
  console.log("\nBuscando si la transacción anulada se volvió a crear con otro número...\n");

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

  console.log(`📍 Punto: ${punto.nombre}\n`);

  const usd = await prisma.moneda.findFirst({ where: { codigo: "USD" } });
  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });

  if (!usd || !eur) {
    console.error("❌ No se encontraron monedas");
    return;
  }

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  // ============================================
  // 1. BUSCAR TODOS LOS CAMBIOS DEL 9/4
  // ============================================
  console.log("=".repeat(100));
  console.log("1️⃣  TODOS LOS CAMBIOS DE DIVISA DEL 9/4/2026");
  console.log("=".repeat(100));

  const cambios = await prisma.cambioDivisa.findMany({
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

  console.log(`\nTotal cambios: ${cambios.length}\n`);

  for (const c of cambios) {
    const hora = new Date(c.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`${hora} | ${c.numero_recibo}`);
    console.log(`  ${c.tipo_operacion}: ${Number(c.monto_origen).toFixed(2)} ${c.monedaOrigen.codigo} → ${Number(c.monto_destino).toFixed(2)} ${c.monedaDestino.codigo}`);
    console.log(`  Estado: ${c.estado}`);
    console.log(`  ID: ${c.id}`);
    console.log("");
  }

  // ============================================
  // 2. BUSCAR CAMBIOS CON MONTOS SIMILARES
  // ============================================
  console.log("=".repeat(100));
  console.log("2️⃣  BUSCANDO CAMBIOS CON MONTOS SIMILARES A LA TRANSACCIÓN ANULADA");
  console.log("=".repeat(100));
  console.log("\nBuscando cambios con:");
  console.log("  - Monto origen ~ $800.00 USD o ~ €645.16 EUR");
  console.log("  - Monto destino ~ €645.16 EUR o ~ $800.00 USD\n");

  const cambiosSimilares = cambios.filter(c => {
    const montoOrigen = Number(c.monto_origen);
    const montoDestino = Number(c.monto_destino);
    
    // Buscar transacciones similares a la anulada
    const esSimilarUSD_EUR = (
      (c.monedaOrigen.codigo === "USD" && Math.abs(montoOrigen - 800) < 10) &&
      (c.monedaDestino.codigo === "EUR" && Math.abs(montoDestino - 645) < 10)
    );
    
    const esSimilarEUR_USD = (
      (c.monedaOrigen.codigo === "EUR" && Math.abs(montoOrigen - 645) < 10) &&
      (c.monedaDestino.codigo === "USD" && Math.abs(montoDestino - 800) < 10)
    );
    
    return esSimilarUSD_EUR || esSimilarEUR_USD;
  });

  console.log(`Cambios similares encontrados: ${cambiosSimilares.length}\n`);

  for (const c of cambiosSimilares) {
    const hora = new Date(c.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`🔍 ${hora} | ${c.numero_recibo}`);
    console.log(`   ${c.tipo_operacion}: ${Number(c.monto_origen).toFixed(2)} ${c.monedaOrigen.codigo} → ${Number(c.monto_destino).toFixed(2)} ${c.monedaDestino.codigo}`);
    console.log(`   Estado: ${c.estado}`);
    console.log(`   ID: ${c.id}`);
    console.log("");
  }

  // ============================================
  // 3. BUSCAR MOVIMIENTOS DE SALDO SIN REFERENCIA AL RECIBO ANULADO
  // ============================================
  console.log("=".repeat(100));
  console.log("3️⃣  BUSCANDO MOVIMIENTOS DE SALDO POR MONTOS");
  console.log("=".repeat(100));
  console.log("\nBuscando movimientos con montos ~ $800.00 o ~ €645.16\n");

  const movimientosUSD = await prisma.movimientoSaldo.findMany({
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

  const movimientosEUR = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
    },
    orderBy: { fecha: "asc" },
  });

  console.log("Movimientos USD con monto ~ $800:");
  const usd800 = movimientosUSD.filter(m => Math.abs(Number(m.monto) - 800) < 10);
  for (const m of usd800) {
    const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`  ${hora} | ${m.tipo_movimiento} | $${Number(m.monto).toFixed(2)} | ${m.descripcion?.substring(0, 50)}`);
  }
  if (usd800.length === 0) console.log("  (Ninguno encontrado)");

  console.log("\nMovimientos EUR con monto ~ €645:");
  const eur645 = movimientosEUR.filter(m => Math.abs(Number(m.monto) - 645) < 10);
  for (const m of eur645) {
    const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`  ${hora} | ${m.tipo_movimiento} | €${Number(m.monto).toFixed(2)} | ${m.descripcion?.substring(0, 50)}`);
  }
  if (eur645.length === 0) console.log("  (Ninguno encontrado)");

  // ============================================
  // 4. ANÁLISIS DE TODOS LOS MOVIMIENTOS DEL DÍA
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("4️⃣  ANÁLISIS COMPLETO DE MOVIMIENTOS DEL DÍA");
  console.log("=".repeat(100));

  console.log("\n📊 USD - Todos los movimientos del 9/4:");
  console.log("-".repeat(100));
  let saldoUSD = 0;
  for (const m of movimientosUSD) {
    const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
    let cambio = 0;
    if (m.tipo_movimiento === "INGRESO") cambio = Number(m.monto);
    else if (m.tipo_movimiento === "EGRESO") cambio = -Number(m.monto);
    else if (m.tipo_movimiento === "AJUSTE") cambio = Number(m.monto);
    saldoUSD += cambio;
    
    // Marcar montos grandes
    const marker = Math.abs(Number(m.monto)) >= 500 ? "🔍" : "  ";
    console.log(`${marker} ${hora} | ${m.tipo_movimiento.padEnd(10)} | ${cambio >= 0 ? "+" : ""}${cambio.toFixed(2).padStart(10)} | Saldo: ${saldoUSD.toFixed(2).padStart(10)} | ${m.descripcion?.substring(0, 35)}`);
  }

  console.log("\n📊 EUR - Todos los movimientos del 9/4:");
  console.log("-".repeat(100));
  let saldoEUR = 0;
  for (const m of movimientosEUR) {
    const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
    let cambio = 0;
    if (m.tipo_movimiento === "INGRESO") cambio = Number(m.monto);
    else if (m.tipo_movimiento === "EGRESO") cambio = -Number(m.monto);
    else if (m.tipo_movimiento === "AJUSTE") cambio = Number(m.monto);
    saldoEUR += cambio;
    
    // Marcar montos grandes
    const marker = Math.abs(Number(m.monto)) >= 500 ? "🔍" : "  ";
    console.log(`${marker} ${hora} | ${m.tipo_movimiento.padEnd(10)} | ${cambio >= 0 ? "+" : ""}${cambio.toFixed(2).padStart(10)} | Saldo: ${saldoEUR.toFixed(2).padStart(10)} | ${m.descripcion?.substring(0, 35)}`);
  }

  // ============================================
  // 5. BUSCAR POR RANGOS DE HORA
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("5️⃣  BUSCANDO TRANSACCIONES DESPUÉS DE LA ANULACIÓN (3:37 p.m.)");
  console.log("=".repeat(100));

  const cambiosDespuesAnulacion = cambios.filter(c => {
    const hora = new Date(c.fecha);
    return hora.getHours() > 15 || (hora.getHours() === 15 && hora.getMinutes() > 37);
  });

  console.log(`\nCambios después de las 3:37 p.m.: ${cambiosDespuesAnulacion.length}\n`);

  for (const c of cambiosDespuesAnulacion) {
    const hora = new Date(c.fecha).toLocaleTimeString('es-EC', { hour12: true });
    console.log(`${hora} | ${c.numero_recibo}`);
    console.log(`  ${c.tipo_operacion}: ${Number(c.monto_origen).toFixed(2)} ${c.monedaOrigen.codigo} → ${Number(c.monto_destino).toFixed(2)} ${c.monedaDestino.codigo}`);
    console.log(`  Estado: ${c.estado}`);
    console.log("");
  }

  // ============================================
  // 6. VERIFICAR SI HAY RECIBOS DUPLICADOS
  // ============================================
  console.log("=".repeat(100));
  console.log("6️⃣  VERIFICANDO RECIBOS");
  console.log("=".repeat(100));

  const recibos = await prisma.recibo.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
    },
    orderBy: { fecha: "asc" },
  });

  console.log(`\nTotal recibos del día: ${recibos.length}\n`);

  // Buscar recibos con montos similares
  const recibosSimilares = recibos.filter(r => {
    const datos = r.datos_operacion as any;
    if (!datos) return false;
    
    const montoOrigen = Number(datos.monto_origen || 0);
    const montoDestino = Number(datos.monto_destino || 0);
    
    return (
      (Math.abs(montoOrigen - 800) < 10 && Math.abs(montoDestino - 645) < 10) ||
      (Math.abs(montoOrigen - 645) < 10 && Math.abs(montoDestino - 800) < 10)
    );
  });

  console.log(`Recibos con montos similares a la transacción anulada: ${recibosSimilares.length}\n`);

  for (const r of recibosSimilares) {
    const hora = new Date(r.fecha).toLocaleTimeString('es-EC', { hour12: true });
    const datos = r.datos_operacion as any;
    console.log(`${hora} | ${r.numero_recibo}`);
    console.log(`  Tipo: ${r.tipo_operacion}`);
    console.log(`  Monto origen: ${Number(datos?.monto_origen || 0).toFixed(2)}`);
    console.log(`  Monto destino: ${Number(datos?.monto_destino || 0).toFixed(2)}`);
    console.log("");
  }

  console.log("=".repeat(100));
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
