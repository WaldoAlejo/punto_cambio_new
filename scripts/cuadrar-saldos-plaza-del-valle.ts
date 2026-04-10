/**
 * Script para cuadrar los saldos de PLAZA DEL VALLE
 * Recalcula los saldos basándose en los movimientos reales del día 9/4/2026
 * y actualiza los saldos a los valores correctos sin crear movimientos de ajuste
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CUADRE DE SALDOS - PLAZA DEL VALLE ===\n");

  // Fecha del día a cuadrar (9/4/2026)
  const fechaInicio = new Date("2026-04-09T00:00:00.000Z");
  const fechaFin = new Date("2026-04-10T00:00:00.000Z");

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

  // 2. Obtener todas las monedas que tienen movimientos hoy en este punto
  const movimientosHoy = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: punto.id,
      fecha: {
        gte: fechaInicio,
        lt: fechaFin,
      },
    },
    include: {
      moneda: true,
    },
    orderBy: {
      fecha: "asc",
    },
  });

  // Agrupar movimientos por moneda
  const movimientosPorMoneda = new Map();
  for (const mov of movimientosHoy) {
    if (!movimientosPorMoneda.has(mov.moneda_id)) {
      movimientosPorMoneda.set(mov.moneda_id, {
        moneda: mov.moneda,
        movimientos: [],
      });
    }
    movimientosPorMoneda.get(mov.moneda_id).movimientos.push(mov);
  }

  console.log(`Monedas con movimientos hoy: ${movimientosPorMoneda.size}\n`);

  // 3. Para cada moneda, calcular el saldo correcto
  for (const [monedaId, data] of movimientosPorMoneda) {
    const { moneda, movimientos } = data;
    
    console.log(`\n--- ${moneda.codigo} (${moneda.nombre}) ---`);
    console.log(`Total movimientos: ${movimientos.length}`);

    // Calcular el saldo inicial (antes del primer movimiento del día)
    const primerMovimiento = movimientos[0];
    const saldoInicial = Number(primerMovimiento.saldo_anterior);
    
    console.log(`Saldo al inicio del día: ${saldoInicial.toFixed(2)}`);

    // Calcular el saldo final sumando todos los movimientos
    let saldoCalculado = saldoInicial;
    let totalIngresos = 0;
    let totalEgresos = 0;

    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      if (mov.tipo_movimiento === "INGRESO") {
        saldoCalculado += monto;
        totalIngresos += monto;
      } else if (mov.tipo_movimiento === "EGRESO") {
        saldoCalculado -= monto;
        totalEgresos += monto;
      } else if (mov.tipo_movimiento === "AJUSTE") {
        // Los ajustes ya vienen con signo en el monto
        saldoCalculado += monto;
      }
    }

    console.log(`  Total INGRESOS: +${totalIngresos.toFixed(2)}`);
    console.log(`  Total EGRESOS: -${totalEgresos.toFixed(2)}`);
    console.log(`  Saldo calculado: ${saldoCalculado.toFixed(2)}`);

    // Obtener el saldo actual en la base de datos
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: monedaId,
        },
      },
    });

    if (saldoActual) {
      const saldoDbActual = Number(saldoActual.cantidad);
      console.log(`  Saldo actual en DB: ${saldoDbActual.toFixed(2)}`);

      if (Math.abs(saldoDbActual - saldoCalculado) > 0.01) {
        console.log(`  ⚠️  DIFERENCIA DETECTADA: ${(saldoCalculado - saldoDbActual).toFixed(2)}`);
        console.log(`  🔄 Actualizando saldo a: ${saldoCalculado.toFixed(2)}`);

        // Actualizar el saldo sin crear movimiento de ajuste
        await prisma.saldo.update({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: monedaId,
            },
          },
          data: {
            cantidad: saldoCalculado,
            updated_at: new Date(),
          },
        });

        console.log(`  ✅ Saldo actualizado correctamente`);
      } else {
        console.log(`  ✅ Saldo correcto, no requiere ajuste`);
      }
    } else {
      console.log(`  ⚠️  No existe registro de saldo para esta moneda`);
      console.log(`  🔄 Creando saldo inicial: ${saldoCalculado.toFixed(2)}`);

      await prisma.saldo.create({
        data: {
          punto_atencion_id: punto.id,
          moneda_id: monedaId,
          cantidad: saldoCalculado,
          billetes: saldoCalculado,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });

      console.log(`  ✅ Saldo creado correctamente`);
    }
  }

  // 4. Verificación final - mostrar todos los saldos actualizados
  console.log("\n\n=== VERIFICACIÓN FINAL - SALDOS ACTUALIZADOS ===\n");
  
  const saldosFinales = await prisma.saldo.findMany({
    where: {
      punto_atencion_id: punto.id,
    },
    include: {
      moneda: true,
    },
  });

  for (const saldo of saldosFinales) {
    console.log(`${saldo.moneda.codigo}: ${Number(saldo.cantidad).toFixed(2)}`);
  }

  console.log("\n=== CUADRE COMPLETADO ===");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
