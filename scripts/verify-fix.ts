import prisma from "../server/lib/prisma.js";

async function verify() {
  console.log("=== VERIFICACIÓN DE CORRECCIÓN ===\n");

  // Verificar jornadas recientes
  const jornadas = await prisma.jornada.findMany({
    where: { fecha_salida: { not: null } },
    orderBy: { fecha_salida: "desc" },
    take: 5,
    include: { usuario: { select: { nombre: true } } }
  });

  console.log("JORNADAS RECIENTES:");
  for (const j of jornadas) {
    const f = j.fecha_salida!;
    const utcHour = f.getUTCHours().toString().padStart(2, "0");
    const utcMin = f.getUTCMinutes().toString().padStart(2, "0");
    const ecHour = ((f.getUTCHours() - 5 + 24) % 24).toString().padStart(2, "0");
    console.log(`  ${j.usuario?.nombre || "N/A"}: UTC ${utcHour}:${utcMin} -> Ecuador ${ecHour}:${utcMin}`);
  }

  // Verificar cierres recientes
  const cierres = await prisma.cierreDiario.findMany({
    where: { fecha_cierre: { not: null } },
    orderBy: { fecha_cierre: "desc" },
    take: 5,
  });

  console.log("\nCIERRES RECIENTES:");
  for (const c of cierres) {
    const f = c.fecha_cierre!;
    const utcHour = f.getUTCHours().toString().padStart(2, "0");
    const utcMin = f.getUTCMinutes().toString().padStart(2, "0");
    const ecHour = ((f.getUTCHours() - 5 + 24) % 24).toString().padStart(2, "0");
    console.log(`  ID ${c.id.slice(0, 8)}: UTC ${utcHour}:${utcMin} -> Ecuador ${ecHour}:${utcMin}`);
  }

  await prisma.$disconnect();
}

verify();
