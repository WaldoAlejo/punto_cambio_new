/**
 * Script para verificar inconsistencias en saldos de divisas de TODOS los puntos
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Inconsistencia {
  punto: string;
  moneda: string;
  saldoTabla: number;
  saldoCalculado: number;
  diferencia: number;
  severidad: "ALTA" | "MEDIA" | "BAJA";
}

async function calcularSaldoDesdeMovimientos(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  // Obtener TODOS los saldos iniciales (puede haber múltiples asignaciones)
  const saldosIniciales = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      tipo_movimiento: "SALDO_INICIAL",
    },
    orderBy: { fecha: "asc" },
  });

  // Sumar todos los saldos iniciales como base
  let saldoCalculado = saldosIniciales.reduce((sum, s) => sum + Number(s.monto), 0);
  const fechaCorte = saldosIniciales.length > 0 
    ? saldosIniciales[saldosIniciales.length - 1].fecha 
    : null;

  // Obtener movimientos posteriores al último saldo inicial
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      tipo_movimiento: { not: "SALDO_INICIAL" }, // Excluir saldos iniciales (ya sumados)
      ...(fechaCorte ? { fecha: { gt: fechaCorte } } : {}),
    },
    select: {
      monto: true,
      tipo_movimiento: true,
      descripcion: true,
    },
    orderBy: { fecha: "asc" },
  });

  for (const mov of movimientos) {
    const desc = (mov.descripcion || "").toLowerCase();
    
    // Si el movimiento está marcado como "(CAJA)", SIEMPRE afecta caja
    if (desc.includes("(caja)")) {
      saldoCalculado += Number(mov.monto);
      continue;
    }
    
    // Excluir movimientos bancarios
    if (/\bbancos?\b/i.test(desc)) continue;

    saldoCalculado += Number(mov.monto);
  }

  return Number(saldoCalculado.toFixed(2));
}

async function main() {
  console.log("🔍 Verificando saldos de divisas en todos los puntos...\n");

  const inconsistencias: Inconsistencia[] = [];
  const correctos: Inconsistencia[] = [];

  // Obtener todos los saldos con información de punto y moneda
  const saldos = await prisma.saldo.findMany({
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
    where: {
      moneda: {
        codigo: { not: "USD" } // Solo divisas (no USD)
      }
    }
  });

  console.log(`📊 Total de registros de saldo de divisas: ${saldos.length}\n`);

  for (const saldo of saldos) {
    const saldoTabla = Number(saldo.cantidad);
    const saldoCalculado = await calcularSaldoDesdeMovimientos(
      saldo.punto_atencion_id,
      saldo.moneda_id
    );
    const diferencia = Number((saldoTabla - saldoCalculado).toFixed(2));
    
    const info: Inconsistencia = {
      punto: saldo.puntoAtencion?.nombre || "Desconocido",
      moneda: saldo.moneda?.codigo || "???",
      saldoTabla,
      saldoCalculado,
      diferencia,
      severidad: Math.abs(diferencia) > 1000 ? "ALTA" : Math.abs(diferencia) > 100 ? "MEDIA" : "BAJA",
    };

    if (Math.abs(diferencia) > 0.01) {
      inconsistencias.push(info);
    } else {
      correctos.push(info);
    }
  }

  console.log(`✅ Saldos correctos: ${correctos.length}`);
  console.log(`❌ Saldos con inconsistencias: ${inconsistencias.length}\n`);

  if (inconsistencias.length > 0) {
    // Ordenar por severidad y diferencia
    inconsistencias.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

    console.log("📋 Detalle de inconsistencias (ordenadas por magnitud):\n");
    console.table(inconsistencias.map(i => ({
      Punto: i.punto,
      Moneda: i.moneda,
      "Saldo BD": i.saldoTabla.toFixed(2),
      "Saldo Calc": i.saldoCalculado.toFixed(2),
      Diferencia: i.diferencia.toFixed(2),
      Severidad: i.severidad,
    })));

    // Separar por severidad
    const alta = inconsistencias.filter(i => i.severidad === "ALTA");
    const media = inconsistencias.filter(i => i.severidad === "MEDIA");
    const baja = inconsistencias.filter(i => i.severidad === "BAJA");

    console.log(`\n🔴 Inconsistencias ALTA (>1000): ${alta.length}`);
    console.log(`🟡 Inconsistencias MEDIA (100-1000): ${media.length}`);
    console.log(`🟢 Inconsistencias BAJA (<100): ${baja.length}`);

    // Preguntar si corregir
    const shouldFix = process.argv.includes("--fix");
    
    if (shouldFix) {
      console.log("\n🔧 Corrigiendo inconsistencias...\n");
      
      for (const inc of inconsistencias) {
        try {
          // Buscar IDs
          const punto = await prisma.puntoAtencion.findFirst({
            where: { nombre: inc.punto },
            select: { id: true }
          });
          const moneda = await prisma.moneda.findFirst({
            where: { codigo: inc.moneda },
            select: { id: true }
          });

          if (!punto || !moneda) {
            console.log(`⚠️  No se encontró punto o moneda para: ${inc.punto} - ${inc.moneda}`);
            continue;
          }

          await prisma.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
            },
            data: {
              cantidad: inc.saldoCalculado,
              billetes: inc.saldoCalculado,
              monedas_fisicas: 0,
              updated_at: new Date(),
            },
          });
          console.log(`✅ Corregido: ${inc.punto} - ${inc.moneda} (${inc.saldoTabla.toFixed(2)} → ${inc.saldoCalculado.toFixed(2)})`);
        } catch (error) {
          console.error(`❌ Error corrigiendo ${inc.punto} - ${inc.moneda}:`, error);
        }
      }
      
      console.log("\n✅ Correcciones completadas");
    } else {
      console.log("\n💡 Para corregir las inconsistencias, ejecute:");
      console.log("   npx tsx scripts/verificar-todos-saldos-divisas.ts --fix");
    }
  } else {
    console.log("🎉 Todos los saldos de divisas están consistentes");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
