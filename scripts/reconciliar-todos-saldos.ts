/**
 * Script de Reconciliación Masiva de Saldos
 *
 * Este script reconcilia TODOS los saldos de TODOS los puntos de atención,
 * corrigiendo cualquier inconsistencia entre el saldo registrado y el calculado
 * basado en los movimientos históricos.
 *
 * Uso:
 *   npx tsx scripts/reconciliar-todos-saldos.ts
 *
 * ⚠️ IMPORTANTE: Este script modifica directamente los saldos en la base de datos.
 * Se recomienda hacer un backup antes de ejecutarlo.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ReconciliationResult {
  puntoNombre: string;
  monedaCodigo: string;
  saldoAnterior: number;
  saldoCalculado: number;
  diferencia: number;
  corregido: boolean;
  movimientosCount: number;
  error?: string;
}

/**
 * Calcula el saldo correcto basado en todos los movimientos registrados
 *
 * Reglas:
 * 1. Los EGRESOS se guardan con monto NEGATIVO en la BD
 * 2. Los INGRESOS se guardan con monto POSITIVO en la BD
 * 3. Los AJUSTES mantienen su signo original
 * 4. Se excluyen movimientos con descripción que contenga "bancos"
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

    // 2. Obtener TODOS los movimientos (sin filtrar por tipo)
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

    // 3. Filtrar movimientos bancarios (igual que en los scripts)
    const movimientos = todosMovimientos.filter((mov) => {
      const desc = mov.descripcion?.toLowerCase() || "";
      return !desc.includes("bancos");
    });

    // 4. Calcular saldo basado en movimientos
    // ⚠️ CRÍTICO: Los montos YA tienen el signo correcto en la BD
    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      const tipoMovimiento = mov.tipo_movimiento;

      switch (tipoMovimiento) {
        case "SALDO_INICIAL":
          // Skip - ya incluido en saldo inicial
          break;

        case "INGRESO":
          // INGRESO: monto positivo en BD, sumar valor absoluto
          saldoCalculado += Math.abs(monto);
          break;

        case "EGRESO":
          // EGRESO: monto negativo en BD, restar valor absoluto
          saldoCalculado -= Math.abs(monto);
          break;

        case "AJUSTE":
          // AJUSTE: mantiene signo original
          if (monto >= 0) {
            saldoCalculado += monto;
          } else {
            saldoCalculado -= Math.abs(monto);
          }
          break;

        default:
          // Tipos desconocidos: sumar el monto tal cual
          console.warn(`⚠️ Tipo de movimiento desconocido: ${tipoMovimiento}`);
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
 * Reconcilia un saldo específico
 */
