/**
 * Script para analizar datos de jornadas y cierres con posibles problemas de timezone
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyzeJornadas() {
  console.log("=== ANÁLISIS DE JORNADAS ===\n");

  // Obtener todas las jornadas ordenadas por fecha
  const jornadas = await prisma.jornada.findMany({
    orderBy: { fecha_inicio: "desc" },
    take: 20,
    include: {
      usuario: { select: { nombre: true, username: true } },
      puntoAtencion: { select: { nombre: true } },
    },
  });

  console.log(`Total de jornadas analizadas: ${jornadas.length}\n`);

  console.log("Últimas jornadas:");
  console.log("-".repeat(100));
  console.log(
    `${"ID".padEnd(36)} | ${"Usuario".padEnd(15)} | ${"Punto".padEnd(15)} | ${"Fecha Inicio UTC".padEnd(25)} | ${"Hora Local (GYE)".padEnd(20)} | Estado`
  );
  console.log("-".repeat(100));

  for (const j of jornadas) {
    const fechaInicio = j.fecha_inicio;
    const horaLocal = fechaInicio
      ? new Date(fechaInicio.getTime() - 5 * 60 * 60 * 1000)
      : null;

    console.log(
      `${j.id.substring(0, 36).padEnd(36)} | ${
        (j.usuario?.nombre || j.usuario?.username || "N/A").substring(0, 15).padEnd(15)
      } | ${(j.puntoAtencion?.nombre || "N/A").substring(0, 15).padEnd(15)} | ${
        fechaInicio?.toISOString().padEnd(25) || "N/A".padEnd(25)
      } | ${horaLocal?.toISOString().padEnd(20) || "N/A".padEnd(20)} | ${j.estado}`
    );
  }

  // Detectar problemas potenciales
  console.log("\n=== DETECCIÓN DE PROBLEMAS ===\n");

  const problemas: any[] = [];

  for (const j of jornadas) {
    if (!j.fecha_inicio) continue;

    const horaUTC = j.fecha_inicio.getUTCHours();
    const minutosUTC = j.fecha_inicio.getUTCMinutes();

    // Si la hora UTC está entre 00:00 y 05:00, probablemente sea un dato incorrecto
    // (porque en Ecuador serían las 19:00-00:00 del día anterior)
    if (horaUTC >= 0 && horaUTC < 5) {
      problemas.push({
        tipo: "POSIBLE_HORA_INCORRECTA",
        id: j.id,
        usuario: j.usuario?.nombre || j.usuario?.username,
        fecha_inicio_utc: j.fecha_inicio.toISOString(),
        hora_utc: `${horaUTC.toString().padStart(2, "0")}:${minutosUTC.toString().padStart(2, "0")}`,
        razon: "Hora UTC entre 00:00-05:00 sugiere que se aplicó doble timezone",
      });
    }
  }

  if (problemas.length > 0) {
    console.log(`Se detectaron ${problemas.length} posibles problemas:\n`);
    problemas.forEach((p, i) => {
      console.log(`${i + 1}. ${p.tipo}`);
      console.log(`   Usuario: ${p.usuario}`);
      console.log(`   Fecha UTC: ${p.fecha_inicio_utc}`);
      console.log(`   Hora UTC: ${p.hora_utc}`);
      console.log(`   Razón: ${p.razon}`);
      console.log();
    });
  } else {
    console.log("No se detectaron problemas obvios en las jornadas analizadas.");
  }

  return problemas;
}

async function analyzeCierres() {
  console.log("\n=== ANÁLISIS DE CIERRES ===\n");

  const cierres = await prisma.cuadreCaja.findMany({
    orderBy: { fecha_cierre: "desc" },
    take: 20,
    include: {
      puntoAtencion: { select: { nombre: true } },
      usuario: { select: { nombre: true, username: true } },
    },
  });

  console.log(`Total de cierres analizados: ${cierres.length}\n`);

  console.log("Últimos cierres:");
  console.log("-".repeat(110));
  console.log(
    `${"ID".padEnd(36)} | ${"Usuario".padEnd(15)} | ${"Punto".padEnd(15)} | ${"Fecha Cuadre".padEnd(25)} | ${"Fecha Cierre UTC".padEnd(25)} | Estado`
  );
  console.log("-".repeat(110));

  for (const c of cierres) {
    console.log(
      `${c.id.substring(0, 36).padEnd(36)} | ${
        (c.usuario?.nombre || c.usuario?.username || "N/A").substring(0, 15).padEnd(15)
      } | ${(c.puntoAtencion?.nombre || "N/A").substring(0, 15).padEnd(15)} | ${
        c.fecha?.toISOString().padEnd(25) || "N/A".padEnd(25)
      } | ${c.fecha_cierre?.toISOString().padEnd(25) || "N/A".padEnd(25)} | ${c.estado}`
    );
  }

  // Detectar problemas
  console.log("\n=== DETECCIÓN DE PROBLEMAS EN CIERRES ===\n");

  const problemas: any[] = [];

  for (const c of cierres) {
    if (!c.fecha_cierre) continue;

    const horaUTC = c.fecha_cierre.getUTCHours();

    // Cierres hechos entre 00:00-05:00 UTC sugieren problema de timezone
    if (horaUTC >= 0 && horaUTC < 5) {
      problemas.push({
        tipo: "POSIBLE_CIERRE_HORA_INCORRECTA",
        id: c.id,
        punto: c.puntoAtencion?.nombre,
        fecha_cierre_utc: c.fecha_cierre.toISOString(),
        hora_utc: horaUTC,
        razon: "Cierre registrado en hora UTC temprana (00:00-05:00)",
      });
    }

    // Verificar si la fecha del cuadre no coincide con la fecha de cierre
    if (c.fecha && c.fecha_cierre) {
      const fechaCuadre = new Date(c.fecha);
      const fechaCierre = new Date(c.fecha_cierre);

      // Si el cierre fue más de 12 horas después de la fecha del cuadre, puede haber problema
      const diffHoras = (fechaCierre.getTime() - fechaCuadre.getTime()) / (1000 * 60 * 60);

      if (diffHoras > 24) {
        problemas.push({
          tipo: "DIFERENCIA_FECHA_CIERRE_MUY_GRANDE",
          id: c.id,
          punto: c.puntoAtencion?.nombre,
          fecha_cuadre: fechaCuadre.toISOString(),
          fecha_cierre: fechaCierre.toISOString(),
          diferencia_horas: Math.round(diffHoras),
          razon: "El cierre se realizó muchas horas después de la fecha del cuadre",
        });
      }
    }
  }

  if (problemas.length > 0) {
    console.log(`Se detectaron ${problemas.length} posibles problemas:\n`);
    problemas.forEach((p, i) => {
      console.log(`${i + 1}. ${p.tipo}`);
      console.log(`   Punto: ${p.punto}`);
      console.log(`   Fecha cierre UTC: ${p.fecha_cierre_utc || p.fecha_cierre}`);
      if (p.diferencia_horas) {
        console.log(`   Diferencia: ${p.diferencia_horas} horas`);
      }
      console.log(`   Razón: ${p.razon}`);
      console.log();
    });
  } else {
    console.log("No se detectaron problemas obvios en los cierres analizados.");
  }

  return problemas;
}

async function main() {
  try {
    console.log("Iniciando análisis de timezone en datos...\n");

    await analyzeJornadas();
    await analyzeCierres();

    console.log("\n=== ANÁLISIS COMPLETADO ===");
  } catch (error) {
    console.error("Error en análisis:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
