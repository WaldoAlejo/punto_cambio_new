import prisma from "../lib/prisma";
import { TipoMovimiento } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Script para recalcular saldos correctamente
 *
 * IMPORTANTE: Este script recalcula los saldos basándose en:
 * - Cambios de divisa COMPLETADOS
 * - Transferencias APROBADAS (no PENDIENTES ni RECHAZADAS)
 * - Servicios externos (todos los tipos)
 *
 * NO elimina duplicados automáticamente para evitar pérdida de datos.
 */

// Función auxiliar para sumar Decimals
function sumarDecimales(items: any[], campo: string): Decimal {
  return items.reduce((acc, item) => {
    const valor = item[campo];
    if (valor) {
      return new Decimal(acc).plus(new Decimal(valor));
    }
    return acc;
  }, new Decimal(0));
}

// Analiza duplicados sin eliminarlos
async function analizarDuplicadosCambioDivisa() {
  console.log("\n📊 Analizando duplicados en CambioDivisa...");

  const movimientos = await prisma.cambioDivisa.findMany({
    orderBy: { fecha: "asc" },
  });

  const seen = new Map<string, any[]>();

  for (const mov of movimientos) {
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

    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(mov);
  }

  const duplicados = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicados.length > 0) {
    console.log(
      `⚠️  Encontrados ${duplicados.length} grupos de duplicados en CambioDivisa`
    );
    console.log("   IDs de los primeros 5 grupos:");
    duplicados.slice(0, 5).forEach((group, idx) => {
      console.log(`   Grupo ${idx + 1}: ${group.map((m) => m.id).join(", ")}`);
    });
    console.log("\n   ⚠️  REVISA MANUALMENTE antes de eliminar");
  } else {
    console.log("✅ No se encontraron duplicados en CambioDivisa");
  }
}

async function analizarDuplicadosTransferencia() {
  console.log("\n📊 Analizando duplicados en Transferencia...");

  const movimientos = await prisma.transferencia.findMany({
    orderBy: { fecha: "asc" },
  });

  const seen = new Map<string, any[]>();

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

    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(mov);
  }

  const duplicados = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicados.length > 0) {
    console.log(
      `⚠️  Encontrados ${duplicados.length} grupos de duplicados en Transferencia`
    );
    console.log("   IDs de los primeros 5 grupos:");
    duplicados.slice(0, 5).forEach((group, idx) => {
      console.log(`   Grupo ${idx + 1}: ${group.map((m) => m.id).join(", ")}`);
    });
    console.log("\n   ⚠️  REVISA MANUALMENTE antes de eliminar");
  } else {
    console.log("✅ No se encontraron duplicados en Transferencia");
  }
}

async function analizarDuplicadosServicioExternoMovimiento() {
  console.log("\n📊 Analizando duplicados en ServicioExternoMovimiento...");

  const movimientos = await prisma.servicioExternoMovimiento.findMany({
    orderBy: { fecha: "asc" },
  });

  const seen = new Map<string, any[]>();

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

    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(mov);
  }

  const duplicados = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicados.length > 0) {
    console.log(
      `⚠️  Encontrados ${duplicados.length} grupos de duplicados en ServicioExternoMovimiento`
    );
    console.log("   IDs de los primeros 5 grupos:");
    duplicados.slice(0, 5).forEach((group, idx) => {
      console.log(`   Grupo ${idx + 1}: ${group.map((m) => m.id).join(", ")}`);
    });
    console.log("\n   ⚠️  REVISA MANUALMENTE antes de eliminar");
  } else {
    console.log("✅ No se encontraron duplicados en ServicioExternoMovimiento");
  }
}

