#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import readline from "readline";

const prisma = new PrismaClient();

interface InconsistentSaldo {
  id: string;
  puntoAtencion: string;
  moneda: string;
  cantidad_actual: number;
  cantidad_calculada: number;
  diferencia: number;
  billetes: number;
  monedas_fisicas: number;
  bancos: number;
}

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function findInconsistentSaldos(): Promise<InconsistentSaldo[]> {
  const allSaldos = await prisma.saldo.findMany({
    include: {
      moneda: {
        select: {
          codigo: true,
        },
      },
      puntoAtencion: {
        select: {
          nombre: true,
        },
      },
    },
  });

  const inconsistentSaldos: InconsistentSaldo[] = [];

  for (const saldo of allSaldos) {
    const calculatedCantidad =
      Number(saldo.billetes) +
      Number(saldo.monedas_fisicas) +
      Number(saldo.bancos);

    const actualCantidad = Number(saldo.cantidad);
    const difference = Math.abs(calculatedCantidad - actualCantidad);

    if (difference > 0.01) {
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
      });
    }
  }

  return inconsistentSaldos;
}

async function fixInconsistentSaldos() {
  console.log("🔧 Script de Corrección de Saldos Inconsistentes\n");

  try {
    const inconsistentSaldos = await findInconsistentSaldos();

    if (inconsistentSaldos.length === 0) {
      console.log("✅ No se encontraron saldos inconsistentes para corregir.");
      return;
    }

    console.log(
      `❌ Se encontraron ${inconsistentSaldos.length} saldos inconsistentes:\n`
    );

    // Mostrar resumen
    inconsistentSaldos.forEach((saldo, index) => {
      console.log(`${index + 1}. ${saldo.puntoAtencion} - ${saldo.moneda}`);
      console.log(
        `   Actual: ${saldo.cantidad_actual} | Calculado: ${
          saldo.cantidad_calculada
        } | Diferencia: ${saldo.diferencia.toFixed(2)}`
      );
    });

    console.log("\n" + "=".repeat(60));
    console.log("OPCIONES DE CORRECCIÓN:");
    console.log(
      "1. Corregir automáticamente (actualizar cantidad = billetes + monedas + bancos)"
    );
    console.log("2. Mostrar detalles y corregir manualmente");
    console.log("3. Crear backup y luego corregir automáticamente");
    console.log("4. Cancelar");

    const choice = await askQuestion("\n¿Qué opción deseas? (1-4): ");

    switch (choice) {
      case "1":
        await automaticFix(inconsistentSaldos);
        break;
      case "2":
        await manualFix(inconsistentSaldos);
        break;
      case "3":
        await backupAndFix(inconsistentSaldos);
        break;
      case "4":
        console.log("❌ Operación cancelada.");
        break;
      default:
        console.log("❌ Opción inválida.");
    }
  } catch (error) {
    console.error("❌ Error durante la corrección:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function automaticFix(inconsistentSaldos: InconsistentSaldo[]) {
  console.log("\n🔧 Iniciando corrección automática...\n");

  const confirm = await askQuestion(
    `¿Estás seguro de que quieres corregir automáticamente ${inconsistentSaldos.length} registros? (s/N): `
  );

  if (confirm.toLowerCase() !== "s" && confirm.toLowerCase() !== "si") {
    console.log("❌ Corrección cancelada.");
    return;
  }

  let corrected = 0;
  let errors = 0;

  for (const saldo of inconsistentSaldos) {
    try {
      await prisma.saldo.update({
        where: { id: saldo.id },
        data: {
          cantidad: saldo.cantidad_calculada,
        },
      });

      console.log(
        `✅ Corregido: ${saldo.puntoAtencion} - ${saldo.moneda} (${saldo.cantidad_actual} → ${saldo.cantidad_calculada})`
      );
      corrected++;
    } catch (error) {
      console.error(`❌ Error corrigiendo ${saldo.id}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 RESUMEN DE CORRECCIÓN:`);
  console.log(`   Registros corregidos: ${corrected}`);
  console.log(`   Errores: ${errors}`);
  console.log(`   Total procesados: ${inconsistentSaldos.length}`);

  if (corrected > 0) {
    console.log(
      "\n✅ Corrección completada. Ejecuta el script de validación nuevamente para verificar."
    );
  }
}

async function manualFix(inconsistentSaldos: InconsistentSaldo[]) {
  console.log("\n🔍 Corrección manual:\n");

  for (let i = 0; i < inconsistentSaldos.length; i++) {
    const saldo = inconsistentSaldos[i];

    console.log(`\n--- Registro ${i + 1} de ${inconsistentSaldos.length} ---`);
    console.log(`ID: ${saldo.id}`);
    console.log(`Punto de Atención: ${saldo.puntoAtencion}`);
    console.log(`Moneda: ${saldo.moneda}`);
    console.log(`Cantidad Actual: ${saldo.cantidad_actual}`);
    console.log(`Billetes: ${saldo.billetes}`);
    console.log(`Monedas Físicas: ${saldo.monedas_fisicas}`);
    console.log(`Bancos: ${saldo.bancos}`);
    console.log(`Cantidad Calculada: ${saldo.cantidad_calculada}`);
    console.log(`Diferencia: ${saldo.diferencia.toFixed(2)}`);

    const action = await askQuestion(
      "\n¿Qué hacer? (c=corregir, s=saltar, q=salir): "
    );

    if (action.toLowerCase() === "q") {
      console.log("❌ Corrección manual cancelada.");
      break;
    } else if (action.toLowerCase() === "c") {
      try {
        await prisma.saldo.update({
          where: { id: saldo.id },
          data: {
            cantidad: saldo.cantidad_calculada,
          },
        });
        console.log(
          `✅ Corregido: ${saldo.cantidad_actual} → ${saldo.cantidad_calculada}`
        );
      } catch (error) {
        console.error(`❌ Error corrigiendo registro:`, error);
      }
    } else {
      console.log("⏭️ Saltando registro...");
    }
  }
}

async function backupAndFix(inconsistentSaldos: InconsistentSaldo[]) {
  console.log("\n💾 Creando backup antes de la corrección...\n");

  try {
    // Crear un backup de los registros que se van a modificar
    const backupData = {
      timestamp: new Date().toISOString(),
      records: inconsistentSaldos.map((s) => ({
        id: s.id,
        cantidad_original: s.cantidad_actual,
        cantidad_nueva: s.cantidad_calculada,
        puntoAtencion: s.puntoAtencion,
        moneda: s.moneda,
      })),
    };

    const backupFilename = `backup-saldos-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    const fs = await import("fs/promises");
    await fs.writeFile(backupFilename, JSON.stringify(backupData, null, 2));

    console.log(`✅ Backup creado: ${backupFilename}`);
    console.log(
      "📁 El backup contiene los valores originales para poder revertir si es necesario.\n"
    );

    // Proceder con la corrección automática
    await automaticFix(inconsistentSaldos);
  } catch (error) {
    console.error("❌ Error creando backup:", error);
    console.log("❌ Corrección cancelada por seguridad.");
  }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixInconsistentSaldos();
}

export { fixInconsistentSaldos };
