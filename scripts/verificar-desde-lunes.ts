/**
 * Verificar marcaciones desde el lunes 2 de marzo de 2026
 * para confirmar que las fechas de salida están correctas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Lunes 2 de marzo de 2026 en UTC
const LUNES_2_MARZO = new Date("2026-03-02T00:00:00.000Z");

async function verificarMarcacionesDesdeLunes() {
  console.log("🔍 Verificando marcaciones desde el lunes 2 de marzo de 2026...\n");
  console.log(`   Fecha de corte: ${LUNES_2_MARZO.toISOString()}\n`);

  const jornadas = await prisma.jornada.findMany({
    where: {
      fecha_inicio: {
        gte: LUNES_2_MARZO,
      },
      estado: "COMPLETADO",
      fecha_salida: { not: null },
    },
    include: {
      usuario: {
        select: {
          id: true,
          nombre: true,
          username: true,
        },
      },
    },
    orderBy: {
      fecha_inicio: "desc",
    },
  });

  console.log(`📊 Total jornadas completadas desde el lunes: ${jornadas.length}\n`);

  if (jornadas.length === 0) {
    console.log("✅ No hay jornadas completadas desde el lunes 2 de marzo");
    return [];
  }

  // Analizar cada jornada
  const analisis = jornadas.map(j => {
    if (!j.fecha_salida) return null;

    const fechaEntrada = j.fecha_inicio;
    const fechaSalida = j.fecha_salida;
    
    const diffMs = fechaSalida.getTime() - fechaEntrada.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);
    
    const horaSalidaUTC = fechaSalida.getUTCHours();
    const minutosSalidaUTC = fechaSalida.getUTCMinutes();
    
    // Hora Ecuador si la fecha está guardada correctamente (UTC-5)
    const horaEcuadorCorrecta = (horaSalidaUTC - 5 + 24) % 24;
    
    // Hora Ecuador si la fecha está guardada incorrectamente (sin offset)
    const horaEcuadorIncorrecta = horaSalidaUTC;

    // CRITERIOS DE REVISIÓN:
    // 1. Jornada muy corta (< 3 horas) - probablemente mal
    // 2. Salida entre 00:00 y 12:00 UTC (muy temprano)
    // 3. Duración negativa o imposible
    
    const esSospechosaPorDuracion = diffHoras < 3 || diffHoras > 12;
    const esSospechosaPorHora = horaSalidaUTC >= 0 && horaSalidaUTC <= 12;
    const esSospechosa = esSospechosaPorDuracion || esSospechosaPorHora;

    return {
      id: j.id,
      usuario: j.usuario?.nombre || j.usuario?.username || "N/A",
      fecha: fechaEntrada.toISOString().split("T")[0],
      fechaEntrada: fechaEntrada.toISOString(),
      fechaSalida: fechaSalida.toISOString(),
      horaSalidaUTC: `${horaSalidaUTC.toString().padStart(2, "0")}:${minutosSalidaUTC.toString().padStart(2, "0")}`,
      horaEcuadorCalculada: `${horaEcuadorCorrecta.toString().padStart(2, "0")}:${minutosSalidaUTC.toString().padStart(2, "0")}`,
      duracionHoras: Math.round(diffHoras * 100) / 100,
      esSospechosa,
      esSospechosaPorDuracion,
      esSospechosaPorHora,
    };
  }).filter(Boolean);

  // Mostrar todas las marcaciones
  console.log("📋 Listado de marcaciones desde el lunes 2 de marzo:\n");
  console.log("─".repeat(100));
  console.log(
    `${"#".padStart(3)} | ${"Fecha".padStart(10)} | ${"Operador".padEnd(30)} | ${"Entrada UTC".padStart(12)} | ${"Salida UTC".padStart(12)} | ${"Hora EC".padStart(8)} | ${"Duración".padStart(10)} | Estado`
  );
  console.log("─".repeat(100));

  analisis.forEach((j, i) => {
    const estado = j!.esSospechosa ? "⚠️ REVISAR" : "✅ OK";
    const horaEntrada = `${new Date(j!.fechaEntrada).getUTCHours().toString().padStart(2, "0")}:${new Date(j!.fechaEntrada).getUTCMinutes().toString().padStart(2, "0")}`;
    
    console.log(
      `${(i + 1).toString().padStart(3)} | ${j!.fecha} | ${j!.usuario.substring(0, 30).padEnd(30)} | ${horaEntrada.padStart(12)} | ${j!.horaSalidaUTC.padStart(12)} | ${j!.horaEcuadorCalculada.padStart(8)} | ${(j!.duracionHoras + "h").padStart(10)} | ${estado}`
    );
  });

  console.log("─".repeat(100));

  // Resumen
  const sospechosas = analisis.filter(j => j!.esSospechosa);
  
  console.log("\n📊 RESUMEN:");
  console.log(`   Total marcaciones: ${analisis.length}`);
  console.log(`   ✅ Correctas: ${analisis.length - sospechosas.length}`);
  console.log(`   ⚠️  Sospechosas: ${sospechosas.length}`);

  if (sospechosas.length > 0) {
    console.log("\n❌ Las siguientes marcaciones tienen problemas:\n");
    sospechosas.forEach(j => {
      console.log(`   ⚠️  ${j!.usuario}`);
      console.log(`      Fecha: ${j!.fecha}`);
      console.log(`      Entrada: ${j!.fechaEntrada}`);
      console.log(`      Salida:  ${j!.fechaSalida} (${j!.horaSalidaUTC} UTC)`);
      console.log(`      Hora Ecuador calculada: ${j!.horaEcuadorCalculada}`);
      console.log(`      Duración: ${j!.duracionHoras} horas`);
      if (j!.esSospechosaPorDuracion) {
        console.log(`      ❌ Duración inusual: ${j!.duracionHoras} horas`);
      }
      if (j!.esSospechosaPorHora) {
        console.log(`      ❌ Hora de salida muy temprana (UTC: ${j!.horaSalidaUTC})`);
      }
      console.log();
    });
  } else {
    console.log("\n✅ TODAS las marcaciones desde el lunes 2 de marzo están CORRECTAS");
    console.log("   Las horas de salida reflejan correctamente la zona horaria de Ecuador");
  }

  return sospechosas;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VERIFICACIÓN DE MARCACIONES DESDE LUNES 2 DE MARZO");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const sospechosas = await verificarMarcacionesDesdeLunes();
    
    if (sospechosas.length === 0) {
      console.log("\n🎉 ¡Todo está correcto desde el lunes!");
    } else {
      console.log(`\n⚠️  Se encontraron ${sospechosas.length} marcaciones con posibles problemas`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
