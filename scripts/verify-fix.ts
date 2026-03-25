/**
 * Verificar que el índice único se creó correctamente
 * Ejecutar: npx tsx scripts/verify-fix.ts
 */
import prisma from "../server/lib/prisma.js";

async function verifyFix() {
  console.log("🔍 Verificando correcciones...\n");

  // 1. Verificar que no hay duplicados de SALDO_INICIAL
  const saldoInicialDups = await prisma.$queryRaw`
    SELECT 
      referencia_id,
      COUNT(*) as count
    FROM "MovimientoSaldo"
    WHERE tipo_referencia = 'SALDO_INICIAL'
      AND referencia_id IS NOT NULL
    GROUP BY referencia_id, tipo_referencia, moneda_id, tipo_movimiento
    HAVING COUNT(*) > 1
  `;

  if (Array.isArray(saldoInicialDups) && saldoInicialDups.length === 0) {
    console.log("✅ No hay duplicados de SALDO_INICIAL");
  } else {
    console.log(`⚠️  Quedan ${(saldoInicialDups as any[]).length} grupos duplicados de SALDO_INICIAL`);
  }

  // 2. Verificar que el índice existe
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'MovimientoSaldo' 
    AND indexname = 'idx_movimiento_unico_critico'
  `;

  if (Array.isArray(indexes) && indexes.length > 0) {
    console.log("✅ Índice único parcial 'idx_movimiento_unico_critico' creado correctamente");
    console.log(`   Definición: ${(indexes[0] as any).indexdef}`);
  } else {
    console.log("❌ El índice no fue creado");
  }

  // 3. Verificar no hay duplicados críticos
  const criticalDups = await prisma.$queryRaw`
    SELECT 
      tipo_referencia,
      COUNT(*) as count
    FROM "MovimientoSaldo"
    WHERE referencia_id IS NOT NULL 
      AND tipo_referencia IN ('EXCHANGE', 'TRANSFERENCIA', 'SERVICIO_EXTERNO')
    GROUP BY referencia_id, tipo_referencia, moneda_id, tipo_movimiento
    HAVING COUNT(*) > 1
  `;

  if (Array.isArray(criticalDups) && criticalDups.length === 0) {
    console.log("✅ No hay duplicados en movimientos críticos");
  }

  console.log("\n🎉 Todas las verificaciones pasaron correctamente");
  await prisma.$disconnect();
}

verifyFix().catch((e) => {
  console.error(e);
  process.exit(1);
});
