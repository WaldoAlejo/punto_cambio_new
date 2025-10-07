/**
 * Script de Reporte de Inconsistencias de Saldos
 *
 * Este script genera un reporte de TODAS las inconsistencias encontradas
 * entre los saldos registrados y los calculados, SIN hacer ninguna modificación.
 *
 * Uso:
 *   npx tsx scripts/reporte-inconsistencias-saldos.ts
 *
 * ℹ️ Este script es de solo lectura, no modifica ningún dato.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Inconsistencia {
  puntoNombre: string;
  monedaCodigo: string;
  saldoRegistrado: number;
  saldoCalculado: number;
  diferencia: number;
  movimientosCount: number;
}

/**
 * Calcula el saldo correcto basado en todos los movimientos registrados
 */
async function calcularSaldoReal(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  try {
    // 1. Obtener saldo inicial más reciente
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

    let saldoCalculado = saldoInicial
      ? Number(saldoInicial.cantidad_inicial)
      : 0;

    // 2. Obtener TODOS los movimientos
    const todosMovimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
      select: {
        monto: true,
        tipo_movimiento: true,
        descripcion: true,
      },
      orderBy: {
        fecha: "asc",
      },
    });

    // 3. Filtrar movimientos bancarios
    const movimientos = todosMovimientos.filter((mov) => {
      const desc = mov.descripcion?.toLowerCase() || "";
      return !desc.includes("bancos");
    });

    // 4. Calcular saldo basado en movimientos
    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      const tipoMovimiento = mov.tipo_movimiento;

      switch (tipoMovimiento) {
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

        default:
          saldoCalculado += monto;
          break;
      }
    }

    return Number(saldoCalculado.toFixed(2));
  } catch (error) {
    console.error("❌ Error calculando saldo real:", error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      REPORTE DE INCONSISTENCIAS DE SALDOS (SOLO LECTURA)  ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  try {
    // Obtener todos los saldos
    console.log("📊 Analizando todos los saldos...\n");

    const saldos = await prisma.saldo.findMany({
      include: {
        puntoAtencion: {
          select: { id: true, nombre: true },
        },
        moneda: {
          select: { id: true, codigo: true },
        },
      },
      orderBy: [
        { puntoAtencion: { nombre: "asc" } },
        { moneda: { codigo: "asc" } },
      ],
    });

    console.log(`✅ Se encontraron ${saldos.length} saldos para analizar\n`);
    console.log(
      "─────────────────────────────────────────────────────────────\n"
    );

    const inconsistencias: Inconsistencia[] = [];
    let procesados = 0;

    // Analizar cada saldo
    for (const saldo of saldos) {
      procesados++;
      process.stdout.write(
        `\rAnalizando... ${procesados}/${saldos.length} (${Math.round(
          (procesados / saldos.length) * 100
        )}%)`
      );

      const saldoRegistrado = Number(saldo.cantidad);
      const saldoCalculado = await calcularSaldoReal(
        saldo.punto_atencion_id,
        saldo.moneda_id
      );

      const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
      const requiereCorreccion = Math.abs(diferencia) > 0.01;

      if (requiereCorreccion) {
        const movimientosCount = await prisma.movimientoSaldo.count({
          where: {
            punto_atencion_id: saldo.punto_atencion_id,
            moneda_id: saldo.moneda_id,
          },
        });

        inconsistencias.push({
          puntoNombre: saldo.puntoAtencion.nombre,
          monedaCodigo: saldo.moneda.codigo,
          saldoRegistrado,
          saldoCalculado,
          diferencia,
          movimientosCount,
        });
      }
    }

    console.log(
      "\n\n═════════════════════════════════════════════════════════════"
    );
    console.log("                    RESUMEN DEL ANÁLISIS");
    console.log(
      "═════════════════════════════════════════════════════════════\n"
    );

    console.log(`📊 Total de saldos analizados:  ${saldos.length}`);
    console.log(
      `✅ Saldos correctos:            ${
        saldos.length - inconsistencias.length
      }`
    );
    console.log(`⚠️  Inconsistencias encontradas: ${inconsistencias.length}\n`);

    if (inconsistencias.length > 0) {
      console.log(
        "─────────────────────────────────────────────────────────────"
      );
      console.log("INCONSISTENCIAS DETECTADAS:");
      console.log(
        "─────────────────────────────────────────────────────────────\n"
      );

      // Ordenar por diferencia absoluta (mayor a menor)
      inconsistencias.sort(
        (a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)
      );

      for (const inc of inconsistencias) {
        console.log(`📍 ${inc.puntoNombre} - ${inc.monedaCodigo}`);
        console.log(`   Saldo Registrado: ${inc.saldoRegistrado.toFixed(2)}`);
        console.log(`   Saldo Calculado:  ${inc.saldoCalculado.toFixed(2)}`);
        console.log(
          `   Diferencia:       ${inc.diferencia.toFixed(2)} ${
            inc.diferencia > 0 ? "(exceso)" : "(faltante)"
          }`
        );
        console.log(`   Movimientos:      ${inc.movimientosCount}\n`);
      }

      // Calcular totales
      const totalDiferencia = inconsistencias.reduce(
        (sum, inc) => sum + inc.diferencia,
        0
      );

      console.log(
        "─────────────────────────────────────────────────────────────"
      );
      console.log("TOTALES:");
      console.log(
        "─────────────────────────────────────────────────────────────\n"
      );
      console.log(
        `💰 Diferencia total acumulada: ${totalDiferencia.toFixed(2)}\n`
      );

      console.log(
        "═════════════════════════════════════════════════════════════"
      );
      console.log("⚠️  ACCIÓN RECOMENDADA:");
      console.log(
        "═════════════════════════════════════════════════════════════\n"
      );
      console.log("Para corregir estas inconsistencias, ejecuta:");
      console.log("  npx tsx scripts/reconciliar-todos-saldos.ts\n");
    } else {
      console.log(
        "═════════════════════════════════════════════════════════════"
      );
      console.log("✅ TODOS LOS SALDOS ESTÁN CORRECTOS");
      console.log(
        "═════════════════════════════════════════════════════════════\n"
      );
      console.log(
        "No se encontraron inconsistencias. El sistema está cuadrado.\n"
      );
    }
  } catch (error) {
    console.error("\n❌ ERROR EN EL ANÁLISIS:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main()
  .then(() => {
    console.log("✅ Análisis completado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error ejecutando script:", error);
    process.exit(1);
  });
