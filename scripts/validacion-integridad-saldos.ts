/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VALIDACIÓN DE INTEGRIDAD DE SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script verifica la integridad de los saldos y movimientos.
 * Debe ejecutarse periódicamente (diario/semanal) para detectar
 * inconsistencias antes de que se acumulen.
 * 
 * Uso:
 *   npx tsx scripts/validacion-integridad-saldos.ts [--fix]
 * 
 *   --fix: Intenta corregir automáticamente las inconsistencias encontradas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, TipoMovimientoSaldo } from "@prisma/client";

const prisma = new PrismaClient();
const SHOULD_FIX = process.argv.includes('--fix');

interface Inconsistencia {
  tipo: 'CAMBIO_SIN_MOVIMIENTOS' | 'MOVIMIENTOS_DUPLICADOS' | 'SALDO_INCORRECTO' | 'MOVIMIENTO_HUERFANO';
  severidad: 'ALTA' | 'MEDIA' | 'BAJA';
  puntoId: string;
  puntoNombre: string;
  referenciaId?: string;
  monedaCodigo?: string;
  descripcion: string;
  detalles: Record<string, any>;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║         🔍 VALIDACIÓN DE INTEGRIDAD DE SALDOS Y MOVIMIENTOS               ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝");
  console.log(`Modo: ${SHOULD_FIX ? '🔧 CORRECCIÓN AUTOMÁTICA' : '👁️  SOLO LECTURA'}\n`);

  const inconsistencias: Inconsistencia[] = [];

  // 1. Verificar cambios sin movimientos suficientes
  console.log("1️⃣  Verificando cambios de divisa...");
  const cambios = await prisma.cambioDivisa.findMany({
    where: { estado: 'COMPLETADO' },
    include: {
      puntoAtencion: true,
      monedaOrigen: true,
      monedaDestino: true,
    },
    take: 1000, // Limitar para evitar sobrecarga
    orderBy: { fecha: 'desc' },
  });

