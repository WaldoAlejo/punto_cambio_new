import { TipoMovimiento } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../lib/prisma";

/**
 * Script de Recálculo y Limpieza de Base de Datos
 *
 * Este script realiza las siguientes operaciones:
 * 1. Elimina duplicados de CambioDivisa, Transferencia y ServicioExternoMovimiento
 * 2. Recalcula los saldos por punto de atención y moneda
 *
 * IMPORTANTE - Lógica de Cálculo de Saldos:
 * - Solo se consideran transacciones COMPLETADAS (CambioDivisa)
 * - Solo se consideran transferencias APROBADAS (Transferencia)
 * - Todos los servicios externos se procesan (no tienen estado)
 *
 * Fórmula de Balance:
 * Balance = Ingresos - Egresos
 *
 * Ingresos:
 *   + Cambios de divisa donde la moneda es DESTINO (monto_destino)
 *   + Transferencias RECIBIDAS (destino_id = punto)
 *   + Servicios externos tipo INGRESO
 *
 * Egresos:
 *   - Cambios de divisa donde la moneda es ORIGEN (monto_origen)
 *   - Transferencias ENVIADAS (origen_id = punto)
 *   - Servicios externos tipo EGRESO
 *
 * Esta lógica debe ser consistente con el endpoint /api/balance-completo
 */

// Elimina duplicados por campos clave (ajusta los campos si lo necesitas)
async function eliminarDuplicadosCambioDivisa() {
  const movimientos = await prisma.cambioDivisa.findMany();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const mov of movimientos) {
    // Considera duplicado si coinciden estos campos
    const key = [
      mov.monto_origen?.toString(),
      mov.monto_destino?.toString(),
      mov.moneda_origen_id,
      mov.moneda_destino_id,
      mov.punto_atencion_id,
      mov.fecha?.toISOString(),
      mov.tipo_operacion,
      mov.numero_recibo ?? "",
    ].join("|");

    if (seen.has(key)) {
      toDelete.push(mov.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await prisma.cambioDivisa.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`Eliminados ${toDelete.length} duplicados de CambioDivisa`);
  }
}

async function eliminarDuplicadosTransferencia() {
  const movimientos = await prisma.transferencia.findMany();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const mov of movimientos) {
    const key = [
      mov.monto?.toString(),
      mov.moneda_id,
      mov.origen_id ?? "",
      mov.destino_id,
      mov.fecha?.toISOString(),
      mov.tipo_transferencia,
      mov.numero_recibo ?? "",
    ].join("|");

    if (seen.has(key)) {
      toDelete.push(mov.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await prisma.transferencia.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`Eliminados ${toDelete.length} duplicados de Transferencia`);
  }
}

async function eliminarDuplicadosServicioExternoMovimiento() {
  const movimientos = await prisma.servicioExternoMovimiento.findMany();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const mov of movimientos) {
    const key = [
      mov.monto?.toString(),
      mov.moneda_id,
      mov.punto_atencion_id,
      mov.servicio,
      mov.tipo_movimiento,
      mov.fecha?.toISOString(),
      mov.numero_referencia ?? "",
    ].join("|");

    if (seen.has(key)) {
      toDelete.push(mov.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await prisma.servicioExternoMovimiento.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(
      `Eliminados ${toDelete.length} duplicados de ServicioExternoMovimiento`
    );
  }
}

// Recalcula y actualiza los saldos por punto y moneda
async function recalcularSaldos() {
  // Todas las combinaciones de punto y moneda
  const saldos = await prisma.saldo.findMany({
    select: { punto_atencion_id: true, moneda_id: true },
  });

  for (const { punto_atencion_id, moneda_id } of saldos) {
    // Cambios de divisa (como destino y origen) - SOLO COMPLETADOS
    const cambiosOrigen = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id,
        moneda_origen_id: moneda_id,
        estado: "COMPLETADO", // ✅ Filtrar solo transacciones completadas
      },
    });
    const cambiosDestino = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id,
        moneda_destino_id: moneda_id,
        estado: "COMPLETADO", // ✅ Filtrar solo transacciones completadas
      },
    });

    // Transferencias recibidas y enviadas - SOLO APROBADAS
    const transferenciasEntrada = await prisma.transferencia.findMany({
      where: {
        destino_id: punto_atencion_id,
        moneda_id,
        estado: "APROBADO", // ✅ Filtrar solo transferencias aprobadas
      },
    });
    const transferenciasSalida = await prisma.transferencia.findMany({
      where: {
        origen_id: punto_atencion_id,
        moneda_id,
        estado: "APROBADO", // ✅ Filtrar solo transferencias aprobadas
      },
    });

    // Servicios externos
    const serviciosIngresos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id,
        moneda_id,
        tipo_movimiento: TipoMovimiento.INGRESO,
      },
    });
    const serviciosEgresos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id,
        moneda_id,
        tipo_movimiento: TipoMovimiento.EGRESO,
      },
    });

    // Suma de ingresos y egresos
    const ingresos = cambiosDestino
      .reduce((a: Decimal, b) => a.plus(b.monto_destino), new Decimal(0))
      .plus(
        transferenciasEntrada.reduce(
          (a: Decimal, b) => a.plus(b.monto),
          new Decimal(0)
        )
      )
      .plus(
        serviciosIngresos.reduce(
          (a: Decimal, b) => a.plus(b.monto),
          new Decimal(0)
        )
      );

    const egresos = cambiosOrigen
      .reduce((a: Decimal, b) => a.plus(b.monto_origen), new Decimal(0))
      .plus(
        transferenciasSalida.reduce(
          (a: Decimal, b) => a.plus(b.monto),
          new Decimal(0)
        )
      )
      .plus(
        serviciosEgresos.reduce(
          (a: Decimal, b) => a.plus(b.monto),
          new Decimal(0)
        )
      );

    // El saldo es ingresos - egresos
    const saldoFinal = ingresos.minus(egresos);

    await prisma.saldo.updateMany({
      where: { punto_atencion_id, moneda_id },
      data: { cantidad: saldoFinal },
    });

    console.log(
      `Saldo actualizado para punto ${punto_atencion_id}, moneda ${moneda_id}: ${saldoFinal.toFixed(
        2
      )}`
    );
  }
}

async function main() {
  await eliminarDuplicadosCambioDivisa();
  await eliminarDuplicadosTransferencia();
  await eliminarDuplicadosServicioExternoMovimiento();
  await recalcularSaldos();
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
