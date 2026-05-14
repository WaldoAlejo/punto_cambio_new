/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIMPIEZA COMPLETA DE TRANSACCIONES Y SALDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Script: npx ts-node scripts/limpieza-completa-transacciones.ts
 *
 * BORRA todo el historial de transacciones y resetea saldos a cero:
 *   - Cambios de divisa
 *   - Servicios externos (movimientos, asignaciones, saldos, cierres)
 *   - Transferencias
 *   - Asignaciones de saldo
 *   - Movimientos de saldo
 *   - Historial de saldos
 *   - Saldos iniciales y saldos actuales (todos a cero)
 *   - Recibos, solicitudes de saldo, cierres diarios, cuadres de caja
 *
 * PRESERVA:
 *   - Usuarios
 *   - Puntos de atención
 *   - Jornadas
 *   - Monedas
 *   - Todo lo relacionado con Servientrega (guías, remitentes, destinatarios,
 *     saldos, historial, solicitudes, anulaciones)
 *
 * SEGURIDAD:
 *   - Por defecto hace DRY-RUN (solo muestra conteos, no borra nada)
 *   - Requiere --execute para borrar
 *   - Requiere --force en producción (NODE_ENV=production)
 *   - Usa transacción Prisma: todo o nada
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ────────────────────────────────────────────────────────────────────────
   Orden de borrado: tablas hijas primero, padres después
   ──────────────────────────────────────────────────────────────────────── */

type TableInfo = {
  key: string;
  label: string;
};

const deleteOrder: TableInfo[] = [
  // Servicios externos (hijos → padres)
  { key: "servicioExternoDetalleCierre", label: "ServicioExternoDetalleCierre" },
  { key: "servicioExternoCierreDiario", label: "ServicioExternoCierreDiario" },

  // Cuadre de caja
  { key: "detalleCuadreCaja", label: "DetalleCuadreCaja" },
  { key: "cuadreCaja", label: "CuadreCaja" },

  // Referencias y solicitudes
  { key: "recibo", label: "Recibo" },
  { key: "solicitudSaldo", label: "SolicitudSaldo" },

  // Servicios externos (transacciones)
  { key: "servicioExternoMovimiento", label: "ServicioExternoMovimiento" },
  { key: "servicioExternoAsignacion", label: "ServicioExternoAsignacion" },
  { key: "servicioExternoSaldo", label: "ServicioExternoSaldo" },

  // Cambios de divisa y transferencias
  { key: "cambioDivisa", label: "CambioDivisa" },
  { key: "transferencia", label: "Transferencia" },

  // Saldos y movimientos
  { key: "movimientoSaldo", label: "MovimientoSaldo" },
  { key: "asignacionSaldo", label: "AsignacionSaldo" },
  { key: "historialSaldo", label: "HistorialSaldo" },
  { key: "saldoInicial", label: "SaldoInicial" },
  { key: "saldo", label: "Saldo" },

  // Cierres diarios
  { key: "cierreDiario", label: "CierreDiario" },

  // Historial de asignación de puntos
  { key: "historialAsignacionPunto", label: "HistorialAsignacionPunto" },
];

/* ────────────────────────────────────────────────────────────────────────
   Tablas preservadas (para mostrar en el resumen)
   ──────────────────────────────────────────────────────────────────────── */

const preservedTables: TableInfo[] = [
  { key: "usuario", label: "Usuario" },
  { key: "puntoAtencion", label: "PuntoAtencion" },
  { key: "jornada", label: "Jornada" },
  { key: "moneda", label: "Moneda" },
  { key: "servientregaGuia", label: "ServientregaGuia" },
  { key: "servientregaRemitente", label: "ServientregaRemitente" },
  { key: "servientregaDestinatario", label: "ServientregaDestinatario" },
  { key: "servientregaSaldo", label: "ServientregaSaldo" },
  { key: "servientregaHistorialSaldo", label: "ServientregaHistorialSaldo" },
  { key: "servientregaSolicitudSaldo", label: "ServientregaSolicitudSaldo" },
  { key: "servientregaSolicitudAnulacion", label: "ServientregaSolicitudAnulacion" },
];

/* ────────────────────────────────────────────────────────────────────────
   Argumentos
   ──────────────────────────────────────────────────────────────────────── */

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    execute: args.has("--execute") || args.has("-x"),
    force: args.has("--force") || args.has("-f"),
    verbose: args.has("--verbose") || args.has("-v"),
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Conteos
   ──────────────────────────────────────────────────────────────────────── */

async function countTargets(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { key } of deleteOrder) {
    // @ts-expect-error dynamic delegate access
    counts[key] = await prisma[key].count();
  }
  return counts;
}