async function reconciliarSaldo(
  puntoAtencionId: string,
  puntoNombre: string,
  monedaId: string,
  monedaCodigo: string
): Promise<ReconciliationResult> {
  try {
    // Obtener saldo actual registrado
    const saldoActual = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
        },
      },
      select: {
        cantidad: true,
      },
    });

    const saldoRegistrado = Number(saldoActual?.cantidad ?? 0);

    // Calcular saldo real basado en movimientos
    const saldoCalculado = await calcularSaldoReal(puntoAtencionId, monedaId);

    // Contar movimientos para contexto
    const movimientosCount = await prisma.movimientoSaldo.count({
      where: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    });

    const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));
    const requiereCorreccion = Math.abs(diferencia) > 0.01; // Tolerancia de 1 centavo

    let corregido = false;

    if (requiereCorreccion) {
      console.log(
        `⚠️  ${puntoNombre} - ${monedaCodigo}: Inconsistencia detectada`
      );
      console.log(`   Saldo Registrado: ${saldoRegistrado.toFixed(2)}`);
      console.log(`   Saldo Calculado:  ${saldoCalculado.toFixed(2)}`);
      console.log(`   Diferencia:       ${diferencia.toFixed(2)}`);
      console.log(`   Movimientos:      ${movimientosCount}`);

      // Corregir el saldo directamente sin crear ajustes
      await prisma.saldo.upsert({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
          },
        },
        update: {
          cantidad: saldoCalculado,
          updated_at: new Date(),
        },
        create: {
          punto_atencion_id: puntoAtencionId,
          moneda_id: monedaId,
          cantidad: saldoCalculado,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });

      corregido = true;
      console.log(`   ✅ Saldo corregido a: ${saldoCalculado.toFixed(2)}\n`);
    }

    return {
      puntoNombre,
      monedaCodigo,
      saldoAnterior: saldoRegistrado,
      saldoCalculado,
      diferencia,
      corregido,
      movimientosCount,
    };
  } catch (error) {
    console.error(
      `❌ Error reconciliando ${puntoNombre} - ${monedaCodigo}:`,
      error
    );

    return {
      puntoNombre,
      monedaCodigo,
      saldoAnterior: 0,
      saldoCalculado: 0,
      diferencia: 0,
      corregido: false,
      movimientosCount: 0,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Función principal
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   RECONCILIACIÓN MASIVA DE SALDOS - TODOS LOS PUNTOS      ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  try {
    // Obtener todos los saldos con información de punto y moneda
    console.log("📊 Obteniendo todos los saldos...\n");

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

    console.log(`✅ Se encontraron ${saldos.length} saldos para reconciliar\n`);
    console.log(
      "─────────────────────────────────────────────────────────────\n"
    );

    const resultados: ReconciliationResult[] = [];

    // Reconciliar cada saldo
    for (const saldo of saldos) {
      const resultado = await reconciliarSaldo(
        saldo.punto_atencion_id,
        saldo.puntoAtencion.nombre,
        saldo.moneda_id,
        saldo.moneda.codigo
      );
      resultados.push(resultado);
    }

    // Generar resumen
    console.log(
      "\n═════════════════════════════════════════════════════════════"
    );
    console.log("                    RESUMEN DE RECONCILIACIÓN");
    console.log(
      "═════════════════════════════════════════════════════════════\n"
    );

    const corregidos = resultados.filter((r) => r.corregido);
    const conErrores = resultados.filter((r) => r.error);
    const sinCambios = resultados.filter((r) => !r.corregido && !r.error);

    console.log(`📊 Total de saldos procesados:  ${resultados.length}`);
    console.log(`✅ Saldos corregidos:           ${corregidos.length}`);
    console.log(`✓  Saldos sin cambios:          ${sinCambios.length}`);
    console.log(`❌ Errores:                     ${conErrores.length}\n`);

    if (corregidos.length > 0) {
      console.log(
        "─────────────────────────────────────────────────────────────"
      );
      console.log("SALDOS CORREGIDOS:");
      console.log(
        "─────────────────────────────────────────────────────────────\n"
      );

      for (const resultado of corregidos) {
        console.log(`📍 ${resultado.puntoNombre} - ${resultado.monedaCodigo}`);
        console.log(`   Anterior:   ${resultado.saldoAnterior.toFixed(2)}`);
        console.log(`   Corregido:  ${resultado.saldoCalculado.toFixed(2)}`);
        console.log(`   Diferencia: ${resultado.diferencia.toFixed(2)}`);
        console.log(`   Movimientos: ${resultado.movimientosCount}\n`);
      }
    }

    if (conErrores.length > 0) {
      console.log(
        "─────────────────────────────────────────────────────────────"
      );
      console.log("ERRORES ENCONTRADOS:");
      console.log(
        "─────────────────────────────────────────────────────────────\n"
      );

      for (const resultado of conErrores) {
        console.log(`❌ ${resultado.puntoNombre} - ${resultado.monedaCodigo}`);
        console.log(`   Error: ${resultado.error}\n`);
      }
    }

    console.log(
      "═════════════════════════════════════════════════════════════"
    );
    console.log("✅ RECONCILIACIÓN COMPLETADA EXITOSAMENTE");
    console.log(
      "═════════════════════════════════════════════════════════════\n"
    );
  } catch (error) {
    console.error("\n❌ ERROR FATAL EN RECONCILIACIÓN:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main()
  .then(() => {
    console.log("✅ Script finalizado correctamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error ejecutando script:", error);
    process.exit(1);
  });
