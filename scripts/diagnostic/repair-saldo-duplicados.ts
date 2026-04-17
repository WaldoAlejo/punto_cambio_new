/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE REPARACIÓN: Saldos Duplicados por Bug en Asignación
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script corrige los saldos que fueron duplicados debido a un bug en
 * el servicio movimientoSaldoService.ts que causaba doble incremento al
 * asignar saldos iniciales.
 * 
 * El bug: Al asignar saldo inicial, se actualizaba la tabla Saldo y luego
 * el servicio volvía a incrementar el saldo ignorando el saldoBucket: "NINGUNO".
 * 
 * La solución: Recalcular el saldo correcto basado en SaldoInicial + movimientos
 * (excluyendo SALDO_INICIAL para evitar doble conteo) y actualizar la tabla Saldo.
 * 
 * Uso:
 *   npx ts-node scripts/repair-saldo-duplicados.ts
 *   npx ts-node scripts/repair-saldo-duplicados.ts --dry-run  (solo mostrar, no corregir)
 *   npx ts-node scripts/repair-saldo-duplicados.ts --punto-id <UUID>  (solo un punto)
 *   npx ts-node scripts/repair-saldo-duplicados.ts --moneda-id <UUID>  (solo una moneda)
 */

import prisma from "../../server/lib/prisma.js";
import { saldoReconciliationService } from "../../server/services/saldoReconciliationService.js";
import logger from "../../server/utils/logger.js";

interface RepairResult {
  punto_atencion_id: string;
  punto_nombre: string;
  moneda_id: string;
  moneda_codigo: string;
  saldo_actual: number;
  saldo_calculado: number;
  diferencia: number;
  corregido: boolean;
  error?: string;
}