async function countPreserved(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { key } of preservedTables) {
    // @ts-expect-error dynamic delegate access
    counts[key] = await prisma[key].count();
  }
  return counts;
}

/* ────────────────────────────────────────────────────────────────────────
   Ejecución del borrado (dentro de transacción)
   ──────────────────────────────────────────────────────────────────────── */

async function executeCleanup(verbose: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const { key, label } of deleteOrder) {
      // @ts-expect-error dynamic delegate access
      const res = await tx[key].deleteMany();
      if (verbose) {
        console.log(`  [deleted] ${label}: ${res.count} filas`);
      }
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────
   Dry-run: mostrar resumen sin borrar
   ──────────────────────────────────────────────────────────────────────── */

async function printDryRun(): Promise<void> {
  const [targetCounts, preservedCounts] = await Promise.all([
    countTargets(),
    countPreserved(),
  ]);

  const totalToDelete = Object.values(targetCounts).reduce((a, b) => a + b, 0);

  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║         DRY-RUN: LIMPIEZA COMPLETA DE TRANSACCIONES Y SALDOS         ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log("");

  console.log("📋 TABLAS QUE SE BORRARÁN:");
  console.log("──────────────────────────────────────────────────────────────────────");
  for (const { key, label } of deleteOrder) {
    const count = targetCounts[key] || 0;
    const marker = count > 0 ? "⚠️ " : "✅ ";
    console.log(`  ${marker}${label.padEnd(36)} ${count.toString().padStart(6)} filas`);
  }
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(`  TOTAL A BORRAR: ${totalToDelete} filas`);
  console.log("");

  console.log("🛡️  TABLAS QUE SE PRESERVAN:");
  console.log("──────────────────────────────────────────────────────────────────────");
  for (const { key, label } of preservedTables) {
    const count = preservedCounts[key] || 0;
    console.log(`  ✅ ${label.padEnd(36)} ${count.toString().padStart(6)} filas`);
  }
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log("");

  console.log("⚡ Para ejecutar el borrado real, corre:");
  console.log(`   npx ts-node scripts/limpieza-completa-transacciones.ts --execute`);
  console.log("");
  console.log("⚡ En producción agrega --force:");
  console.log(`   npx ts-node scripts/limpieza-completa-transacciones.ts --execute --force`);
  console.log("");
  console.log("⚡ Para ver detalle fila por fila agrega --verbose");
}

/* ────────────────────────────────────────────────────────────────────────
   Main
   ──────────────────────────────────────────────────────────────────────── */

async function main() {
  const { execute, force, verbose } = parseArgs();
  const isProd = process.env.NODE_ENV === "production";

  console.log("🔧 Entorno:", isProd ? "PRODUCCIÓN" : "DESARROLLO");
  console.log("");

  // Seguridad: en producción requiere --force explícito
  if (execute && isProd && !force) {
    throw new Error(
      "🛑 NODE_ENV=production detectado. Usa --force para ejecutar la limpieza en producción."
    );
  }

  if (!execute) {
    await printDryRun();
    return;
  }

  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║         EJECUTANDO LIMPIEZA COMPLETA DE TRANSACCIONES Y SALDOS       ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log("");

  const beforeCounts = await countTargets();
  const totalBefore = Object.values(beforeCounts).reduce((a, b) => a + b, 0);

  console.log(`📊 Total de filas a borrar: ${totalBefore}`);
  console.log("🗑️  Iniciando borrado en transacción...");
  console.log("");

  const startTime = Date.now();
  await executeCleanup(verbose);
  const duration = Date.now() - startTime;

  console.log("");
  console.log("✅ Limpieza completada exitosamente.");
  console.log(`⏱️  Duración: ${duration}ms`);
  console.log("");

  const afterCounts = await countTargets();
  const totalAfter = Object.values(afterCounts).reduce((a, b) => a + b, 0);

  if (totalAfter === 0) {
    console.log("🎉 Todas las tablas objetivo quedaron vacías.");
  } else {
    console.log("⚠️  Algunas tablas no quedaron vacías (revisa manualmente):");
    for (const { key, label } of deleteOrder) {
      const count = afterCounts[key] || 0;
      if (count > 0) {
        console.log(`   - ${label}: ${count} filas restantes`);
      }
    }
  }

  // Verificar preservados
  const preservedCounts = await countPreserved();
  console.log("");
  console.log("🛡️  Tablas preservadas (verificación):");
  for (const { key, label } of preservedTables) {
    const count = preservedCounts[key] || 0;
    console.log(`   ✅ ${label}: ${count} filas`);
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error("❌ Error durante la limpieza:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
