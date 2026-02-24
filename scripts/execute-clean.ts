#!/usr/bin/env node
/**
 * Script para ejecutar la limpieza completa de la base de datos
 * Preserva: Usuarios, Puntos, Jornadas, Monedas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteIfExists(modelName: string, deleteFn: () => Promise<any>) {
  try {
    await deleteFn();
    console.log(`   ✓ Eliminando ${modelName}...`);
    return true;
  } catch (error: any) {
    // Ignorar errores de tabla no existe
    if (error.code === 'P2021' || error.meta?.table?.includes(modelName)) {
      console.log(`   ℹ️  Tabla ${modelName} no existe, ignorando...`);
      return true;
    }
    throw error;
  }
}

async function main() {
  console.log("🧹 INICIANDO LIMPIEZA COMPLETA DE BASE DE DATOS");
  console.log("================================================\n");

  // Verificar conexión
  console.log("1. Verificando conexión a la base de datos...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("   ✅ Conexión exitosa\n");
  } catch (error) {
    console.error("   ❌ Error de conexión:", error);
    process.exit(1);
  }

  // Mostrar conteos antes de limpiar
  console.log("2. Conteos ANTES de la limpieza:");
  console.log("   ------------------------------");
  
  const countsBefore = await Promise.all([
    prisma.cambioDivisa.count().then(c => ({ tabla: "CambioDivisa", count: c })),
    prisma.transferencia.count().then(c => ({ tabla: "Transferencia", count: c })),
    prisma.movimientoSaldo.count().then(c => ({ tabla: "MovimientoSaldo", count: c })),
    prisma.saldo.count().then(c => ({ tabla: "Saldo", count: c })),
    prisma.servientregaGuia.count().then(c => ({ tabla: "ServientregaGuia", count: c })),
    prisma.servicioExternoMovimiento.count().then(c => ({ tabla: "ServicioExternoMovimiento", count: c })),
    prisma.recibo.count().then(c => ({ tabla: "Recibo", count: c })),
    prisma.cuadreCaja.count().then(c => ({ tabla: "CuadreCaja", count: c })),
    prisma.usuario.count().then(c => ({ tabla: "Usuario", count: c })),
    prisma.puntoAtencion.count().then(c => ({ tabla: "PuntoAtencion", count: c })),
    prisma.jornada.count().then(c => ({ tabla: "Jornada", count: c })),
    prisma.moneda.count().then(c => ({ tabla: "Moneda", count: c })),
  ]);

  countsBefore.forEach(({ tabla, count }) => {
    console.log(`   ${tabla.padEnd(30)} ${count.toString().padStart(5)} registros`);
  });
  console.log();

  // Confirmación
  console.log("⚠️  ADVERTENCIA: Esta operación es IRREVERSIBLE.");
  console.log("    Se eliminarán TODOS los registros operacionales.");
  console.log("    Se PRESERVARÁN: Usuarios, Puntos, Jornadas, Monedas.\n");

  // Ejecutar limpieza directa con Prisma
  console.log("3. Ejecutando limpieza...\n");

  try {
    // Eliminar en orden correcto (hojas primero, respetando FKs)
    await deleteIfExists("Movimiento", () => prisma.movimiento.deleteMany({}));
    await deleteIfExists("MovimientoSaldo", () => prisma.movimientoSaldo.deleteMany({}));
    await deleteIfExists("HistorialSaldo", () => prisma.historialSaldo.deleteMany({}));
    await deleteIfExists("DetalleCuadreCaja", () => prisma.detalleCuadreCaja.deleteMany({}));
    await deleteIfExists("CuadreCaja", () => prisma.cuadreCaja.deleteMany({}));
    await deleteIfExists("SaldoInicial", () => prisma.saldoInicial.deleteMany({}));
    await deleteIfExists("Recibo", () => prisma.recibo.deleteMany({}));
    await deleteIfExists("ServientregaGuia", () => prisma.servientregaGuia.deleteMany({}));
    await deleteIfExists("ServientregaDestinatario", () => prisma.servientregaDestinatario.deleteMany({}));
    await deleteIfExists("ServientregaRemitente", () => prisma.servientregaRemitente.deleteMany({}));
    await deleteIfExists("ServientregaHistorialSaldo", () => prisma.servientregaHistorialSaldo.deleteMany({}));
    await deleteIfExists("ServientregaSolicitudSaldo", () => prisma.servientregaSolicitudSaldo.deleteMany({}));
    await deleteIfExists("ServientregaSolicitudAnulacion", () => prisma.servientregaSolicitudAnulacion.deleteMany({}));
    await deleteIfExists("ServientregaSaldo", () => prisma.servientregaSaldo.deleteMany({}));
    await deleteIfExists("ServicioExternoMovimiento", () => prisma.servicioExternoMovimiento.deleteMany({}));
    await deleteIfExists("ServicioExternoSaldo", () => prisma.servicioExternoSaldo.deleteMany({}));
    await deleteIfExists("ServicioExternoDetalleCierre", () => prisma.servicioExternoDetalleCierre.deleteMany({}));
    await deleteIfExists("ServicioExternoCierreDiario", () => prisma.servicioExternoCierreDiario.deleteMany({}));
    await deleteIfExists("ServicioExternoAsignacion", () => prisma.servicioExternoAsignacion.deleteMany({}));
    await deleteIfExists("CierreDiario", () => prisma.cierreDiario.deleteMany({}));
    await deleteIfExists("SolicitudSaldo", () => prisma.solicitudSaldo.deleteMany({}));
    await deleteIfExists("SalidaEspontanea", () => prisma.salidaEspontanea.deleteMany({}));
    await deleteIfExists("HistorialAsignacionPunto", () => prisma.historialAsignacionPunto.deleteMany({}));
    await deleteIfExists("Permiso", () => prisma.permiso.deleteMany({}));
    await deleteIfExists("CambioDivisa", () => prisma.cambioDivisa.deleteMany({}));
    await deleteIfExists("Transferencia", () => prisma.transferencia.deleteMany({}));
    await deleteIfExists("Saldo", () => prisma.saldo.deleteMany({}));

    console.log("\n   ✅ Limpieza completada exitosamente!\n");

  } catch (error) {
    console.error("\n   ❌ Error durante la limpieza:", error);
    process.exit(1);
  }

  // Mostrar conteos después
  console.log("4. Conteos DESPUÉS de la limpieza:");
  console.log("   -------------------------------");
  
  const countsAfter = await Promise.all([
    prisma.cambioDivisa.count().then(c => ({ tabla: "CambioDivisa", count: c })),
    prisma.transferencia.count().then(c => ({ tabla: "Transferencia", count: c })),
    prisma.movimientoSaldo.count().then(c => ({ tabla: "MovimientoSaldo", count: c })),
    prisma.saldo.count().then(c => ({ tabla: "Saldo", count: c })),
    prisma.servientregaGuia.count().then(c => ({ tabla: "ServientregaGuia", count: c })),
    prisma.servicioExternoMovimiento.count().then(c => ({ tabla: "ServicioExternoMovimiento", count: c })),
    prisma.recibo.count().then(c => ({ tabla: "Recibo", count: c })),
    prisma.cuadreCaja.count().then(c => ({ tabla: "CuadreCaja", count: c })),
    prisma.usuario.count().then(c => ({ tabla: "Usuario (PRESERVADO)", count: c })),
    prisma.puntoAtencion.count().then(c => ({ tabla: "PuntoAtencion (PRESERVADO)", count: c })),
    prisma.jornada.count().then(c => ({ tabla: "Jornada (PRESERVADO)", count: c })),
    prisma.moneda.count().then(c => ({ tabla: "Moneda (PRESERVADO)", count: c })),
  ]);

  countsAfter.forEach(({ tabla, count }) => {
    const icon = tabla.includes("PRESERVADO") ? "✅" : (count === 0 ? "✓" : "⚠️");
    console.log(`   ${icon} ${tabla.padEnd(35)} ${count.toString().padStart(5)} registros`);
  });

  console.log("\n================================================");
  console.log("🎉 LIMPIEZA COMPLETADA");
  console.log("================================================");
  console.log("\nEstructura base preservada:");
  console.log("  ✅ Usuarios");
  console.log("  ✅ Puntos de Atención");
  console.log("  ✅ Jornadas");
  console.log("  ✅ Monedas");
  console.log("\nListo para comenzar operaciones limpias! 🚀");
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
