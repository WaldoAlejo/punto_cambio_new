/**
 * Script completo para analizar todos los datos de jornadas y cierres
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyzeAllJornadas() {
  console.log("=== ANÁLISIS COMPLETO DE JORNADAS ===\n");

  const jornadas = await prisma.jornada.findMany({
    orderBy: { fecha_inicio: "desc" },
    include: {
      usuario: { select: { nombre: true, username: true } },
      puntoAtencion: { select: { nombre: true } },
    },
  });

  console.log(`Total de jornadas en BD: ${jornadas.length}\n`);

  const problemas: any[] = [];
  const horasDistribucion: { [hora: string]: number } = {};

  for (const j of jornadas) {
    if (!j.fecha_inicio) continue;

    const horaUTC = j.fecha_inicio.getUTCHours();
    const horaKey = `${horaUTC.toString().padStart(2, "0")}:00`;
    horasDistribucion[horaKey] = (horasDistribucion[horaKey] || 0) + 1;

    // Detectar problemas
    // Si la hora UTC está entre 00:00 y 04:00, podría ser un problema
    // (jornadas iniciadas entre 19:00-23:00 Ecuador del día anterior)
    if (horaUTC >= 0 && horaUTC < 5) {
      problemas.push({
        tipo: "HORA_TARDIA",
        id: j.id,
        usuario: j.usuario?.nombre || j.usuario?.username,
        punto: j.puntoAtencion?.nombre,
        fecha_inicio_utc: j.fecha_inicio.toISOString(),
        hora_utc: horaUTC,
        explicacion: `Jornada iniciada a las ${horaUTC}:00 UTC (${horaUTC - 5 + 24}:00 hora Ecuador del día anterior)`,
      });
    }
  }

  console.log("Distribución de jornadas por hora UTC:");
  const horasOrdenadas = Object.entries(horasDistribucion).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [hora, count] of horasOrdenadas) {
    const barra = "█".repeat(Math.min(count, 50));
    console.log(`  ${hora}: ${count.toString().padStart(3)} ${barra}`);
  }

  console.log(`\nTotal de posibles problemas: ${problemas.length}`);

  if (problemas.length > 0) {
    console.log("\nPrimeros 10 problemas detectados:");
    problemas.slice(0, 10).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.tipo}`);
      console.log(`   Usuario: ${p.usuario}`);
      console.log(`   Punto: ${p.punto}`);
      console.log(`   Fecha UTC: ${p.fecha_inicio_utc}`);
      console.log(`   Explicación: ${p.explicacion}`);
    });
  }

  return { total: jornadas.length, problemas, horasDistribucion };
}

async function analyzeAllCierres() {
  console.log("\n\n=== ANÁLISIS COMPLETO DE CIERRES ===\n");

  const cierres = await prisma.cuadreCaja.findMany({
    where: { estado: "CERRADO" },
    orderBy: { fecha_cierre: "desc" },
    include: {
      puntoAtencion: { select: { nombre: true } },
      usuario: { select: { nombre: true, username: true } },
    },
  });

  console.log(`Total de cierres CERRADOS en BD: ${cierres.length}\n`);

  const problemas: any[] = [];
  const horasDistribucion: { [hora: string]: number } = {};

  for (const c of cierres) {
    if (!c.fecha_cierre) continue;

    const horaUTC = c.fecha_cierre.getUTCHours();
    const horaKey = `${horaUTC.toString().padStart(2, "0")}:00`;
    horasDistribucion[horaKey] = (horasDistribucion[horaKey] || 0) + 1;

    // Cierres entre 00:00-05:00 UTC son sospechosos
    if (horaUTC >= 0 && horaUTC < 5) {
      problemas.push({
        tipo: "CIERRE_HORA_MUY_TEMPRANA",
        id: c.id,
        punto: c.puntoAtencion?.nombre,
        fecha_cierre_utc: c.fecha_cierre.toISOString(),
        hora_utc: horaUTC,
        fecha_cuadre: c.fecha?.toISOString(),
        explicacion: `Cierre registrado a las ${horaUTC}:00 UTC (muy temprano, posible error de timezone)`,
      });
    }

    // Cierres con diferencia grande entre fecha del cuadre y fecha de cierre
    if (c.fecha && c.fecha_cierre) {
      const diffMs = c.fecha_cierre.getTime() - c.fecha.getTime();
      const diffHoras = diffMs / (1000 * 60 * 60);

      if (diffHoras > 48) {
        problemas.push({
          tipo: "CIERRE_MUY_TARDIO",
          id: c.id,
          punto: c.puntoAtencion?.nombre,
          fecha_cuadre: c.fecha.toISOString(),
          fecha_cierre: c.fecha_cierre.toISOString(),
          diferencia_horas: Math.round(diffHoras),
          explicacion: `Cierre realizado ${Math.round(diffHoras)} horas después del inicio del día`,
        });
      }
    }
  }

  console.log("Distribución de cierres por hora UTC:");
  const horasOrdenadas = Object.entries(horasDistribucion).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [hora, count] of horasOrdenadas) {
    const barra = "█".repeat(Math.min(count, 50));
    console.log(`  ${hora}: ${count.toString().padStart(3)} ${barra}`);
  }

  console.log(`\nTotal de posibles problemas: ${problemas.length}`);

  if (problemas.length > 0) {
    console.log("\nPrimeros 10 problemas detectados:");
    problemas.slice(0, 10).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.tipo}`);
      console.log(`   Punto: ${p.punto}`);
      console.log(`   Fecha cierre UTC: ${p.fecha_cierre_utc || p.fecha_cierre}`);
      if (p.diferencia_horas) {
        console.log(`   Diferencia: ${p.diferencia_horas} horas`);
      }
      console.log(`   Explicación: ${p.explicacion}`);
    });
  }

  return { total: cierres.length, problemas, horasDistribucion };
}

async function main() {
  try {
    console.log("Iniciando análisis completo de timezone...\n");
    console.log("=".repeat(80));

    await analyzeAllJornadas();
    await analyzeAllCierres();

    console.log("\n" + "=".repeat(80));
    console.log("ANÁLISIS COMPLETADO");
  } catch (error) {
    console.error("Error en análisis:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
