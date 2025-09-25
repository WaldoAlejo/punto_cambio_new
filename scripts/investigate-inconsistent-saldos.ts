#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function investigateInconsistentSaldos() {
  console.log("🔍 Investigando saldos inconsistentes...\n");

  try {
    // Obtener todos los saldos para verificar manualmente la consistencia
    const allSaldos = await prisma.saldo.findMany({
      include: {
        moneda: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
        puntoAtencion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: [{ punto_atencion_id: "asc" }, { moneda_id: "asc" }],
    });

    console.log(`📊 Total de saldos encontrados: ${allSaldos.length}\n`);

    const inconsistentSaldos = [];

    // Verificar cada saldo manualmente
    for (const saldo of allSaldos) {
      const calculatedCantidad =
        Number(saldo.billetes) +
        Number(saldo.monedas_fisicas) +
        Number(saldo.bancos);

      const actualCantidad = Number(saldo.cantidad);

      // Verificar si hay inconsistencia (con tolerancia para decimales)
      const difference = Math.abs(calculatedCantidad - actualCantidad);
      const isInconsistent = difference > 0.01; // Tolerancia de 1 centavo

      if (isInconsistent) {
        inconsistentSaldos.push({
          id: saldo.id,
          puntoAtencion: saldo.puntoAtencion.nombre,
          moneda: saldo.moneda.codigo,
          cantidad_actual: actualCantidad,
          cantidad_calculada: calculatedCantidad,
          diferencia: difference,
          billetes: Number(saldo.billetes),
          monedas_fisicas: Number(saldo.monedas_fisicas),
          bancos: Number(saldo.bancos),
          created_at: saldo.created_at,
          updated_at: saldo.updated_at,
        });
      }
    }

    console.log(
      `❌ Saldos inconsistentes encontrados: ${inconsistentSaldos.length}\n`
    );

    if (inconsistentSaldos.length > 0) {
      console.log("📋 DETALLES DE SALDOS INCONSISTENTES:");
      console.log("=".repeat(80));

      inconsistentSaldos.forEach((saldo, index) => {
        console.log(`\n${index + 1}. ID: ${saldo.id}`);
        console.log(`   Punto de Atención: ${saldo.puntoAtencion}`);
        console.log(`   Moneda: ${saldo.moneda}`);
        console.log(`   Cantidad Actual: ${saldo.cantidad_actual}`);
        console.log(
          `   Cantidad Calculada: ${saldo.cantidad_calculada} (${saldo.billetes} + ${saldo.monedas_fisicas} + ${saldo.bancos})`
        );
        console.log(`   Diferencia: ${saldo.diferencia.toFixed(2)}`);
        console.log(`   Creado: ${saldo.created_at}`);
        console.log(`   Actualizado: ${saldo.updated_at}`);
      });

      console.log("\n" + "=".repeat(80));
      console.log("\n💡 OPCIONES DE CORRECCIÓN:");
      console.log('1. Actualizar el campo "cantidad" con el valor calculado');
      console.log(
        "2. Revisar manualmente cada registro para determinar cuál valor es correcto"
      );
      console.log("3. Ejecutar el script de corrección automática");

      // Mostrar estadísticas
      const totalDifference = inconsistentSaldos.reduce(
        (sum, s) => sum + s.diferencia,
        0
      );
      const avgDifference = totalDifference / inconsistentSaldos.length;

      console.log("\n📈 ESTADÍSTICAS:");
      console.log(`   Diferencia total: ${totalDifference.toFixed(2)}`);
      console.log(`   Diferencia promedio: ${avgDifference.toFixed(2)}`);
      console.log(
        `   Diferencia máxima: ${Math.max(
          ...inconsistentSaldos.map((s) => s.diferencia)
        ).toFixed(2)}`
      );
      console.log(
        `   Diferencia mínima: ${Math.min(
          ...inconsistentSaldos.map((s) => s.diferencia)
        ).toFixed(2)}`
      );
    } else {
      console.log("✅ No se encontraron saldos inconsistentes.");
    }
  } catch (error) {
    console.error("❌ Error durante la investigación:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  investigateInconsistentSaldos();
}

export { investigateInconsistentSaldos };
