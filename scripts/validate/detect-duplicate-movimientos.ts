import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const puntosProblem = [
  "PLAZA DEL VALLE",
  "AMAZONAS",
  "EL BOSQUE",
  "SCALA",
  "OFICINA ROYAL PACIFIC",
];

async function main() {
  console.log("\n=== DETECCIÓN DE MOVIMIENTOS DUPLICADOS ===\n");

  for (const nombrePunto of puntosProblem) {
    const punto = await prisma.puntoAtencion.findFirst({
      where: { nombre: nombrePunto, activo: true },
      select: { id: true, nombre: true },
    });

    if (!punto) {
      console.log(`❌ Punto no encontrado: ${nombrePunto}`);
      continue;
    }

    console.log(`\n📍 ${punto.nombre}:`);

    // Obtener todos los movimientos
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: { punto_atencion_id: punto.id },
      orderBy: { fecha: "asc" },
    });

    console.log(`   Total movimientos: ${movimientos.length}`);

    // Detectar duplicados por (punto_id, moneda_id, tipo_movimiento, monto, fecha, referencia_id)
    const duplicates = new Map<string, any[]>();

    for (const mov of movimientos) {
      // Agrupar por: moneda + tipo + monto + fecha + referencia
      const key = `${mov.moneda_id}|${mov.tipo_movimiento}|${mov.monto}|${mov.fecha.toISOString()}|${mov.referencia_id || ""}`;
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key)!.push(mov);
    }

    let duplicadosCount = 0;
    for (const [key, moves] of duplicates) {
      if (moves.length > 1) {
        duplicadosCount++;
        const [first] = moves;
        console.log(
          `   ⚠️ Duplicados encontrados (${moves.length}x):`
        );
        console.log(
          `      Moneda: ${first.moneda_id} | Tipo: ${first.tipo_movimiento}`
        );
        console.log(
          `      Monto: ${first.monto} | Fecha: ${first.fecha.toISOString()}`
        );
        console.log(`      Referencia: ${first.referencia_id || "N/A"}`);
        console.log(`      IDs: ${moves.map((m) => m.id).join(", ")}`);
      }
    }

    if (duplicadosCount === 0) {
      console.log("   ✅ Sin duplicados exactos");
    } else {
      console.log(`   ❌ ${duplicadosCount} grupos de duplicados`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
