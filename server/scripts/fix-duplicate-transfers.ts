/**
 * Script para corregir transferencias duplicadas
 *
 * Este script:
 * 1. Identifica transferencias que tienen movimientos de saldo duplicados
 * 2. Elimina los movimientos duplicados (los primeros, dejando solo los de aprobación)
 * 3. Recalcula los saldos correctos
 *
 * ⚠️ IMPORTANTE: Este script debe ejecutarse UNA SOLA VEZ después de aplicar el fix
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TransferWithDuplicates {
  transferId: string;
  numeroRecibo: string;
  monto: number;
  origenId: string | null;
  destinoId: string;
  monedaId: string;
  movimientosOrigen: number;
  movimientosDestino: number;
}

async function identificarTransferenciasDuplicadas(): Promise<
  TransferWithDuplicates[]
> {
  console.log("🔍 Buscando transferencias con movimientos duplicados...\n");

  const transferencias = await prisma.transferencia.findMany({
    where: {
      estado: "APROBADO",
    },
    orderBy: {
      fecha: "desc",
    },
    take: 100, // Revisar las últimas 100 transferencias aprobadas
  });

  const duplicadas: TransferWithDuplicates[] = [];

  for (const t of transferencias) {
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        referencia_id: t.id,
        tipo_referencia: "TRANSFER",
      },
    });

    const movimientosOrigen = movimientos.filter(
      (m) =>
        t.origen_id &&
        m.punto_atencion_id === t.origen_id &&
        m.tipo_movimiento === "EGRESO"
    );

    const movimientosDestino = movimientos.filter(
      (m) =>
        m.punto_atencion_id === t.destino_id && m.tipo_movimiento === "INGRESO"
    );

    // Si hay más de 1 movimiento de egreso u origen, está duplicado
    if (movimientosOrigen.length > 1 || movimientosDestino.length > 1) {
      duplicadas.push({
        transferId: t.id,
        numeroRecibo: t.numero_recibo || "N/A",
        monto: Number(t.monto),
        origenId: t.origen_id,
        destinoId: t.destino_id,
        monedaId: t.moneda_id,
        movimientosOrigen: movimientosOrigen.length,
        movimientosDestino: movimientosDestino.length,
      });
    }
  }

  return duplicadas;
}

async function corregirTransferenciaDuplicada(
  transfer: TransferWithDuplicates
) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔧 Corrigiendo transferencia: ${transfer.numeroRecibo}`);
  console.log(`   Transfer ID: ${transfer.transferId}`);
  console.log(`   Monto: ${transfer.monto}`);
  console.log(`   Movimientos origen: ${transfer.movimientosOrigen}`);
  console.log(`   Movimientos destino: ${transfer.movimientosDestino}`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Obtener todos los movimientos de esta transferencia
      const movimientos = await tx.movimientoSaldo.findMany({
        where: {
          referencia_id: transfer.transferId,
          tipo_referencia: "TRANSFER",
        },
        orderBy: {
          fecha: "asc",
        },
      });

      console.log(
        `\n   📋 Total de movimientos encontrados: ${movimientos.length}`
      );

      // 2. Identificar movimientos a eliminar (los primeros, que son de la creación)
      const movimientosOrigen = movimientos.filter(
        (m) =>
          transfer.origenId &&
          m.punto_atencion_id === transfer.origenId &&
          m.tipo_movimiento === "EGRESO"
      );

      const movimientosDestino = movimientos.filter(
        (m) =>
          m.punto_atencion_id === transfer.destinoId &&
          m.tipo_movimiento === "INGRESO"
      );

      // Eliminar el PRIMER movimiento de cada tipo (el de la creación)
      // Mantener el ÚLTIMO (el de la aprobación)
      const movimientosAEliminar: string[] = [];

      if (movimientosOrigen.length > 1) {
        // Eliminar todos excepto el último
        for (let i = 0; i < movimientosOrigen.length - 1; i++) {
          movimientosAEliminar.push(movimientosOrigen[i].id);
        }
      }

      if (movimientosDestino.length > 1) {
        // Eliminar todos excepto el último
        for (let i = 0; i < movimientosDestino.length - 1; i++) {
          movimientosAEliminar.push(movimientosDestino[i].id);
        }
      }

      console.log(
        `   🗑️  Movimientos a eliminar: ${movimientosAEliminar.length}`
      );

      // 3. Eliminar movimientos duplicados
      if (movimientosAEliminar.length > 0) {
        const deleted = await tx.movimientoSaldo.deleteMany({
          where: {
            id: {
              in: movimientosAEliminar,
            },
          },
        });

        console.log(`   ✅ Eliminados ${deleted.count} movimientos duplicados`);
      }

      // 4. Recalcular saldos
      // Para cada punto afectado, recalcular el saldo basado en los movimientos restantes
      const puntosAfectados = new Set<string>();
      if (transfer.origenId) puntosAfectados.add(transfer.origenId);
      puntosAfectados.add(transfer.destinoId);

      for (const puntoId of puntosAfectados) {
        console.log(`\n   🧮 Recalculando saldo para punto: ${puntoId}`);

        // Obtener todos los movimientos de este punto y moneda, ordenados por fecha
        const todosMovimientos = await tx.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: puntoId,
            moneda_id: transfer.monedaId,
          },
          orderBy: {
            fecha: "asc",
          },
        });

        if (todosMovimientos.length === 0) {
          console.log(`   ⚠️  No hay movimientos para este punto`);
          continue;
        }

        // El saldo actual debería ser el saldo_nuevo del último movimiento
        const ultimoMovimiento = todosMovimientos[todosMovimientos.length - 1];
        const saldoCalculado = Number(ultimoMovimiento.saldo_nuevo);

        console.log(`   📊 Saldo calculado: ${saldoCalculado}`);

        // Actualizar el saldo en la tabla saldo
        await tx.saldo.upsert({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoId,
              moneda_id: transfer.monedaId,
            },
          },
          update: {
            cantidad: saldoCalculado,
            updated_at: new Date(),
          },
          create: {
            punto_atencion_id: puntoId,
            moneda_id: transfer.monedaId,
            cantidad: saldoCalculado,
            billetes: 0,
            monedas_fisicas: 0,
            bancos: 0,
          },
        });

        console.log(`   ✅ Saldo actualizado correctamente`);
      }
    });

    console.log(`\n✅ Transferencia corregida exitosamente`);
  } catch (error) {
    console.error(`\n❌ Error al corregir transferencia:`, error);
    throw error;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Script de Corrección de Transferencias Duplicadas        ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  try {
    // 1. Identificar transferencias duplicadas
    const duplicadas = await identificarTransferenciasDuplicadas();

    if (duplicadas.length === 0) {
      console.log("✅ No se encontraron transferencias duplicadas\n");
      return;
    }

    console.log(
      `⚠️  Se encontraron ${duplicadas.length} transferencias con duplicación:\n`
    );

    for (const t of duplicadas) {
      console.log(
        `   • ${t.numeroRecibo} - Monto: ${t.monto} - Movimientos: ${
          t.movimientosOrigen + t.movimientosDestino
        }`
      );
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`🔧 Iniciando corrección...\n`);

    // 2. Corregir cada transferencia
    for (const transfer of duplicadas) {
      await corregirTransferenciaDuplicada(transfer);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`✅ Corrección completada exitosamente`);
    console.log(`   Transferencias corregidas: ${duplicadas.length}\n`);
  } catch (error) {
    console.error("\n❌ Error durante la corrección:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main();