async function repararSaldos(
  options: {
    dryRun?: boolean;
    puntoId?: string;
    monedaId?: string;
  } = {}
): Promise<RepairResult[]> {
  const resultados: RepairResult[] = [];

  try {
    // Obtener todos los puntos de atención activos
    const puntos = await prisma.puntoAtencion.findMany({
      where: options.puntoId ? { id: options.puntoId } : { activo: true },
      select: { id: true, nombre: true },
    });

    // Obtener todas las monedas activas
    const monedas = await prisma.moneda.findMany({
      where: options.monedaId ? { id: options.monedaId } : { activo: true },
      select: { id: true, codigo: true },
    });

    logger.info(`Iniciando reparación de saldos`, {
      puntos: puntos.length,
      monedas: monedas.length,
      dryRun: options.dryRun,
    });

    for (const punto of puntos) {
      for (const moneda of monedas) {
        try {
          // 1. Obtener saldo actual
          const saldoActual = await prisma.saldo.findUnique({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
            },
          });

          // 2. Calcular saldo correcto
          const saldoCalculado = await saldoReconciliationService.calcularSaldoReal(
            punto.id,
            moneda.id
          );

          const saldoActualNum = Number(saldoActual?.cantidad || 0);
          const diferencia = Number((saldoCalculado - saldoActualNum).toFixed(2));
          const necesitaCorreccion = Math.abs(diferencia) > 0.01;

          if (necesitaCorreccion) {
            logger.info(`Diferencia detectada`, {
              punto: punto.nombre,
              moneda: moneda.codigo,
              saldo_actual: saldoActualNum,
              saldo_calculado: saldoCalculado,
              diferencia,
            });

            if (!options.dryRun) {
              // Corregir el saldo
              await prisma.saldo.upsert({
                where: {
                  punto_atencion_id_moneda_id: {
                    punto_atencion_id: punto.id,
                    moneda_id: moneda.id,
                  },
                },
                update: {
                  cantidad: saldoCalculado,
                  // También actualizar billetes para mantener consistencia
                  billetes: saldoCalculado,
                  monedas_fisicas: 0,
                },
                create: {
                  punto_atencion_id: punto.id,
                  moneda_id: moneda.id,
                  cantidad: saldoCalculado,
                  billetes: saldoCalculado,
                  monedas_fisicas: 0,
                  bancos: 0,
                },
              });

              logger.info(`Saldo corregido`, {
                punto: punto.nombre,
                moneda: moneda.codigo,
                saldo_nuevo: saldoCalculado,
              });
            }
          }

          resultados.push({
            punto_atencion_id: punto.id,
            punto_nombre: punto.nombre,
            moneda_id: moneda.id,
            moneda_codigo: moneda.codigo,
            saldo_actual: saldoActualNum,
            saldo_calculado: saldoCalculado,
            diferencia,
            corregido: necesitaCorreccion && !options.dryRun,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Error procesando ${punto.nombre} / ${moneda.codigo}`, {
            error: errorMsg,
          });

          resultados.push({
            punto_atencion_id: punto.id,
            punto_nombre: punto.nombre,
            moneda_id: moneda.id,
            moneda_codigo: moneda.codigo,
            saldo_actual: 0,
            saldo_calculado: 0,
            diferencia: 0,
            corregido: false,
            error: errorMsg,
          });
        }
      }
    }

    return resultados;
  } catch (error) {
    logger.error("Error en reparación de saldos", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Parsear argumentos de línea de comandos
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    puntoId: args.find((_, i) => args[i - 1] === "--punto-id"),
    monedaId: args.find((_, i) => args[i - 1] === "--moneda-id"),
  };
}

// Ejecutar
async function main() {
  const options = parseArgs();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  REPARACIÓN DE SALDOS DUPLICADOS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  if (options.dryRun) {
    console.log("⚠️  MODO DRY-RUN: Solo se mostrarán las diferencias, no se corregirán");
    console.log();
  }

  try {
    const resultados = await repararSaldos(options);

    // Mostrar resumen
    const conDiferencias = resultados.filter((r) => Math.abs(r.diferencia) > 0.01);
    const corregidos = resultados.filter((r) => r.corregido);
    const conErrores = resultados.filter((r) => r.error);

    console.log();
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  RESUMEN");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`Total registros procesados: ${resultados.length}`);
    console.log(`Con diferencias: ${conDiferencias.length}`);
    console.log(`Corregidos: ${corregidos.length}`);
    console.log(`Con errores: ${conErrores.length}`);
    console.log();

    if (conDiferencias.length > 0) {
      console.log("Detalle de diferencias encontradas:");
      console.log("-".repeat(80));
      console.log(
        `${"Punto".padEnd(20)} ${"Moneda".padEnd(8)} ${"Actual".padStart(12)} ${"Calculado".padStart(12)} ${"Diferencia".padStart(12)} ${"Estado".padStart(10)}`
      );
      console.log("-".repeat(80));

      for (const r of conDiferencias) {
        const estado = r.corregido ? "✅ CORREGIDO" : options.dryRun ? "🔍 PENDIENTE" : "❌ ERROR";
        console.log(
          `${r.punto_nombre.slice(0, 20).padEnd(20)} ${r.moneda_codigo.padEnd(8)} ${r.saldo_actual.toFixed(2).padStart(12)} ${r.saldo_calculado.toFixed(2).padStart(12)} ${r.diferencia.toFixed(2).padStart(12)} ${estado.padStart(10)}`
        );
      }
    }

    if (conErrores.length > 0) {
      console.log();
      console.log("Errores:");
      for (const r of conErrores) {
        console.log(`  - ${r.punto_nombre} / ${r.moneda_codigo}: ${r.error}`);
      }
    }

    console.log();
    console.log("═══════════════════════════════════════════════════════════════");

    if (options.dryRun && conDiferencias.length > 0) {
      console.log();
      console.log("Para aplicar las correcciones, ejecute sin --dry-run:");
      console.log("  npx ts-node scripts/repair-saldo-duplicados.ts");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error ejecutando reparación:", error);
    process.exit(1);
  }
}

main();
