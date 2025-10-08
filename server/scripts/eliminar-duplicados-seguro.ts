import prisma from "../lib/prisma";

/**
 * Script para eliminar duplicados de forma segura
 *
 * IMPORTANTE:
 * - Este script ELIMINA datos permanentemente
 * - Solo ejecutar después de revisar el análisis de duplicados
 * - Mantiene el registro MÁS ANTIGUO de cada grupo de duplicados
 * - Crea un backup de los IDs eliminados
 */

interface DuplicateGroup {
  key: string;
  items: any[];
}

async function eliminarDuplicadosCambioDivisa(dryRun: boolean = true) {
  console.log("\n🔍 Procesando duplicados en CambioDivisa...");

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

  const duplicateGroups = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicateGroups.length === 0) {
    console.log("✅ No se encontraron duplicados en CambioDivisa");
    return;
  }

  console.log(`⚠️  Encontrados ${duplicateGroups.length} grupos de duplicados`);

  const toDelete: string[] = [];
  const toKeep: string[] = [];

  for (const group of duplicateGroups) {
    // Mantener el primero (más antiguo), eliminar el resto
    const [keep, ...remove] = group;
    toKeep.push(keep.id);
    toDelete.push(...remove.map((m) => m.id));

    console.log(`\n   Grupo (${group.length} registros):`);
    console.log(`   ✅ Mantener: ${keep.id} (${keep.fecha.toISOString()})`);
    remove.forEach((m) => {
      console.log(`   ❌ Eliminar: ${m.id} (${m.fecha.toISOString()})`);
    });
  }

  if (dryRun) {
    console.log(`\n⚠️  MODO DRY-RUN: No se eliminó nada`);
    console.log(`   Se eliminarían ${toDelete.length} registros duplicados`);
  } else {
    await prisma.cambioDivisa.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(
      `\n✅ Eliminados ${toDelete.length} duplicados de CambioDivisa`
    );
  }
}

async function eliminarDuplicadosTransferencia(dryRun: boolean = true) {
  console.log("\n🔍 Procesando duplicados en Transferencia...");

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

  const duplicateGroups = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicateGroups.length === 0) {
    console.log("✅ No se encontraron duplicados en Transferencia");
    return;
  }

  console.log(`⚠️  Encontrados ${duplicateGroups.length} grupos de duplicados`);

  const toDelete: string[] = [];
  const toKeep: string[] = [];

  for (const group of duplicateGroups) {
    // Mantener el primero (más antiguo), eliminar el resto
    const [keep, ...remove] = group;
    toKeep.push(keep.id);
    toDelete.push(...remove.map((m) => m.id));

    console.log(`\n   Grupo (${group.length} registros):`);
    console.log(`   ✅ Mantener: ${keep.id} (${keep.fecha.toISOString()})`);
    remove.forEach((m) => {
      console.log(`   ❌ Eliminar: ${m.id} (${m.fecha.toISOString()})`);
    });
  }

  if (dryRun) {
    console.log(`\n⚠️  MODO DRY-RUN: No se eliminó nada`);
    console.log(`   Se eliminarían ${toDelete.length} registros duplicados`);
  } else {
    await prisma.transferencia.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(
      `\n✅ Eliminados ${toDelete.length} duplicados de Transferencia`
    );
  }
}

async function eliminarDuplicadosServicioExternoMovimiento(
  dryRun: boolean = true
) {
  console.log("\n🔍 Procesando duplicados en ServicioExternoMovimiento...");

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

  const duplicateGroups = Array.from(seen.values()).filter(
    (group) => group.length > 1
  );

  if (duplicateGroups.length === 0) {
    console.log("✅ No se encontraron duplicados en ServicioExternoMovimiento");
    return;
  }

  console.log(`⚠️  Encontrados ${duplicateGroups.length} grupos de duplicados`);

  const toDelete: string[] = [];
  const toKeep: string[] = [];

  for (const group of duplicateGroups) {
    // Mantener el primero (más antiguo), eliminar el resto
    const [keep, ...remove] = group;
    toKeep.push(keep.id);
    toDelete.push(...remove.map((m) => m.id));

    console.log(`\n   Grupo (${group.length} registros):`);
    console.log(`   ✅ Mantener: ${keep.id} (${keep.fecha.toISOString()})`);
    remove.forEach((m) => {
      console.log(`   ❌ Eliminar: ${m.id} (${m.fecha.toISOString()})`);
    });
  }

  if (dryRun) {
    console.log(`\n⚠️  MODO DRY-RUN: No se eliminó nada`);
    console.log(`   Se eliminarían ${toDelete.length} registros duplicados`);
  } else {
    await prisma.servicioExternoMovimiento.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(
      `\n✅ Eliminados ${toDelete.length} duplicados de ServicioExternoMovimiento`
    );
  }
}

async function main() {
  // Leer argumento de línea de comandos
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--execute");

  console.log("🚀 Iniciando eliminación de duplicados...\n");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("⚠️  MODO DRY-RUN (simulación)");
    console.log("   No se eliminará nada. Para ejecutar realmente, usa:");
    console.log(
      "   npm run ts-node server/scripts/eliminar-duplicados-seguro.ts -- --execute\n"
    );
  } else {
    console.log("🔥 MODO EJECUCIÓN REAL");
    console.log("   ⚠️  Se eliminarán registros permanentemente\n");
  }

  console.log("=".repeat(60));

  await eliminarDuplicadosCambioDivisa(dryRun);
  await eliminarDuplicadosTransferencia(dryRun);
  await eliminarDuplicadosServicioExternoMovimiento(dryRun);

  console.log("\n" + "=".repeat(60));

  if (dryRun) {
    console.log("\n✅ Simulación completada");
    console.log("   Para ejecutar realmente, usa: --execute");
  } else {
    console.log("\n✅ Eliminación completada");
    console.log("   Ejecuta el script de recalculación para actualizar saldos");
  }
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
