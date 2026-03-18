/**
 * Script para verificar y corregir inconsistencias en saldos
 * 
 * Problema: Al asignar saldos iniciales, se perdían saldos existentes debido a
 * una condición de carrera donde registrarMovimientoSaldo sobrescribía el saldo
 * que ya había sido actualizado correctamente en la transacción principal.
 * 
 * Solución aplicada: El servicio registrarMovimientoSaldo ya no actualiza la tabla
 * Saldo cuando el tipo de movimiento es SALDO_INICIAL.
 * 
 * Este script verifica si hay inconsistencias y las corrige si es necesario.
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface SaldoInconsistency {
  puntoAtencionId: string;
  puntoNombre: string;
  monedaId: string;
  monedaCodigo: string;
  saldoRegistrado: number;
  saldoCalculado: number;
  diferencia: number;
}

async function calcularSaldoDesdeMovimientos(
  puntoAtencionId: string,
  monedaId: string
): Promise<number> {
  // Obtener el saldo inicial más reciente
  const saldoInicial = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    orderBy: { fecha_asignacion: "desc" },
  });

  let saldoCalculado = Number(saldoInicial?.cantidad_inicial || 0);
  const fechaCorte = saldoInicial?.fecha_asignacion;

  // Obtener movimientos desde el saldo inicial
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      ...(fechaCorte ? { fecha: { gte: fechaCorte } } : {}),
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

    const tipo = (mov.tipo_movimiento || "").toUpperCase();
    const monto = Number(mov.monto);

    if (tipo === "SALDO_INICIAL") continue; // Ya está incluido

    // Normalizar signo
    if (tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE" || tipo === "TRANSFERENCIA_SALIDA") {
      saldoCalculado -= Math.abs(monto);
    } else if (tipo === "INGRESO" || tipo === "TRANSFERENCIA_ENTRANTE" || tipo === "TRANSFERENCIA_ENTRADA" || tipo === "TRANSFERENCIA_DEVOLUCION") {
      saldoCalculado += Math.abs(monto);
    } else if (tipo === "AJUSTE") {
      saldoCalculado += monto;
    } else {
      saldoCalculado += monto;
    }
  }

  return Number(saldoCalculado.toFixed(2));
}

async function main() {
  console.log("🔍 Verificando inconsistencias en saldos...\n");

  // Obtener todos los saldos
  const saldos = await prisma.saldo.findMany({
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
  });

  const inconsistencias: SaldoInconsistency[] = [];
  const correctos: SaldoInconsistency[] = [];

  for (const saldo of saldos) {
    const saldoRegistrado = Number(saldo.cantidad);
    const saldoCalculado = await calcularSaldoDesdeMovimientos(
      saldo.punto_atencion_id,
      saldo.moneda_id
    );
    const diferencia = Number((saldoRegistrado - saldoCalculado).toFixed(2));

    const info = {
      puntoAtencionId: saldo.punto_atencion_id,
      puntoNombre: saldo.puntoAtencion?.nombre || "Desconocido",
      monedaId: saldo.moneda_id,
      monedaCodigo: saldo.moneda?.codigo || "???",
      saldoRegistrado,
      saldoCalculado,
      diferencia,
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
    console.log("📋 Detalle de inconsistencias:\n");
    console.table(inconsistencias.map(i => ({
      Punto: i.puntoNombre,
      Moneda: i.monedaCodigo,
      "Saldo BD": i.saldoRegistrado.toFixed(2),
      "Saldo Calc": i.saldoCalculado.toFixed(2),
      Diferencia: i.diferencia.toFixed(2),
    })));

    // Preguntar si corregir
    const shouldFix = process.argv.includes("--fix");
    
    if (shouldFix) {
      console.log("\n🔧 Corrigiendo inconsistencias...\n");
      
      for (const inc of inconsistencias) {
        try {
          await prisma.saldo.update({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: inc.puntoAtencionId,
                moneda_id: inc.monedaId,
              },
            },
            data: {
              cantidad: inc.saldoCalculado,
              billetes: inc.saldoCalculado,
              monedas_fisicas: 0,
              updated_at: new Date(),
            },
          });
          console.log(`✅ Corregido: ${inc.puntoNombre} - ${inc.monedaCodigo} (${inc.saldoRegistrado.toFixed(2)} → ${inc.saldoCalculado.toFixed(2)})`);
        } catch (error) {
          console.error(`❌ Error corrigiendo ${inc.puntoNombre} - ${inc.monedaCodigo}:`, error);
        }
      }
      
      console.log("\n✅ Correcciones completadas");
    } else {
      console.log("\n💡 Para corregir las inconsistencias, ejecute:");
      console.log("   npx tsx scripts/verificar-corregir-saldos.ts --fix");
    }
  } else {
    console.log("🎉 Todos los saldos están consistentes");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
