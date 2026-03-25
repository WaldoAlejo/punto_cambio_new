/**
 * Verificar duplicados en movimientos críticos (EXCHANGE, TRANSFERENCIA)
 * Ejecutar: npx tsx scripts/check-critical-duplicates.ts
 */
import prisma from "../server/lib/prisma.js";

async function checkCriticalDuplicates() {
  console.log("🔍 Verificando duplicados en movimientos críticos...\n");

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
      AND tipo_referencia IN ('EXCHANGE', 'TRANSFERENCIA', 'SERVICIO_EXTERNO')
    GROUP BY referencia_id, tipo_referencia, moneda_id, tipo_movimiento
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  if (Array.isArray(duplicates) && duplicates.length > 0) {
    console.log(`⚠️  Se encontraron ${duplicates.length} grupos duplicados CRÍTICOS:\n`);
    for (const dup of duplicates) {
      console.log(`  Grupo: ${dup.tipo_referencia} - ${dup.tipo_movimiento}`);
      console.log(`  Referencia: ${dup.referencia_id}`);
      console.log(`  Moneda: ${dup.moneda_id}`);
      console.log(`  Cantidad: ${dup.count} movimientos`);
      console.log(`  IDs: ${dup.ids}`);
      console.log("");
    }
    console.log("❌ Debe eliminar estos duplicados manualmente antes de crear el índice.");
    process.exit(1);
  } else {
    console.log("✅ No se encontraron duplicados en movimientos críticos.");
    console.log("✅ Es seguro crear el índice único parcial.");
  }

  await prisma.$disconnect();
}

checkCriticalDuplicates().catch((e) => {
  console.error(e);
  process.exit(1);
});
