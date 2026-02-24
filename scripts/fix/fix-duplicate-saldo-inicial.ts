import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    "\n=== CORRECCIÓN: ELIMINAR MOVIMIENTOS SALDO_INICIAL DUPLICADOS ===\n"
  );

  // Obtener todos los puntos con problemas
  const allMovs = await prisma.movimientoSaldo.findMany({
    where: { tipo_movimiento: "SALDO_INICIAL" },
    include: {
      puntoAtencion: true,
      moneda: true,
    },
    orderBy: [{ punto_atencion_id: "asc" }, { moneda_id: "asc" }, { fecha: "asc" }],
  });

  // Agrupar por punto-moneda
  const grouped = new Map<string, any[]>();
  for (const mov of allMovs) {
    const key = `${mov.punto_atencion_id}|${mov.moneda_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(mov);
  }

  // Encontrar duplicados
  const toDelete: string[] = [];
  let totalAEliminar = 0;

  for (const [key, movs] of grouped) {
    if (movs.length > 1) {
      const [first, ...rest] = movs;
      console.log(
        `\n⚠️ ${movs[0].puntoAtencion.nombre} | ${movs[0].moneda.codigo}: ${movs.length} SALDO_INICIAL`
      );
      console.log(
        `   Mantener: ID ${first.id} (${first.fecha.toISOString().split("T")[0]}) = ${first.monto}`
      );

      // Marcar los otros para eliminar
      for (const mov of rest) {
        console.log(
          `   ❌ Eliminar: ID ${mov.id} (${mov.fecha.toISOString().split("T")[0]}) = ${mov.monto}`
        );
        toDelete.push(mov.id);
        totalAEliminar += Number(mov.monto);
      }
    }
  }

  if (toDelete.length === 0) {
    console.log("\n✅ No hay duplicados para eliminar");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`\nResumen:`);
  console.log(`  Movimientos a eliminar: ${toDelete.length}`);
  console.log(`  Monto total: ${totalAEliminar.toFixed(2)}`);

  // Confirmar
  if (process.argv.includes("--execute")) {
    console.log(`\n🔄 Eliminando registros...`);

    // Eliminar
    for (const id of toDelete) {
      await prisma.movimientoSaldo.delete({ where: { id } });
    }

    console.log(`\n✅ ${toDelete.length} registros eliminados`);
    console.log(`\n⚠️ NOTA: Los saldos de BD pueden estar incorrectos ahora.`);
    console.log(`   Ejecuta: npx ts-node scripts/fix/recalculate-all-saldos.ts`);
  } else {
    console.log(`\n📋 Para ejecutar la corrección, usa:`);
    console.log(
      `   npx ts-node scripts/fix/fix-duplicate-saldo-inicial.ts --execute`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
