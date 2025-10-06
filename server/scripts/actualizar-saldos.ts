/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE ACTUALIZACIÓN DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO:
 * - Calcula saldos reales basándose en movimientos (excluyendo movimientos bancarios)
 * - Actualiza la tabla Saldo con los valores calculados
 *
 * ADVERTENCIA: Este script MODIFICA la base de datos
 *
 * USO:
 * PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" npx tsx server/scripts/actualizar-saldos.ts
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";
import { formatEcuadorDateTime, nowEcuador } from "../utils/timezone.js";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const FECHA_INICIO = new Date("2025-09-30T05:00:00.000Z");
const FECHA_CORTE = new Date("2025-10-03T04:00:00.000Z");

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES
// ═══════════════════════════════════════════════════════════════════════════

async function obtenerSaldoInicial(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
      fecha_asignacion: {
        lte: FECHA_CORTE,
      },
    },
    orderBy: {
      fecha_asignacion: "desc",
    },
  });

  return saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;
}

async function calcularSaldoReal(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  const saldoInicial = await obtenerSaldoInicial(puntoAtencionId, monedaId);

  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      fecha: {
        gte: FECHA_INICIO,
        lte: FECHA_CORTE,
      },
    },
    orderBy: {
      fecha: "asc",
    },
  });

  const movimientos = todosMovimientos.filter((mov) => {
    const desc = mov.descripcion?.toLowerCase() || "";
    return !desc.includes("bancos");
  });

  let saldoCalculado = saldoInicial;

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const tipo = mov.tipo_movimiento;

    switch (tipo) {
      case "SALDO_INICIAL":
        break;
      case "INGRESO":
        saldoCalculado += Math.abs(monto);
        break;
      case "EGRESO":
        saldoCalculado -= Math.abs(monto);
        break;
      case "AJUSTE":
        if (monto >= 0) {
          saldoCalculado += monto;
        } else {
          saldoCalculado -= Math.abs(monto);
        }
        break;
    }
  }

  return saldoCalculado;
}

async function corregirSignosIncorrectos(): Promise<number> {
  console.log("\n🔍 Verificando signos de movimientos...\n");

  // Buscar EGRESOS con montos positivos
  const egresosPositivos = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_movimiento: "EGRESO",
      monto: {
        gt: 0,
      },
    },
    include: {
      puntoAtencion: {
        select: { nombre: true },
      },
      moneda: {
        select: { codigo: true },
      },
    },
  });

  if (egresosPositivos.length === 0) {
    console.log("✅ No se encontraron EGRESOS con signos incorrectos.\n");
    return 0;
  }

  console.log(
    `⚠️  Se encontraron ${egresosPositivos.length} EGRESOS con montos positivos:\n`
  );

  // Mostrar los primeros 10
  const mostrar = egresosPositivos.slice(0, 10);
  for (const mov of mostrar) {
    console.log(
      `   - ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${Number(
        mov.monto
      ).toFixed(2)}`
    );
  }

  if (egresosPositivos.length > 10) {
    console.log(`   ... y ${egresosPositivos.length - 10} más\n`);
  } else {
    console.log("");
  }

  // Corregir automáticamente
  console.log("🔧 Corrigiendo signos...\n");

  let corregidos = 0;
  for (const mov of egresosPositivos) {
    try {
      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: {
          monto: -Math.abs(Number(mov.monto)),
        },
      });
      corregidos++;
    } catch (error) {
      console.error(`❌ Error corrigiendo movimiento ${mov.id}:`, error);
    }
  }

  console.log(`✅ Se corrigieron ${corregidos} movimientos.\n`);
  return corregidos;
}

function preguntarConfirmacion(pregunta: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(pregunta + " (si/no): ", (respuesta) => {
      rl.close();
      resolve(
        respuesta.toLowerCase() === "si" || respuesta.toLowerCase() === "s"
      );
    });
  });
}

async function main(): Promise<void> {
  console.log("\n" + "═".repeat(100));
  console.log("📊 ACTUALIZACIÓN DE SALDOS USD");
  console.log("═".repeat(100));
  console.log(
    `📅 Fecha de corte: ${formatEcuadorDateTime(FECHA_CORTE)} (Ecuador)`
  );
  console.log("═".repeat(100) + "\n");

  // PASO 1: Corregir signos incorrectos
  await corregirSignosIncorrectos();

  const usdMoneda = await prisma.moneda.findFirst({
    where: { codigo: "USD" },
  });

  if (!usdMoneda) {
    console.log("❌ No se encontró la moneda USD");
    return;
  }

  const puntos = await prisma.puntoAtencion.findMany({
    orderBy: { nombre: "asc" },
  });

  // Calcular todos los saldos primero
  const actualizaciones: Array<{
    punto: string;
    puntoId: string;
    saldoActual: number | null;
    saldoNuevo: number;
  }> = [];

  console.log("📋 SALDOS A ACTUALIZAR:");
  console.log("─".repeat(100));
  console.log(
    "Punto de Atención".padEnd(35) +
      "Saldo Actual".padStart(15) +
      "Saldo Nuevo".padStart(15) +
      "Diferencia".padStart(15)
  );
  console.log("─".repeat(100));

  for (const punto of puntos) {
    const saldoNuevo = await calcularSaldoReal(punto.id, usdMoneda.id);

    const saldoActualRecord = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: punto.id,
        moneda_id: usdMoneda.id,
      },
    });

    const saldoActual = saldoActualRecord
      ? Number(saldoActualRecord.cantidad)
      : null;
    const diferencia = saldoActual !== null ? saldoNuevo - saldoActual : null;

    actualizaciones.push({
      punto: punto.nombre,
      puntoId: punto.id,
      saldoActual,
      saldoNuevo,
    });

    const saldoActualStr =
      saldoActual !== null ? `$${saldoActual.toFixed(2)}` : "Sin saldo";
    const diferenciaStr =
      diferencia !== null
        ? diferencia >= 0
          ? `+$${diferencia.toFixed(2)}`
          : `-$${Math.abs(diferencia).toFixed(2)}`
        : "N/A";

    console.log(
      punto.nombre.padEnd(35) +
        saldoActualStr.padStart(15) +
        `$${saldoNuevo.toFixed(2)}`.padStart(15) +
        diferenciaStr.padStart(15)
    );
  }

  console.log("─".repeat(100) + "\n");

  // Pedir confirmación
  const confirmar = await preguntarConfirmacion(
    "⚠️  ¿Deseas actualizar la tabla Saldo con estos valores?"
  );

  if (!confirmar) {
    console.log("\n❌ Operación cancelada por el usuario.\n");
    return;
  }

  // Realizar las actualizaciones
  console.log("\n🔄 Actualizando saldos...\n");

  for (const act of actualizaciones) {
    try {
      await prisma.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: act.puntoId,
            moneda_id: usdMoneda.id,
          },
        },
        update: {
          cantidad: act.saldoNuevo,
          updated_at: new Date(),
        },
        create: {
          punto_atencion_id: act.puntoId,
          moneda_id: usdMoneda.id,
          cantidad: act.saldoNuevo,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });

      console.log(`✅ ${act.punto}: $${act.saldoNuevo.toFixed(2)}`);
    } catch (error) {
      console.error(`❌ Error actualizando ${act.punto}:`, error);
    }
  }

  console.log("\n" + "═".repeat(100));
  console.log("✅ ACTUALIZACIÓN COMPLETADA");
  console.log("═".repeat(100) + "\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
