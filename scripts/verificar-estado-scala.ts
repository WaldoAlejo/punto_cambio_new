/**
 * Script para verificar el estado de apertura en SCALA
 */

import prisma from "../server/lib/prisma.js";
import { pool } from "../server/lib/database.js";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VERIFICACIÓN ESTADO SCALA");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Buscar punto SCALA
  const punto = await prisma.puntoAtencion.findFirst({
    where: { 
      nombre: { contains: "SCALA", mode: "insensitive" }
    }
  });
  
  if (!punto) {
    console.log("❌ No se encontró punto SCALA");
    return;
  }
  console.log(`✓ Punto encontrado: ${punto.nombre} (ID: ${punto.id})`);

  // 2. Buscar jornadas activas en SCALA
  const jornadas = await prisma.jornada.findMany({
    where: {
      punto_atencion_id: punto.id,
      estado: { in: ["ACTIVO", "ALMUERZO"] }
    },
    include: {
      usuario: { select: { id: true, nombre: true, correo: true } }
    },
    orderBy: { fecha_inicio: "desc" }
  });

  console.log(`\nJornadas activas en SCALA: ${jornadas.length}`);

  for (const jornada of jornadas) {
    console.log("\n───────────────────────────────────────────────────────────");
    console.log(`Jornada: ${jornada.id}`);
    console.log(`Usuario: ${jornada.usuario?.nombre}`);
    console.log(`Estado: ${jornada.estado}`);
    console.log(`Fecha inicio: ${jornada.fecha_inicio}`);

    // 3. Buscar apertura asociada
    const apertura = await prisma.aperturaCaja.findUnique({
      where: { jornada_id: jornada.id }
    });

    if (apertura) {
      console.log(`\nApertura encontrada:`);
      console.log(`  ID: ${apertura.id}`);
      console.log(`  Estado: ${apertura.estado}`);
      console.log(`  Requiere aprobación: ${apertura.requiere_aprobacion}`);
      console.log(`  Diferencias: ${JSON.stringify(apertura.diferencias).substring(0, 200)}...`);
      
      // 4. Verificar saldos del punto
      const saldos = await prisma.saldo.findMany({
        where: { punto_atencion_id: punto.id },
        include: { moneda: true }
      });

      console.log(`\nSaldos actuales en SCALA:`);
      for (const saldo of saldos) {
        console.log(`  ${saldo.moneda?.codigo}: ${saldo.cantidad} (Billetes: ${saldo.billetes}, Monedas: ${saldo.monedas_fisicas})`);
      }

      // 5. Verificar cuadre
      const cuadre = await prisma.cuadreCaja.findFirst({
        where: {
          punto_atencion_id: punto.id,
          estado: "ABIERTO"
        }
      });

      if (cuadre) {
        console.log(`\nCuadre abierto: ${cuadre.id}`);
      } else {
        console.log(`\n⚠️ No hay cuadre abierto`);
      }

    } else {
      console.log(`\n⚠️ No tiene apertura de caja`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
