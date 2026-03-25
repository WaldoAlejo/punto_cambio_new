/**
 * Script para verificar movimientos duplicados antes de crear índice único
 * Ejecutar: npx tsx scripts/check-duplicate-movimientos.ts
 */
import prisma from "../server/lib/prisma.js";

async function checkDuplicates() {
  console.log("🔍 Verificando movimientos duplicados...\n");

  const duplicates = await prisma.$queryRaw`
    SELECT 
      referencia_id,
      tipo_referencia,
      moneda_id,
      tipo_movimiento,
      COUNT(*) as count,
      STRING_AGG(id::text, ', ') as ids
    FROM "MovimientoSaldo"
    WHERE referencia_id IS NOT NULL 
      AND tipo_referencia IS NOT NULL
    GROUP BY referencia_id, tipo_referencia, moneda_id, tipo_movimiento
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  if (Array.isArray(duplicates) && duplicates.length > 0) {
    console.log(`⚠️  Se encontraron ${duplicates.length} grupos duplicados:\n`);
    for (const dup of duplicates) {
      console.log(`  Grupo: ${dup.tipo_referencia} - ${dup.tipo_movimiento}`);
      console.log(`  Referencia: ${dup.referencia_id}`);
      console.log(`  Moneda: ${dup.moneda_id}`);
      console.log(`  Cantidad: ${dup.count} movimientos`);
      console.log(`  IDs: ${dup.ids}`);
      console.log("");
    }
    console.log("❌ Debe eliminar los duplicados antes de crear el índice único.");
    process.exit(1);
  } else {
    console.log("✅ No se encontraron movimientos duplicados.");
    console.log("✅ Es seguro crear el índice único.");
  }

  await prisma.$disconnect();
}

checkDuplicates().catch((e) => {
  console.error(e);
  process.exit(1);
});