  for (const cambio of cambios) {
    // Buscar movimientos asociados a este cambio
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        referencia_id: cambio.id,
        tipo_referencia: { in: ['CAMBIO_DIVISA', 'EXCHANGE'] },
      },
    });
    
    // Un cambio debería tener al menos 2 movimientos (INGRESO origen + EGRESO destino)
    const ingresos = movimientos.filter(m => m.tipo_movimiento === 'INGRESO');
    const egresos = movimientos.filter(m => m.tipo_movimiento === 'EGRESO');
    
    const tieneIngresoOrigen = ingresos.some(m => m.moneda_id === cambio.moneda_origen_id);
    const tieneEgresoDestino = egresos.some(m => m.moneda_id === cambio.moneda_destino_id);
    
    if (movimientos.length < 2 || !tieneIngresoOrigen || !tieneEgresoDestino) {
      inconsistencias.push({
        tipo: 'CAMBIO_SIN_MOVIMIENTOS',
        severidad: 'ALTA',
        puntoId: cambio.punto_atencion_id,
        puntoNombre: cambio.puntoAtencion.nombre,
        referenciaId: cambio.id,
        descripcion: `Cambio ${cambio.numero_recibo} incompleto: ${movimientos.length} movimientos (esperados: 2+)`,
        detalles: {
          numeroRecibo: cambio.numero_recibo,
          fecha: cambio.fecha,
          monedaOrigen: cambio.monedaOrigen.codigo,
          monedaDestino: cambio.monedaDestino.codigo,
          montoOrigen: cambio.monto_origen.toString(),
          montoDestino: cambio.monto_destino.toString(),
          movimientosExistentes: movimientos.map(m => ({
            tipo: m.tipo_movimiento,
            moneda: m.moneda_id,
            monto: m.monto.toString(),
          })),
          tieneIngresoOrigen,
          tieneEgresoDestino,
        },
      });
    }

    // Detectar posibles duplicados (más de 2 movimientos del mismo tipo/moneda)
    const ingresosOrigen = ingresos.filter(m => m.moneda_id === cambio.moneda_origen_id);
    const egresosDestino = egresos.filter(m => m.moneda_id === cambio.moneda_destino_id);
    
    if (ingresosOrigen.length > 1 || egresosDestino.length > 1) {
      inconsistencias.push({
        tipo: 'MOVIMIENTOS_DUPLICADOS',
        severidad: 'MEDIA',
        puntoId: cambio.punto_atencion_id,
        puntoNombre: cambio.puntoAtencion.nombre,
        referenciaId: cambio.id,
        descripcion: `Posibles movimientos duplicados en cambio ${cambio.numero_recibo}`,
        detalles: {
          numeroRecibo: cambio.numero_recibo,
          ingresosOrigen: ingresosOrigen.length,
          egresosDestino: egresosDestino.length,
        },
      });
    }
  }

  console.log(`   ${cambios.length} cambios verificados`);
  console.log(`   ${inconsistencias.filter(i => i.tipo === 'CAMBIO_SIN_MOVIMIENTOS').length} cambios incompletos`);
  console.log(`   ${inconsistencias.filter(i => i.tipo === 'MOVIMIENTOS_DUPLICADOS').length} con posibles duplicados`);

  // 2. Verificar consistencia de saldos
  console.log("\n2️⃣  Verificando saldos calculados vs tabla...");
  
  const puntos = await prisma.puntoAtencion.findMany();
  const monedas = await prisma.moneda.findMany({ where: { activo: true } });

  for (const punto of puntos) {
    for (const moneda of monedas) {
      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: punto.id,
            moneda_id: moneda.id,
          },
        },
      });

      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          punto_atencion_id: punto.id,
          moneda_id: moneda.id,
        },
      });

      const calculado = movimientos.reduce((sum, m) => sum + Number(m.monto), 0);
      const enTabla = Number(saldo?.cantidad || 0);

      if (Math.abs(calculado - enTabla) > 0.01) {
        inconsistencias.push({
          tipo: 'SALDO_INCORRECTO',
          severidad: 'ALTA',
          puntoId: punto.id,
          puntoNombre: punto.nombre,
          monedaCodigo: moneda.codigo,
          descripcion: `Saldo ${moneda.codigo} en ${punto.nombre}: Tabla=${enTabla.toFixed(2)}, Calculado=${calculado.toFixed(2)}`,
          detalles: {
            enTabla,
            calculado,
            diferencia: calculado - enTabla,
            totalMovimientos: movimientos.length,
          },
        });

        // Auto-fix: Actualizar tabla saldo
        if (SHOULD_FIX) {
          await prisma.saldo.upsert({
            where: {
              punto_atencion_id_moneda_id: {
                punto_atencion_id: punto.id,
                moneda_id: moneda.id,
              },
            },
            update: { cantidad: calculado },
            create: {
              punto_atencion_id: punto.id,
              moneda_id: moneda.id,
              cantidad: calculado,
              billetes: calculado,
              monedas_fisicas: 0,
            },
          });
          console.log(`   🔧 Corregido saldo ${moneda.codigo} en ${punto.nombre}: ${calculado.toFixed(2)}`);
        }
      }
    }
  }

  console.log(`   ${inconsistencias.filter(i => i.tipo === 'SALDO_INCORRECTO').length} saldos inconsistentes`);

  // 3. Verificar movimientos huérfanos (sin referencia válida)
  console.log("\n3️⃣  Verificando movimientos huérfanos...");
  
  const movimientosCambio = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_referencia: 'CAMBIO_DIVISA',
    },
    take: 1000,
    orderBy: { fecha: 'desc' },
  });

  let huerfanos = 0;
  for (const mov of movimientosCambio) {
    if (mov.referencia_id) {
      const cambio = await prisma.cambioDivisa.findUnique({
        where: { id: mov.referencia_id },
      });
      if (!cambio) {
        huerfanos++;
        inconsistencias.push({
          tipo: 'MOVIMIENTO_HUERFANO',
          severidad: 'BAJA',
          puntoId: mov.punto_atencion_id,
          puntoNombre: 'Desconocido',
          referenciaId: mov.referencia_id,
          monedaCodigo: mov.moneda_id,
          descripcion: `Movimiento ${mov.id} referencia a cambio inexistente: ${mov.referencia_id}`,
          detalles: {
            movimientoId: mov.id,
            monto: mov.monto.toString(),
            fecha: mov.fecha,
          },
        });
      }
    }
  }

  console.log(`   ${huerfanos} movimientos huérfanos encontrados`);

  // Reporte Final
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log("📊 REPORTE DE INCONSISTENCIAS");
  console.log("════════════════════════════════════════════════════════════════════════════");

  const porSeveridad = {
    ALTA: inconsistencias.filter(i => i.severidad === 'ALTA'),
    MEDIA: inconsistencias.filter(i => i.severidad === 'MEDIA'),
    BAJA: inconsistencias.filter(i => i.severidad === 'BAJA'),
  };

  console.log(`\n🔴 Altas: ${porSeveridad.ALTA.length}`);
  console.log(`🟡 Medias: ${porSeveridad.MEDIA.length}`);
  console.log(`🟢 Bajas: ${porSeveridad.BAJA.length}`);
  console.log(`\n📋 Total: ${inconsistencias.length} inconsistencias`);

  if (inconsistencias.length > 0) {
    console.log("\n════════════════════════════════════════════════════════════════════════════");
    console.log("📋 DETALLES");
    console.log("════════════════════════════════════════════════════════════════════════════\n");

    for (const inc of inconsistencias.slice(0, 20)) { // Mostrar solo las primeras 20
      const icono = inc.severidad === 'ALTA' ? '🔴' : inc.severidad === 'MEDIA' ? '🟡' : '🟢';
      console.log(`${icono} [${inc.tipo}] ${inc.descripcion}`);
      if (inc.puntoNombre !== 'Desconocido') {
        console.log(`   📍 ${inc.puntoNombre}`);
      }
    }

    if (inconsistencias.length > 20) {
      console.log(`\n... y ${inconsistencias.length - 20} inconsistencias más`);
    }
  }

  // Guardar reporte
  const reporte = {
    fecha: new Date().toISOString(),
    modo: SHOULD_FIX ? 'CORRECCION' : 'LECTURA',
    resumen: {
      totalInconsistencias: inconsistencias.length,
      altas: porSeveridad.ALTA.length,
      medias: porSeveridad.MEDIA.length,
      bajas: porSeveridad.BAJA.length,
    },
    inconsistencias,
  };

  const fs = await import('fs');
  const reportePath = `validacion-integridad-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportePath, JSON.stringify(reporte, null, 2));
  console.log(`\n📝 Reporte guardado en: ${reportePath}`);

  await prisma.$disconnect();

  // Exit code para CI/CD
  process.exit(porSeveridad.ALTA.length > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
