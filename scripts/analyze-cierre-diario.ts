/**
 * Script para analizar la tabla CierreDiario
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyzeCierreDiario() {
  console.log("=== ANÁLISIS DE CIERRE DIARIO ===\n");

  const cierres = await prisma.cierreDiario.findMany({
    orderBy: { fecha: "desc" },
    take: 50,
    include: {
      puntoAtencion: { select: { nombre: true } },
      usuario: { select: { nombre: true, username: true } },
    },
  });

  console.log(`Total de cierres diarios: ${cierres.length}\n`);

  if (cierres.length === 0) {
    console.log("No hay registros en CierreDiario");
    return;
  }

  console.log("Últimos cierres:");
  console.log("-".repeat(110));
  console.log(
    `${"Fecha".padEnd(12)} | ${"Punto".padEnd(18)} | ${"Usuario".padEnd(15)} | ${"Fecha BD".padEnd(25)} | ${"Fecha Cierre".padEnd(25)} | Estado`
  );
  console.log("-".repeat(110));

  const problemas: any[] = [];

  for (const c of cierres) {
    const fechaStr = c.fecha ? c.fecha.toISOString().split("T")[0] : "N/A";
    const fechaBD = c.fecha?.toISOString() || "N/A";
    const fechaCierre = c.fecha_cierre?.toISOString() || "N/A";

    console.log(
      `${fechaStr.padEnd(12)} | ${
        (c.puntoAtencion?.nombre || "N/A").substring(0, 18).padEnd(18)
      } | ${(c.usuario?.nombre || c.usuario?.username || "N/A").substring(0, 15).padEnd(15)} | ${
        fechaBD.padEnd(25)
      } | ${fechaCierre.padEnd(25)} | ${c.estado}`
    );

    // Detectar problemas
    if (c.fecha_cierre) {
      const horaUTC = c.fecha_cierre.getUTCHours();

      // Cierres entre 00:00-05:00 UTC son sospechosos
      if (horaUTC >= 0 && horaUTC < 5) {
        problemas.push({
          tipo: "CIERRE_HORA_MUY_TEMPRANA",
          id: c.id,
          punto: c.puntoAtencion?.nombre,
          fecha: fechaStr,
          fecha_cierre_utc: c.fecha_cierre.toISOString(),
          hora_utc: horaUTC,
          explicacion: `Cierre registrado a las ${horaUTC}:00 UTC`,
        });
      }
    }
  }

  console.log(`\n\nTotal de posibles problemas: ${problemas.length}`);

  if (problemas.length > 0) {
    console.log("\nProblemas detectados:");
    problemas.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.tipo}`);
      console.log(`   Punto: ${p.punto}`);
      console.log(`   Fecha: ${p.fecha}`);
      console.log(`   Fecha cierre UTC: ${p.fecha_cierre_utc}`);
      console.log(`   Explicación: ${p.explicacion}`);
    });
  }

  // Análisis de distribución por hora
  console.log("\n\n=== DISTRIBUCIÓN POR HORA UTC ===\n");
  const horasDistribucion: { [hora: string]: number } = {};

  for (const c of cierres) {
    if (!c.fecha_cierre) continue;
    const horaUTC = c.fecha_cierre.getUTCHours();
    const horaKey = `${horaUTC.toString().padStart(2, "0")}:00`;
    horasDistribucion[horaKey] = (horasDistribucion[horaKey] || 0) + 1;
  }

  const horasOrdenadas = Object.entries(horasDistribucion).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [hora, count] of horasOrdenadas) {
    const barra = "█".repeat(Math.min(count, 50));
    console.log(`  ${hora}: ${count.toString().padStart(2)} ${barra}`);
  }
}

async function main() {
  try {
    await analyzeCierreDiario();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
