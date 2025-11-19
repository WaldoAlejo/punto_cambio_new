import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log("🔄 Iniciando limpieza de la base de datos...\n");

  try {
    // Usar transacción para asegurar que todo se ejecute atomicamente
    // Aumentar timeout a 30 segundos por la cantidad de operaciones
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar Recibos (sin dependencias directas que importen)
      console.log("🗑️  Eliminando Recibos...");
      await tx.recibo.deleteMany({});

      // 2. Eliminar CambioDivisa (transacciones de cambio)
      console.log("🗑️  Eliminando CambiosDivisa...");
      await tx.cambioDivisa.deleteMany({});

      // 3. Eliminar detalles de cuadre y cuadres de caja
      console.log("🗑️  Eliminando DetalleCuadreCaja...");
      await tx.detalleCuadreCaja.deleteMany({});

      console.log("🗑️  Eliminando CuadreCaja...");
      await tx.cuadreCaja.deleteMany({});

      // 4. Eliminar detalles de cierre de servicios externos
      console.log("🗑️  Eliminando ServicioExternoDetalleCierre...");
      await tx.servicioExternoDetalleCierre.deleteMany({});

      // 5. Eliminar cierres diarios de servicios externos
      console.log("🗑️  Eliminando ServicioExternoCierreDiario...");
      await tx.servicioExternoCierreDiario.deleteMany({});

      // 6. Eliminar cierres diarios
      console.log("🗑️  Eliminando CierreDiario...");
      await tx.cierreDiario.deleteMany({});

      // 7. Eliminar Transferencias
      console.log("🗑️  Eliminando Transferencias...");
      await tx.transferencia.deleteMany({});

      // 8. Eliminar movimientos de servicios externos
      console.log("🗑️  Eliminando ServicioExternoMovimiento...");
      await tx.servicioExternoMovimiento.deleteMany({});

      // 9. Eliminar MovimientoSaldo
      console.log("🗑️  Eliminando MovimientoSaldo...");
      await tx.movimientoSaldo.deleteMany({});

      // 10. Eliminar HistorialSaldo
      console.log("🗑️  Eliminando HistorialSaldo...");
      await tx.historialSaldo.deleteMany({});

      // 11. Eliminar Movimiento
      console.log("🗑️  Eliminando Movimientos...");
      await tx.movimiento.deleteMany({});

      // 12. Eliminar SolicitudSaldo
      console.log("🗑️  Eliminando SolicitudSaldo...");
      await tx.solicitudSaldo.deleteMany({});

      // 13. Eliminar asignaciones de servicios externos
      console.log("🗑️  Eliminando ServicioExternoAsignacion...");
      await tx.servicioExternoAsignacion.deleteMany({});

      // 14. Eliminar historial de asignaciones de puntos
      console.log("🗑️  Eliminando HistorialAsignacionPunto...");
      await tx.historialAsignacionPunto.deleteMany({});

      // 15. Eliminar Permisos
      console.log("🗑️  Eliminando Permisos...");
      await tx.permiso.deleteMany({});

      // 16. Eliminar Salidas Espontáneas (OPCIONAL - si quieres mantenerlas, comenta esta línea)
      console.log("🗑️  Eliminando SalidaEspontanea...");
      await tx.salidaEspontanea.deleteMany({});

      // 17. Eliminar SaldoInicial (para evitar inconsistencias después de la limpieza)
      console.log("🗑️  Eliminando SaldoInicial...");
      await tx.saldoInicial.deleteMany({});

      // 18. Resetear Saldos a 0
      console.log("💰 Reseteando Saldos a 0...");
      await tx.saldo.updateMany({
        data: {
          cantidad: 0,
          billetes: 0,
          monedas_fisicas: 0,
          bancos: 0,
        },
      });

      // 19. Resetear ServicioExternoSaldo a 0
      console.log("💰 Reseteando ServicioExternoSaldo a 0...");
      await tx.servicioExternoSaldo.updateMany({
        data: {
          cantidad: 0,
        },
      });

      // 20. Resetear ServientregaSaldo a 0
      console.log("💰 Reseteando ServientregaSaldo a 0...");
      await tx.servientregaSaldo.updateMany({
        data: {
          monto_usado: 0,
        },
      });

      console.log(
        "\n✅ LIMPIEZA COMPLETADA - Base de datos lista para nuevas transacciones\n"
      );
      console.log("📋 Entidades MANTENIDAS:");
      console.log("  - Usuarios ✓");
      console.log("  - Puntos de Atención ✓");
      console.log("  - Monedas ✓");
      console.log("  - Jornadas ✓");
      console.log("\n📊 Entidades ELIMINADAS/RESETEADAS:");
      console.log("  - CambioDivisa ✓");
      console.log("  - Transferencias ✓");
      console.log("  - MovimientoSaldo ✓");
      console.log("  - HistorialSaldo ✓");
      console.log("  - Movimientos ✓");
      console.log("  - Recibos ✓");
      console.log("  - CuadreCaja ✓");
      console.log("  - CierreDiario ✓");
      console.log("  - SolicitudSaldo ✓");
      console.log("  - SalidaEspontanea ✓");
      console.log("  - SaldoInicial (eliminados) ✓");
      console.log("  - Saldos (reseteados a 0) ✓");
      console.log("  - ServicioExternoSaldo (reseteados a 0) ✓");
    }, {
      maxWait: 30000, // 30 segundos
      timeout: 30000, // 30 segundos
    });
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
cleanDatabase();
