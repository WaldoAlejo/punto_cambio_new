/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE REPARACIÓN: Saldos Duplicados por Bug en Asignación
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script corrige los saldos que fueron duplicados debido a un bug en
 * el servicio movimientoSaldoService.ts que causaba doble incremento al
 * asignar saldos iniciales.
 * 
 * Uso:
 *   node scripts/repair-saldos.mjs --dry-run  (solo mostrar, no corregir)
 *   node scripts/repair-saldos.mjs             (aplicar correcciones)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Parsear argumentos
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  REPARACIÓN DE SALDOS DUPLICADOS');
console.log('═══════════════════════════════════════════════════════════════');
console.log();

if (dryRun) {
  console.log('⚠️  MODO DRY-RUN: Solo se mostrarán las diferencias, no se corregirán');
  console.log();
}

async function calcularSaldoReal(puntoAtencionId, monedaId) {
  // 1. Obtener el SaldoInicial ACTIVO
  const saldoInicialActivo = await prisma.saldoInicial.findFirst({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      activo: true,
    },
    select: { cantidad_inicial: true },
  });

  let saldoCalculado = Number(saldoInicialActivo?.cantidad_inicial || 0);

  // 2. Obtener movimientos EXCLUYENDO SALDO_INICIAL
  const movimientos = await prisma.movimientoSaldo.findMany({
    where: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: monedaId,
      tipo_movimiento: { not: 'SALDO_INICIAL' },
    },
    select: { monto: true },
  });

  // 3. Calcular saldo
  for (const mov of movimientos) {
    const monto = Number(mov.monto);
    if (!isNaN(monto) && isFinite(monto)) {
      saldoCalculado += monto;
    }
  }

  return Number(saldoCalculado.toFixed(2));
}

async function main() {
  try {
    // Obtener puntos y monedas
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });

    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true },
    });

    console.log(`Puntos encontrados: ${puntos.length}`);
    console.log(`Monedas encontradas: ${monedas.length}`);
    console.log();

    const resultados = [];

    for (const punto of puntos) {
      for (const moneda of monedas) {
        // Obtener saldo actual
        const saldoActual = await prisma.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
            },
          },
        });

        const saldoCalculado = await calcularSaldoReal(punto.id, moneda.id);
        const saldoActualNum = Number(saldoActual?.cantidad || 0);
        const diferencia = Number((saldoCalculado - saldoActualNum).toFixed(2));

        if (Math.abs(diferencia) > 0.01) {
          console.log(`⚠️  ${punto.nombre} / ${moneda.codigo}:`);
          console.log(`   Actual:    ${saldoActualNum.toFixed(2)}`);
          console.log(`   Calculado: ${saldoCalculado.toFixed(2)}`);
          console.log(`   Diferencia: ${diferencia.toFixed(2)}`);

          if (!dryRun) {
            // Corregir saldo
            await prisma.saldo.upsert({
              where: {
                punto_atencion_id_moneda_id: {
                  punto_atencion_id: punto.id,
                  moneda_id: moneda.id,
                },
              },
              update: {
                cantidad: saldoCalculado,
                billetes: saldoCalculado,
                monedas_fisicas: 0,
              },
              create: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
                cantidad: saldoCalculado,
                billetes: saldoCalculado,
                monedas_fisicas: 0,
                bancos: 0,
              },
            });
            console.log('   ✅ CORREGIDO');
          } else {
            console.log('   🔍 PENDIENTE (dry-run)');
          }
          console.log();

          resultados.push({
            punto: punto.nombre,
            moneda: moneda.codigo,
            saldo_actual: saldoActualNum,
            saldo_calculado: saldoCalculado,
            diferencia,
            corregido: !dryRun,
          });
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RESUMEN');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total con diferencias: ${resultados.length}`);
    
    if (resultados.length > 0) {
      const totalDiferencia = resultados.reduce((sum, r) => sum + Math.abs(r.diferencia), 0);
      console.log(`Suma total de diferencias absolutas: ${totalDiferencia.toFixed(2)}`);
      
      if (dryRun) {
        console.log();
        console.log('Para aplicar las correcciones, ejecute:');
        console.log('  node scripts/repair-saldos.mjs');
      }
    }

    console.log();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
