/**
 * Script de diagnóstico para detectar movimientos duplicados en MovimientoSaldo
 */

import prisma from "../lib/prisma.js";

async function main() {
  console.log("🔍 Diagnosticando movimientos duplicados...\n");

  // Buscar movimientos con la misma referencia_id y tipo_movimiento
  const movimientos = await prisma.movimientoSaldo.findMany({
    orderBy: [
      { referencia_id: "asc" },
      { tipo_movimiento: "asc" },
      { created_at: "asc" },
    ],
  });

  console.log(`📊 Total de movimientos: ${movimientos.length}\n`);

  // Agrupar por referencia_id + tipo_movimiento + punto_atencion_id
  const grupos = new Map<string, typeof movimientos>();

  for (const mov of movimientos) {
    if (!mov.referencia_id) continue;

    const key = `${mov.referencia_id}|${mov.tipo_movimiento}|${mov.punto_atencion_id}|${mov.moneda_id}`;
    const grupo = grupos.get(key) || [];
    grupo.push(mov);
    grupos.set(key, grupo);
  }

  // Buscar duplicados
  let duplicadosEncontrados = 0;

  for (const [key, grupo] of grupos.entries()) {
    if (grupo.length > 1) {
      duplicadosEncontrados++;
      const [refId, tipoMov, puntoId, monedaId] = key.split("|");

      console.log(`⚠️  DUPLICADO #${duplicadosEncontrados}:`);
      console.log(`    Referencia: ${refId}`);
      console.log(`    Tipo: ${tipoMov}`);
      console.log(`    Cantidad de registros: ${grupo.length}`);
      console.log(`    Movimientos:`);

      for (const mov of grupo) {
        console.log(
          `      - ID: ${mov.id} | Monto: ${mov.monto} | Saldo nuevo: ${mov.saldo_nuevo} | Fecha: ${mov.created_at}`
        );
      }

      console.log("");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 RESUMEN");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total de movimientos: ${movimientos.length}`);
  console.log(`Grupos con duplicados: ${duplicadosEncontrados}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
