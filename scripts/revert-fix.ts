// Script para revertir la corrección anterior
import prisma from "../server/lib/prisma.js";

const OFFSET_MS = 5 * 60 * 60 * 1000;

async function revert() {
  console.log("=== REVIRTIENDO CORRECCIÓN ===\n");

  // Buscar jornadas corregidas (ahora entre 05:00-10:00 UTC)
  const jornadasAll = await prisma.jornada.findMany({
    where: { fecha_salida: { not: null } },
  });

  const revertedJornadas = jornadasAll.filter(j => {
    if (!j.fecha_salida) return false;
    const hour = j.fecha_salida.getUTCHours();
    return hour >= 5 && hour < 10;
  });

  console.log(`Jornadas a revertir: ${revertedJornadas.length}`);

  for (const j of revertedJornadas) {
    if (j.fecha_salida) {
      const original = new Date(j.fecha_salida.getTime() - OFFSET_MS);
      await prisma.jornada.update({
        where: { id: j.id },
        data: { fecha_salida: original },
      });
      const h = original.getUTCHours().toString().padStart(2, "0");
      const m = original.getUTCMinutes().toString().padStart(2, "0");
      console.log(`  Revertido: ${j.id.slice(0, 8)} -> UTC ${h}:${m}`);
    }
  }

  // Buscar cierres corregidos
  const cierresAll = await prisma.cierreDiario.findMany({
    where: { fecha_cierre: { not: null } },
  });

  const revertedCierres = cierresAll.filter(c => {
    if (!c.fecha_cierre) return false;
    const hour = c.fecha_cierre.getUTCHours();
    return hour >= 5 && hour < 10;
  });

  console.log(`\nCierres a revertir: ${revertedCierres.length}`);

  for (const c of revertedCierres) {
    if (c.fecha_cierre) {
      const original = new Date(c.fecha_cierre.getTime() - OFFSET_MS);
      await prisma.cierreDiario.update({
        where: { id: c.id },
        data: { fecha_cierre: original },
      });
      const h = original.getUTCHours().toString().padStart(2, "0");
      const m = original.getUTCMinutes().toString().padStart(2, "0");
      console.log(`  Revertido: ${c.id.slice(0, 8)} -> UTC ${h}:${m}`);
    }
  }

  console.log("\n✅ Reversión completada");
  await prisma.$disconnect();
}

revert();
