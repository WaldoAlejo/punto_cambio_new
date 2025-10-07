/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE VERIFICACIÓN RÁPIDA DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROPÓSITO:
 * Verificar rápidamente que todos los saldos estén cuadrados
 *
 * USO:
 * npx tsx server/scripts/verificar-saldos.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function calcularSaldoReal(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  // Obtener saldo inicial
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    orderBy: {
      fecha_asignacion: "desc",
    },
  });

  const inicial = saldoInicial ? Number(saldoInicial.cantidad_inicial) : 0;

  // Obtener movimientos (excluyendo bancarios)
  const todosMovimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
    },
  });

  const movimientos = todosMovimientos.filter((mov) => {
    const desc = mov.descripcion?.toLowerCase() || "";
    return !desc.includes("bancos");
  });

  // Calcular totales
  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    const tipo = mov.tipo_movimiento;

    switch (tipo) {
      case "SALDO_INICIAL":
        break;
      case "INGRESO":
        totalIngresos += Math.abs(monto);
        break;
      case "EGRESO":
        totalEgresos += Math.abs(monto);
        break;
      case "AJUSTE":
        if (monto >= 0) {
          totalIngresos += monto;
        } else {
          totalEgresos += Math.abs(monto);
        }
        break;
    }
  }

  return Number((inicial + totalIngresos - totalEgresos).toFixed(2));
}

async function main(): Promise<void> {
  console.log("\n" + "═".repeat(80));
  console.log("🔍 VERIFICACIÓN RÁPIDA DE SALDOS");
  console.log("═".repeat(80) + "\n");

  const saldos = await prisma.saldo.findMany({
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
    orderBy: [
      { puntoAtencion: { nombre: "asc" } },
      { moneda: { codigo: "asc" } },
    ],
  });

  let correctos = 0;
  let incorrectos = 0;
  const problemas: Array<{
    punto: string;
    moneda: string;
    registrado: number;
    calculado: number;
    diferencia: number;
  }> = [];

  for (const saldo of saldos) {
    const saldoRegistrado = Number(saldo.cantidad);
    const saldoCalculado = await calcularSaldoReal(
      saldo.punto_atencion_id,
      saldo.moneda_id
    );
    const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));

    if (Math.abs(diferencia) > 0.01) {
      incorrectos++;
      problemas.push({
        punto: saldo.puntoAtencion.nombre,
        moneda: saldo.moneda.codigo,
        registrado: saldoRegistrado,
        calculado: saldoCalculado,
        diferencia,
      });
    } else {
      correctos++;
    }
  }

  if (problemas.length === 0) {
    console.log("✅ TODOS LOS SALDOS ESTÁN CUADRADOS");
    console.log(`   Total verificados: ${correctos}`);
  } else {
    console.log("⚠️  SE ENCONTRARON PROBLEMAS:");
    console.log(`   Saldos correctos: ${correctos}`);
    console.log(`   Saldos con diferencias: ${incorrectos}\n`);

    console.log("─".repeat(80));
    console.log(
      "Punto".padEnd(30) +
        "Moneda".padEnd(10) +
        "Registrado".padStart(15) +
        "Calculado".padStart(15) +
        "Diferencia".padStart(15)
    );
    console.log("─".repeat(80));

    for (const p of problemas) {
      console.log(
        p.punto.padEnd(30) +
          p.moneda.padEnd(10) +
          `$${p.registrado.toFixed(2)}`.padStart(15) +
          `$${p.calculado.toFixed(2)}`.padStart(15) +
          `$${p.diferencia.toFixed(2)}`.padStart(15)
      );
    }
    console.log("─".repeat(80));

    console.log("\n💡 Para corregir, ejecuta:");
    console.log("   npx tsx server/scripts/reconciliacion-completa.ts\n");
  }

  console.log("═".repeat(80) + "\n");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