// Recalcula y actualiza los saldos por punto y moneda
async function recalcularSaldos() {
  console.log("\n🔄 Recalculando saldos...\n");

  // Todas las combinaciones de punto y moneda
  const saldos = await prisma.saldo.findMany({
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
  });

  let totalActualizados = 0;
  let totalSinCambios = 0;

  for (const saldo of saldos) {
    const { punto_atencion_id, moneda_id } = saldo;

    // ✅ OBTENER SALDO INICIAL (si existe)
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id,
        moneda_id,
      },
    });

    const cantidadInicial = saldoInicial?.cantidad_inicial
      ? new Decimal(saldoInicial.cantidad_inicial)
      : new Decimal(0);

    // ✅ Cambios de divisa COMPLETADOS (como destino y origen)
    const cambiosOrigen = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id,
        moneda_origen_id: moneda_id,
        estado: "COMPLETADO", // ✅ Solo completados
      },
    });

    const cambiosDestino = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id,
        moneda_destino_id: moneda_id,
        estado: "COMPLETADO", // ✅ Solo completados
      },
    });

    // ✅ Transferencias APROBADAS (no pendientes ni rechazadas)
    const transferenciasEntrada = await prisma.transferencia.findMany({
      where: {
        destino_id: punto_atencion_id,
        moneda_id,
        estado: "APROBADO", // ✅ Solo aprobadas
      },
    });

    const transferenciasSalida = await prisma.transferencia.findMany({
      where: {
        origen_id: punto_atencion_id,
        moneda_id,
        estado: "APROBADO", // ✅ Solo aprobadas
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

    // Suma de ingresos
    const ingresosFromCambios = sumarDecimales(cambiosDestino, "monto_destino");
    const ingresosFromTransferencias = sumarDecimales(
      transferenciasEntrada,
      "monto"
    );
    const ingresosFromServicios = sumarDecimales(serviciosIngresos, "monto");

    const totalIngresos = new Decimal(ingresosFromCambios)
      .plus(ingresosFromTransferencias)
      .plus(ingresosFromServicios);

    // Suma de egresos
    const egresosFromCambios = sumarDecimales(cambiosOrigen, "monto_origen");
    const egresosFromTransferencias = sumarDecimales(
      transferenciasSalida,
      "monto"
    );
    const egresosFromServicios = sumarDecimales(serviciosEgresos, "monto");

    const totalEgresos = new Decimal(egresosFromCambios)
      .plus(egresosFromTransferencias)
      .plus(egresosFromServicios);

    // ✅ El saldo es: SALDO_INICIAL + ingresos - egresos
    const saldoCalculado = cantidadInicial
      .plus(totalIngresos)
      .minus(totalEgresos);
    const saldoActual = new Decimal(saldo.cantidad);

    // Solo actualizar si hay diferencia
    if (!saldoCalculado.equals(saldoActual)) {
      await prisma.saldo.updateMany({
        where: { punto_atencion_id, moneda_id },
        data: { cantidad: saldoCalculado },
      });

      const diferencia = saldoCalculado.minus(saldoActual);
      console.log(
        `📝 ${saldo.puntoAtencion.nombre} - ${saldo.moneda.codigo}:\n` +
          `   Anterior: ${saldoActual.toFixed(2)}\n` +
          `   Calculado: ${saldoCalculado.toFixed(2)}\n` +
          `   Diferencia: ${diferencia.toFixed(2)}\n` +
          `   (Inicial: ${cantidadInicial.toFixed(
            2
          )} + Ingresos: ${totalIngresos.toFixed(
            2
          )} - Egresos: ${totalEgresos.toFixed(2)})\n`
      );
      totalActualizados++;
    } else {
      totalSinCambios++;
    }
  }

  console.log(`\n✅ Recalculación completada:`);
  console.log(`   - ${totalActualizados} saldos actualizados`);
  console.log(`   - ${totalSinCambios} saldos sin cambios`);
}

async function main() {
  console.log("🚀 Iniciando análisis y recalculación de base de datos...\n");
  console.log("=".repeat(60));

  // Paso 1: Analizar duplicados (sin eliminar)
  await analizarDuplicadosCambioDivisa();
  await analizarDuplicadosTransferencia();
  await analizarDuplicadosServicioExternoMovimiento();

  console.log("\n" + "=".repeat(60));

  // Paso 2: Recalcular saldos
  await recalcularSaldos();

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Proceso completado exitosamente");
  console.log("\n⚠️  IMPORTANTE:");
  console.log("   - Si se encontraron duplicados, revísalos manualmente");
  console.log("   - Verifica los saldos actualizados en la aplicación");
  console.log("   - Este script solo recalcula, no elimina datos\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Error durante la ejecución:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
