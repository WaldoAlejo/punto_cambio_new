// Script para corregir datos históricos con problemas de timezone
// Este script detecta y corrige registros donde las fechas fueron guardadas con desfase

import prisma from "../server/lib/prisma.js";
import { isServerInEcuador } from "../server/utils/timezone.js";

const OFFSET_MS = 5 * 60 * 60 * 1000; // 5 horas en ms

async function analyzeAndFixData() {
  console.log("=== ANÁLISIS Y CORRECCIÓN DE DATOS HISTÓRICOS ===\n");
  console.log(`Servidor en Ecuador: ${isServerInEcuador()}`);

  // 1. Analizar jornadas con fecha_salida sospechosa (madrugada UTC)
  console.log("\n--- ANÁLISIS DE JORNADAS ---");
  
  const jornadasAll = await prisma.jornada.findMany({
    where: { fecha_salida: { not: null } },
    include: { usuario: { select: { nombre: true, username: true } } },
    orderBy: { fecha_salida: "desc" },
  });

  console.log(`Total jornadas con fecha_salida: ${jornadasAll.length}`);

  // Jornadas con hora entre 00:00-05:00 UTC (probablemente incorrectas)
  const suspiciousJornadas = jornadasAll.filter(j => {
    if (!j.fecha_salida) return false;
    const hour = j.fecha_salida.getUTCHours();
    return hour >= 0 && hour < 5;
  });

  console.log(`Jornadas con fecha_salida entre 00:00-05:00 UTC: ${suspiciousJornadas.length}`);

  // Mostrar ejemplos
  console.log("\nEjemplos de jornadas sospechosas:");
  suspiciousJornadas.slice(0, 5).forEach(j => {
    if (j.fecha_salida) {
      const utcHour = j.fecha_salida.getUTCHours().toString().padStart(2, '0');
      const utcMin = j.fecha_salida.getUTCMinutes().toString().padStart(2, '0');
      const ecHour = ((j.fecha_salida.getUTCHours() - 5 + 24) % 24).toString().padStart(2, '0');
      const ecMin = utcMin;
      console.log(`  ID: ${j.id}, UTC: ${utcHour}:${utcMin} -> Ecuador: ${ecHour}:${ecMin} (${j.usuario?.nombre || 'N/A'})`);
    }
  });

  // 2. Analizar cierres con fecha_cierre sospechosa
  console.log("\n--- ANÁLISIS DE CIERRES ---");
  
  const cierresAll = await prisma.cierreDiario.findMany({
    where: { fecha_cierre: { not: null } },
    orderBy: { fecha_cierre: "desc" },
  });

  console.log(`Total cierres con fecha_cierre: ${cierresAll.length}`);

  // Cierres con hora entre 00:00-05:00 UTC
  const suspiciousCierres = cierresAll.filter(c => {
    if (!c.fecha_cierre) return false;
    const hour = c.fecha_cierre.getUTCHours();
    return hour >= 0 && hour < 5;
  });

  console.log(`Cierres con fecha_cierre entre 00:00-05:00 UTC: ${suspiciousCierres.length}`);

  // Mostrar ejemplos
  console.log("\nEjemplos de cierres sospechosos:");
  suspiciousCierres.slice(0, 5).forEach(c => {
    if (c.fecha_cierre) {
      const utcHour = c.fecha_cierre.getUTCHours().toString().padStart(2, '0');
      const utcMin = c.fecha_cierre.getUTCMinutes().toString().padStart(2, '0');
      const ecHour = ((c.fecha_cierre.getUTCHours() - 5 + 24) % 24).toString().padStart(2, '0');
      console.log(`  ID: ${c.id}, Fecha: ${c.fecha}, UTC: ${utcHour}:${utcMin} -> Ecuador: ${ecHour}:${utcMin}`);
    }
  });

  // 3. Verificar si es necesario corregir
  console.log("\n--- RESUMEN ---");
  
  const needsFix = suspiciousJornadas.length > 0 || suspiciousCierres.length > 0;
  
  if (!needsFix) {
    console.log("✅ No se detectaron registros que necesiten corrección.");
    return;
  }

  console.log(`⚠️  Se detectaron ${suspiciousJornadas.length} jornadas y ${suspiciousCierres.length} cierres potencialmente incorrectos.`);
  console.log("\nPara corregir estos datos, ejecute el script con el argumento --fix");
  console.log("Ejemplo: npx tsx scripts/fix-historical-timezone-data.ts --fix");

  // Si se pasa --fix, aplicar correcciones
  if (process.argv.includes("--fix")) {
    console.log("\n--- APLICANDO CORRECCIONES ---");
    
    // Corregir jornadas: sumar 5 horas a las fechas sospechosas
    let fixedJornadas = 0;
    for (const j of suspiciousJornadas) {
      if (j.fecha_salida) {
        const newFechaSalida = new Date(j.fecha_salida.getTime() + OFFSET_MS);
        await prisma.jornada.update({
          where: { id: j.id },
          data: { fecha_salida: newFechaSalida },
        });
        fixedJornadas++;
      }
    }
    console.log(`✅ Jornadas corregidas: ${fixedJornadas}`);

    // Corregir cierres: sumar 5 horas a las fechas sospechosas
    let fixedCierres = 0;
    for (const c of suspiciousCierres) {
      if (c.fecha_cierre) {
        const newFechaCierre = new Date(c.fecha_cierre.getTime() + OFFSET_MS);
        await prisma.cierreDiario.update({
          where: { id: c.id },
          data: { fecha_cierre: newFechaCierre },
        });
        fixedCierres++;
      }
    }
    console.log(`✅ Cierres corregidos: ${fixedCierres}`);

    console.log("\n✅ Correcciones completadas exitosamente!");
  }
}

analyzeAndFixData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
