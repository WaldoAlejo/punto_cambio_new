/**
 * Corregir todas las aperturas de caja con saldos desactualizados
 * Uso: node scripts/diagnostic/corregir-todas-aperturas.mjs [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function corregirTodas() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CORRECCIÓN DE TODAS LAS APERTURAS DE CAJA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('⚠️  MODO DRY-RUN: Solo se mostrarán las diferencias\n');
  }

  // 1. Obtener todas las aperturas en estado EN_CONTEO o PENDIENTE
  const aperturas = await prisma.aperturaCaja.findMany({
    where: {
      estado: { in: ['EN_CONTEO', 'PENDIENTE'] },
    },
    include: {
      jornada: {
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          usuario: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fecha: 'desc' },
  });

  console.log(`Aperturas encontradas: ${aperturas.length}\n`);

  let totalCorregidas = 0;
  let totalConDiferencias = 0;

  for (const apertura of aperturas) {
    const punto = apertura.jornada?.puntoAtencion;
    const usuario = apertura.jornada?.usuario;

    if (!punto) continue;

    console.log(`\n📍 ${punto.nombre} | ${usuario?.nombre || 'N/A'} | ${apertura.estado}`);
    console.log('-'.repeat(60));

    const saldoEsperadoActual = Array.isArray(apertura.saldo_esperado)
      ? apertura.saldo_esperado
      : [];

    let tieneDiferencias = false;
    const nuevoSaldoEsperado = [];

    for (const saldoActual of saldoEsperadoActual) {
      // Obtener saldo real de la tabla Saldo
      const saldoReal = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: saldoActual.moneda_id,
          },
        },
      });

      const cantidadReal = Number(saldoReal?.cantidad || 0);
      const diferencia = Math.abs(saldoActual.cantidad - cantidadReal);

      if (diferencia > 0.01) {
        console.log(`  ⚠️  ${saldoActual.codigo}: ${saldoActual.cantidad} → ${cantidadReal.toFixed(2)} (diff: ${(cantidadReal - saldoActual.cantidad).toFixed(2)})`);
        tieneDiferencias = true;
      }

      // Agregar al nuevo saldo esperado (con valores correctos)
      nuevoSaldoEsperado.push({
        ...saldoActual,
        cantidad: cantidadReal,
        billetes: Number(saldoReal?.billetes || cantidadReal),
        monedas: Number(saldoReal?.monedas_fisicas || 0),
      });
    }

    if (tieneDiferencias) {
      totalConDiferencias++;
      
      if (!dryRun) {
        await prisma.aperturaCaja.update({
          where: { id: apertura.id },
          data: {
            saldo_esperado: nuevoSaldoEsperado,
          },
        });
        console.log('  ✅ Corregida');
        totalCorregidas++;
      } else {
        console.log('  🔍 Pendiente (dry-run)');
      }
    } else {
      console.log('  ✅ Sin diferencias');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Total aperturas revisadas: ${aperturas.length}`);
  console.log(`Con diferencias: ${totalConDiferencias}`);
  console.log(`Corregidas: ${totalCorregidas}`);

  if (dryRun && totalConDiferencias > 0) {
    console.log('\nPara aplicar las correcciones, ejecute sin --dry-run');
  }

  await prisma.$disconnect();
}

corregirTodas().catch(console.error);
