/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE RECONCILIACIÓN DE MOVIMIENTOS DE SALDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script corrige la inconsistencia entre la tabla Saldo y MovimientoSaldo
 * causada por transferencias aprobadas que no registraron movimientos.
 *
 * PROBLEMA:
 * - Las transferencias aprobadas actualizaban Saldo pero NO MovimientoSaldo
 * - Esto causaba diferencias entre el saldo real y el calculado desde movimientos
 *
 * SOLUCIÓN:
 * 1. Buscar todas las transferencias APROBADAS
 * 2. Verificar si tienen MovimientoSaldo correspondiente
 * 3. Si no existe, crear los movimientos faltantes (EGRESO origen, INGRESO destino)
 * 4. Recalcular saldos basándose en MovimientoSaldo
 *
 * USO:
 * npx tsx server/scripts/reconciliar-movimientos-saldo.ts
 */

import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

async function main() {
  console.log("🔍 Iniciando reconciliación de MovimientoSaldo...\n");

  // 1. Obtener todas las transferencias APROBADAS
  const transferencias = await prisma.transferencia.findMany({
    where: {
      estado: "APROBADO",
    },
    include: {
      origen: {
        select: { nombre: true },
      },
      destino: {
        select: { nombre: true },
      },
    },
    orderBy: {
      fecha_aprobacion: "asc",
    },
  });

  console.log(
    `📊 Total de transferencias aprobadas: ${transferencias.length}\n`
  );

  let transferenciasConProblemas = 0;
  let movimientosCreados = 0;

  for (const transfer of transferencias) {
    // Buscar movimientos relacionados con esta transferencia
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        tipo_referencia: "TRANSFER",
        referencia_id: transfer.id,
      },
      select: {
        id: true,
        tipo_movimiento: true,
        punto_atencion_id: true,
      },
    });

    // Verificar si tiene movimientos de EGRESO (origen) e INGRESO (destino)
    const tieneEgreso = transfer.origen_id
      ? movimientos.some(
          (m) =>
            m.tipo_movimiento === "EGRESO" &&
            m.punto_atencion_id === transfer.origen_id
        )
      : true; // Si no hay origen, no necesita EGRESO

    const tieneIngreso = movimientos.some(
      (m) =>
        m.tipo_movimiento === "INGRESO" &&
        m.punto_atencion_id === transfer.destino_id
    );

    if (!tieneEgreso || !tieneIngreso) {
      transferenciasConProblemas++;
      console.log(`⚠️  Transferencia ${transfer.id}:`);
      console.log(
        `    Origen: ${transfer.origen?.nombre || "Externa"} → Destino: ${
          transfer.destino?.nombre
        }`
      );
      console.log(`    Monto: ${transfer.monto}`);
      console.log(`    Fecha aprobación: ${transfer.fecha_aprobacion}`);
      console.log(
        `    Movimientos faltantes: ${!tieneEgreso ? "EGRESO" : ""} ${
          !tieneIngreso ? "INGRESO" : ""
        }`
      );

      // Crear movimientos faltantes
      try {
        await prisma.$transaction(async (tx) => {
          // Crear EGRESO para el origen (si aplica y no existe)
          if (transfer.origen_id && !tieneEgreso) {
            // Obtener el saldo actual del origen
            const saldoOrigen = await tx.saldo.findUnique({
              where: {
                punto_atencion_id_moneda_id: {
                  punto_atencion_id: transfer.origen_id,
                  moneda_id: transfer.moneda_id,
                },
              },
            });

            // Buscar el último movimiento antes de esta transferencia
            const ultimoMovimientoOrigen = await tx.movimientoSaldo.findFirst({
              where: {
                punto_atencion_id: transfer.origen_id,
                moneda_id: transfer.moneda_id,
                created_at: {
                  lt: transfer.fecha_aprobacion || new Date(),
                },
              },
              orderBy: {
                created_at: "desc",
              },
            });

            const saldoAnteriorOrigen = ultimoMovimientoOrigen
              ? Number(ultimoMovimientoOrigen.saldo_nuevo)
              : 0;
            const saldoNuevoOrigen =
              saldoAnteriorOrigen - Number(transfer.monto);

            await tx.movimientoSaldo.create({
              data: {
                punto_atencion_id: transfer.origen_id,
                moneda_id: transfer.moneda_id,
                tipo_movimiento: "EGRESO",
                monto: new Prisma.Decimal(-Number(transfer.monto)),
                saldo_anterior: new Prisma.Decimal(saldoAnteriorOrigen),
                saldo_nuevo: new Prisma.Decimal(saldoNuevoOrigen),
                tipo_referencia: "TRANSFER",
                referencia_id: transfer.id,
                descripcion: `[RECONCILIADO] Transferencia de salida a ${
                  transfer.destino?.nombre || "Externa"
                } - ${transfer.monto}`,
                usuario_id: transfer.aprobado_por || "SYSTEM",
                created_at: transfer.fecha_aprobacion || new Date(),
              },
            });

            movimientosCreados++;
            console.log(`    ✅ Creado EGRESO para origen`);
          }

          // Crear INGRESO para el destino (si no existe)
          if (!tieneIngreso) {
            // Buscar el último movimiento antes de esta transferencia
            const ultimoMovimientoDestino = await tx.movimientoSaldo.findFirst({
              where: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
                created_at: {
                  lt: transfer.fecha_aprobacion || new Date(),
                },
              },
              orderBy: {
                created_at: "desc",
              },
            });

            const saldoAnteriorDestino = ultimoMovimientoDestino
              ? Number(ultimoMovimientoDestino.saldo_nuevo)
              : 0;
            const saldoNuevoDestino =
              saldoAnteriorDestino + Number(transfer.monto);

            await tx.movimientoSaldo.create({
              data: {
                punto_atencion_id: transfer.destino_id,
                moneda_id: transfer.moneda_id,
                tipo_movimiento: "INGRESO",
                monto: new Prisma.Decimal(Number(transfer.monto)),
                saldo_anterior: new Prisma.Decimal(saldoAnteriorDestino),
                saldo_nuevo: new Prisma.Decimal(saldoNuevoDestino),
                tipo_referencia: "TRANSFER",
                referencia_id: transfer.id,
                descripcion: `[RECONCILIADO] Transferencia de entrada desde ${
                  transfer.origen?.nombre || "Externa"
                } - ${transfer.monto}`,
                usuario_id: transfer.aprobado_por || "SYSTEM",
                created_at: transfer.fecha_aprobacion || new Date(),
              },
            });

            movimientosCreados++;
            console.log(`    ✅ Creado INGRESO para destino`);
          }
        });
      } catch (error) {
        console.error(`    ❌ Error al crear movimientos:`, error);
      }

      console.log("");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 RESUMEN DE RECONCILIACIÓN");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total de transferencias aprobadas: ${transferencias.length}`);
  console.log(
    `Transferencias con problemas encontradas: ${transferenciasConProblemas}`
  );
  console.log(`Movimientos creados: ${movimientosCreados}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 2. Recalcular saldos basándose en MovimientoSaldo
  console.log("🔄 Recalculando saldos desde MovimientoSaldo...\n");

  // Obtener todos los saldos que existen
  const saldosExistentes = await prisma.saldo.findMany({
    select: {
      id: true,
      punto_atencion_id: true,
      moneda_id: true,
      cantidad: true,
    },
  });

  let saldosActualizados = 0;
  let saldosRevisados = 0;

  for (const saldoActual of saldosExistentes) {
    saldosRevisados++;

    // Obtener saldo inicial
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: saldoActual.punto_atencion_id,
        moneda_id: saldoActual.moneda_id,
        activo: true,
      },
    });

    const inicial = Number(saldoInicial?.cantidad_inicial || 0);

    // Sumar todos los movimientos usando aggregate (más eficiente)
    const agregado = await prisma.movimientoSaldo.aggregate({
      where: {
        punto_atencion_id: saldoActual.punto_atencion_id,
        moneda_id: saldoActual.moneda_id,
      },
      _sum: {
        monto: true,
      },
    });

    const totalMovimientos = Number(agregado._sum.monto || 0);
    const saldoCalculado = inicial + totalMovimientos;

    const diferencia = Math.abs(Number(saldoActual.cantidad) - saldoCalculado);

    if (diferencia > 0.01) {
      // Obtener nombres para el log
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: saldoActual.punto_atencion_id },
        select: { nombre: true },
      });
      const moneda = await prisma.moneda.findUnique({
        where: { id: saldoActual.moneda_id },
        select: { codigo: true },
      });

      console.log(
        `⚠️  ${punto?.nombre} - ${
          moneda?.codigo
        }: Diferencia de ${diferencia.toFixed(2)}`
      );
      console.log(
        `    Saldo en tabla: ${Number(saldoActual.cantidad).toFixed(2)}`
      );
      console.log(`    Saldo calculado: ${saldoCalculado.toFixed(2)}`);

      // Actualizar saldo
      await prisma.saldo.update({
        where: { id: saldoActual.id },
        data: {
          cantidad: new Prisma.Decimal(saldoCalculado),
          updated_at: new Date(),
        },
      });

      saldosActualizados++;
      console.log(`    ✅ Saldo actualizado\n`);
    }
  }

  console.log(`📊 Saldos revisados: ${saldosRevisados}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✅ RECONCILIACIÓN COMPLETADA");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Saldos actualizados: ${saldosActualizados}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
