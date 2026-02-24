#!/usr/bin/env node
/**
 * Script para ejecutar la limpieza completa de la base de datos
 * Preserva: Usuarios, Puntos, Jornadas, Monedas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    console.log("   Eliminando MovimientoContable...");
    await prisma.movimientoContable.deleteMany({});
    
    console.log("   Eliminando MovimientoSaldo...");
    await prisma.movimientoSaldo.deleteMany({});
    
    console.log("   Eliminando HistorialSaldo...");
    await prisma.historialSaldo.deleteMany({});
    
    console.log("   Eliminando CuadreCajaDetalle...");
    await prisma.cuadreCajaDetalle.deleteMany({});
    
    console.log("   Eliminando CuadreCaja...");
    await prisma.cuadreCaja.deleteMany({});
    
    console.log("   Eliminando SaldoInicial...");
    await prisma.saldoInicial.deleteMany({});
    
    console.log("   Eliminando Recibo...");
    await prisma.recibo.deleteMany({});
    
    console.log("   Eliminando ServientregaGuia...");
    await prisma.servientregaGuia.deleteMany({});
    
    console.log("   Eliminando ServientregaDestinatario...");
    await prisma.servientregaDestinatario.deleteMany({});
    
    console.log("   Eliminando ServientregaRemitente...");
    await prisma.servientregaRemitente.deleteMany({});
    
    console.log("   Eliminando ServicioExternoMovimiento...");
    await prisma.servicioExternoMovimiento.deleteMany({});
    
    console.log("   Eliminando ServicioExternoSaldo...");
    await prisma.servicioExternoSaldo.deleteMany({});
    
    console.log("   Eliminando CambioDivisa...");
    await prisma.cambioDivisa.deleteMany({});
    
    console.log("   Eliminando Transferencia...");
    await prisma.transferencia.deleteMany({});
    
    console.log("   Eliminando Saldo...");
    await prisma.saldo.deleteMany({});
    
    console.log("   Eliminando PermissionRequest...");
    await prisma.permissionRequest.deleteMany({});

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
