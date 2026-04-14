/**
 * INVESTIGACIÓN DETALLADA DEL SALDO EUR
 * Verificar por qué el saldo disponible es €52.90 en lugar de €697.90
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("INVESTIGACIÓN DETALLADA DEL SALDO EUR");
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

  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });
  if (!eur) {
    console.error("❌ No se encontró EUR");
    return;
  }

  // ============================================
  // 1. VERIFICAR SALDO ACTUAL
  // ============================================
  console.log("=".repeat(100));
  console.log("1️⃣  SALDO ACTUAL EN LA TABLA SALDO");
  console.log("=".repeat(100));

  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  if (saldo) {
    console.log(`\n   Cantidad: €${Number(saldo.cantidad).toFixed(2)}`);
    console.log(`   Billetes: €${Number(saldo.billetes).toFixed(2)}`);
    console.log(`   Monedas: €${Number(saldo.monedas_fisicas).toFixed(2)}`);
    console.log(`   Bancos: €${Number(saldo.bancos || 0).toFixed(2)}`);
    console.log(`   Updated: ${saldo.updated_at.toISOString()}`);
    
    const totalFisico = Number(saldo.billetes) + Number(saldo.monedas_fisicas);
    console.log(`\n   Total físico (billetes + monedas): €${totalFisico.toFixed(2)}`);
    console.log(`   ⚠️  El sistema valida contra: €${totalFisico.toFixed(2)}`);
    console.log(`   ❌ Pero debería tener: €${Number(saldo.cantidad).toFixed(2)}`);
  }

  // ============================================
  // 2. TODOS LOS MOVIMIENTOS EUR DEL 9/4
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("2️⃣  TODOS LOS MOVIMIENTOS EUR DEL 9/4/2026");
  console.log("=".repeat(100));

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  const movimientos = await prisma.movimientoSaldo.findMany({
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

  console.log(`\nTotal movimientos: ${movimientos.length}\n`);
  console.log(`${"#".padEnd(3)} | ${"Hora".padEnd(12)} | ${"Tipo".padEnd(12)} | ${"Monto".padStart(10)} | ${"Saldo Ant".padStart(12)} | ${"Saldo Nuevo".padStart(12)} | Descripción`);
  console.log("-".repeat(130));

  let contador = 1;
  for (const m of movimientos) {
    const hora = new Date(m.fecha).toLocaleTimeString('es-EC', { hour12: true });
    const tipo = m.tipo_movimiento;
    const monto = Number(m.monto).toFixed(2);
    const saldoAnt = Number(m.saldo_anterior).toFixed(2);
    const saldoNuevo = Number(m.saldo_nuevo).toFixed(2);
    const desc = (m.descripcion || "").substring(0, 40);

    console.log(`${contador.toString().padEnd(3)} | ${hora.padEnd(12)} | ${tipo.padEnd(12)} | ${monto.padStart(10)} | ${saldoAnt.padStart(12)} | ${saldoNuevo.padStart(12)} | ${desc}`);
    contador++;
  }

  // ============================================
  // 3. ANÁLISIS DE BILLETES Y MONEDAS
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("3️⃣  ANÁLISIS: ¿POR QUÉ BILLETES + MONEDAS ≠ CANTIDAD?");
  console.log("=".repeat(100));

  console.log("\nEl problema es que la tabla Saldo tiene:");
  console.log(`   cantidad = ${Number(saldo?.cantidad || 0).toFixed(2)} (este es el saldo total)`);
  console.log(`   billetes = ${Number(saldo?.billetes || 0).toFixed(2)}`);
  console.log(`   monedas_fisicas = ${Number(saldo?.monedas_fisicas || 0).toFixed(2)}`);
  console.log(`   cantidad DEBERÍA SER = billetes + monedas_fisicas`);
  console.log(`   PERO: ${Number(saldo?.billetes || 0).toFixed(2)} + ${Number(saldo?.monedas_fisicas || 0).toFixed(2)} = ${(Number(saldo?.billetes || 0) + Number(saldo?.monedas_fisicas || 0)).toFixed(2)} ≠ ${Number(saldo?.cantidad || 0).toFixed(2)}`);

  console.log("\nEsto indica que el campo 'cantidad' se actualizó pero");
  console.log("'billetes' y 'monedas_fisicas' NO se actualizaron correctamente.");

  // ============================================
  // 4. RECONSTRUIR BILLETES Y MONEDAS
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("4️⃣  RECONSTRUCCIÓN DE BILLETES Y MONEDAS");
  console.log("=".repeat(100));

  // Calcular cuánto debería haber en billetes y monedas
  // basándonos en los movimientos del día

  let billetesCalculados = 0;
  let monedasCalculadas = 0;

  // Necesitamos el saldo inicial del día
  const saldoInicial = await prisma.movimientoSaldo.findFirst({
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

  if (saldoInicial) {
    console.log(`\nSaldo inicial del día (primer movimiento):`);
    console.log(`   Saldo anterior: €${Number(saldoInicial.saldo_anterior).toFixed(2)}`);
    console.log(`   Esto debería dividirse en billetes y monedas...`);
    
    // Asumimos que todo el saldo inicial está en billetes
    billetesCalculados = Number(saldoInicial.saldo_anterior);
    monedasCalculadas = 0;
  }

  console.log(`\nProcesando movimientos para calcular billetes/monedas...`);
  
  for (const m of movimientos) {
    const monto = Number(m.monto);
    const desc = m.descripcion || "";
    
    // Los cambios de divisa afectan billetes (generalmente)
    if (desc.includes("cambio")) {
      if (m.tipo_movimiento === "INGRESO") {
        billetesCalculados += monto;
        console.log(`   +€${monto.toFixed(2)} billetes (ingreso cambio)`);
      } else if (m.tipo_movimiento === "EGRESO") {
        // Si hay suficientes billetes, restamos de billetes
        if (billetesCalculados >= monto) {
          billetesCalculados -= monto;
          console.log(`   -€${monto.toFixed(2)} billetes (egreso cambio)`);
        } else {
          // Si no, usamos monedas
          const deBilletes = billetesCalculados;
          const deMonedas = monto - deBilletes;
          billetesCalculados = 0;
          monedasCalculadas -= deMonedas;
          console.log(`   -€${deBilletes.toFixed(2)} billetes, -€${deMonedas.toFixed(2)} monedas (egreso cambio)`);
        }
      }
    }
  }

  console.log(`\n   Billetes calculados: €${billetesCalculados.toFixed(2)}`);
  console.log(`   Monedas calculadas: €${monedasCalculadas.toFixed(2)}`);
  console.log(`   Total: €${(billetesCalculados + monedasCalculadas).toFixed(2)}`);

  // ============================================
  // 5. SOLUCIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("5️⃣  SOLUCIÓN PROPUESTA");
  console.log("=".repeat(100));

  console.log("\nEl problema es que el campo 'cantidad' se actualizó correctamente");
  console.log("(€697.90) pero 'billetes' y 'monedas_fisicas' quedaron desactualizados.");
  console.log("\nEsto pasó porque al hacer el reverso, el sistema:");
  console.log("1. Actualizó 'cantidad' sumando €645.16");
  console.log("2. PERO NO actualizó 'billetes' y 'monedas_fisicas'");
  console.log("\nLa solución es sincronizar billetes + monedas = cantidad");

  const cantidadActual = Number(saldo?.cantidad || 0);
  const billetesActuales = Number(saldo?.billetes || 0);
  const monedasActuales = Number(saldo?.monedas_fisicas || 0);
  const diferencia = cantidadActual - (billetesActuales + monedasActuales);

  console.log(`\n   Diferencia a corregir: €${diferencia.toFixed(2)}`);
  console.log(`   Billetes actuales: €${billetesActuales.toFixed(2)}`);
  console.log(`   Monedas actuales: €${monedasActuales.toFixed(2)}`);
  console.log(`   Billetes corregidos: €${(billetesActuales + diferencia).toFixed(2)}`);

  console.log("\n" + "=".repeat(100));
  console.log("INVESTIGACIÓN COMPLETADA");
  console.log("=".repeat(100));
  console.log("\n💡 CONCLUSIÓN:");
  console.log("   El campo 'cantidad' (€697.90) está correcto.");
  console.log("   Pero 'billetes' (€49.70) + 'monedas' (€3.20) = €52.90");
  console.log("   El sistema valida el saldo disponible contra billetes + monedas");
  console.log("   Por eso dice que solo hay €52.90 disponibles.");
  console.log("\n   La solución es actualizar billetes = cantidad - monedas");
  console.log("   billetes = €697.90 - €3.20 = €694.70");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
