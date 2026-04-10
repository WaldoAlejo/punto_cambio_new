/**
 * Script para cuadrar los saldos de PLAZA DEL VALLE a los valores reales reportados
 * Valores físicos reportados por el operador:
 * - USD: $4,021.46
 * - EUR: €52.74
 * 
 * Este script:
 * 1. Calcula el saldo teórico basado en TODOS los movimientos históricos
 * 2. Compara con el saldo físico reportado
 * 3. Ajusta la base de datos al valor físico real (sin crear movimientos)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// VALORES FÍSICOS REPORTADOS POR EL OPERADOR
const SALDOS_FISICOS_REPORTADOS = {
  USD: 4021.46,
  EUR: 52.74,
};

async function main() {
  console.log("=== CUADRE DE SALDOS REAL - PLAZA DEL VALLE ===\n");
  console.log("Valores físicos reportados:");
  console.log(`  USD: $${SALDOS_FISICOS_REPORTADOS.USD.toFixed(2)}`);
  console.log(`  EUR: €${SALDOS_FISICOS_REPORTADOS.EUR.toFixed(2)}\n`);

  // 1. Buscar el punto PLAZA DEL VALLE
  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró el punto PLAZA DEL VALLE");
    return;
  }

  console.log(`✓ Punto encontrado: ${punto.nombre} (ID: ${punto.id})\n`);

  // 2. Obtener todas las monedas
  const monedas = await prisma.moneda.findMany({
    where: {
      codigo: {
        in: ["USD", "EUR"],
      },
    },
  });

  const monedaMap = new Map(monedas.map(m => [m.codigo, m]));

  // 3. Para cada moneda reportada, calcular y ajustar
  for (const [codigo, saldoFisico] of Object.entries(SALDOS_FISICOS_REPORTADOS)) {
    const moneda = monedaMap.get(codigo);
    if (!moneda) {
      console.log(`⚠️  Moneda ${codigo} no encontrada en la base de datos`);
      continue;
    }

    console.log(`\n--- ${codigo} (${moneda.nombre}) ---`);

    // Obtener todos los movimientos de esta moneda en este punto
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: moneda.id,
      },
      orderBy: {
        fecha: "asc",
      },
    });

    console.log(`  Total movimientos históricos: ${movimientos.length}`);

    // Calcular saldo teórico basado en movimientos
    let saldoTeorico = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalAjustesPositivos = 0;
    let totalAjustesNegativos = 0;

    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      
      if (mov.tipo_movimiento === "INGRESO") {
        saldoTeorico += monto;
        totalIngresos += monto;
      } else if (mov.tipo_movimiento === "EGRESO") {
        saldoTeorico -= monto;
        totalEgresos += monto;
      } else if (mov.tipo_movimiento === "AJUSTE") {
        // Los ajustes ya vienen con signo en el monto
        saldoTeorico += monto;
        if (monto > 0) totalAjustesPositivos += monto;
        else totalAjustesNegativos += Math.abs(monto);
      }
    }

    console.log(`  Suma INGRESOS: +${totalIngresos.toFixed(2)}`);
    console.log(`  Suma EGRESOS: -${totalEgresos.toFixed(2)}`);
    console.log(`  Suma AJUSTES (+): +${totalAjustesPositivos.toFixed(2)}`);
    console.log(`  Suma AJUSTES (-): -${totalAjustesNegativos.toFixed(2)}`);
    console.log(`  Saldo TEÓRICO calculado: ${saldoTeorico.toFixed(2)}`);

    // Obtener saldo actual en base de datos
    const saldoDb = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
    });

    const saldoDbActual = saldoDb ? Number(saldoDb.cantidad) : 0;
    console.log(`  Saldo actual en DB: ${saldoDbActual.toFixed(2)}`);
    console.log(`  Saldo FÍSICO reportado: ${saldoFisico.toFixed(2)}`);

    // Calcular diferencias
    const difTeoricoVsDb = saldoTeorico - saldoDbActual;
    const difFisicoVsDb = saldoFisico - saldoDbActual;
    const difFisicoVsTeorico = saldoFisico - saldoTeorico;

    console.log(`\n  Análisis de diferencias:`);
    console.log(`    Teórico vs DB: ${difTeoricoVsDb >= 0 ? "+" : ""}${difTeoricoVsDb.toFixed(2)}`);
    console.log(`    Físico vs DB: ${difFisicoVsDb >= 0 ? "+" : ""}${difFisicoVsDb.toFixed(2)}`);
    console.log(`    Físico vs Teórico: ${difFisicoVsTeorico >= 0 ? "+" : ""}${difFisicoVsTeorico.toFixed(2)}`);

    // Decidir qué hacer
    if (Math.abs(difFisicoVsDb) < 0.01) {
      console.log(`\n  ✅ El saldo en DB ya coincide con el físico reportado`);
      continue;
    }

    // Hay diferencia, necesitamos ajustar
    console.log(`\n  🔄 AJUSTANDO saldo en DB a valor FÍSICO reportado: ${saldoFisico.toFixed(2)}`);

    if (saldoDb) {
      // Actualizar saldo existente
      await prisma.saldo.update({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
        data: {
          cantidad: saldoFisico,
          // Distribuir el saldo entre billetes y monedas (todo a billetes por defecto)
          billetes: saldoFisico,
          monedas_fisicas: 0,
          updated_at: new Date(),
        },
      });
    } else {
      // Crear nuevo saldo
      await prisma.saldo.create({
        data: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
          cantidad: saldoFisico,
          billetes: saldoFisico,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });
    }

    console.log(`  ✅ Saldo actualizado a: ${saldoFisico.toFixed(2)}`);
    
    if (Math.abs(difFisicoVsTeorico) > 0.01) {
      console.log(`\n  ⚠️  ADVERTENCIA: Hay una diferencia de ${Math.abs(difFisicoVsTeorico).toFixed(2)} entre el saldo`);
      console.log(`     teórico (basado en movimientos) y el físico reportado.`);
      console.log(`     Esto puede indicar:`);
      console.log(`     - Movimientos no registrados en el sistema`);
      console.log(`     - Errores en transacciones previas`);
      console.log(`     - Pérdida o ganancia de efectivo`);
    }
  }

  // 4. Verificación final
  console.log("\n\n=== VERIFICACIÓN FINAL ===\n");
  
  for (const [codigo, saldoEsperado] of Object.entries(SALDOS_FISICOS_REPORTADOS)) {
    const moneda = monedaMap.get(codigo);
    if (!moneda) continue;

    const saldoFinal = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      },
    });

    const saldoActual = saldoFinal ? Number(saldoFinal.cantidad) : 0;
    const coincide = Math.abs(saldoActual - saldoEsperado) < 0.01;

    console.log(`${codigo}:`);
    console.log(`  Esperado: ${saldoEsperado.toFixed(2)}`);
    console.log(`  Actual:   ${saldoActual.toFixed(2)}`);
    console.log(`  Estado:   ${coincide ? "✅ CORRECTO" : "❌ DIFERENCIA"}\n`);
  }

  console.log("=== CUADRE COMPLETADO ===");
  console.log("\nLos saldos han sido ajustados a los valores físicos reportados.");
  console.log("Se recomienda realizar un arqueo de caja para confirmar los saldos.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
