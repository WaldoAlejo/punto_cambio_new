import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface CleanupOptions {
  createBackup: boolean;
  deleteSalidaEspontanea: boolean;
  deleteSaldoInicial: boolean;
  resetJornadas: boolean;
}

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function createDatabaseBackup(): Promise<string> {
  console.log("\n📦 Creando backup de la base de datos...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `backup-${timestamp}.sql`;
  const backupPath = path.join(process.cwd(), "backups", backupFile);

  // Crear directorio si no existe
  if (!fs.existsSync(path.join(process.cwd(), "backups"))) {
    fs.mkdirSync(path.join(process.cwd(), "backups"), { recursive: true });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL no está definida");
    }

    // Extraer credenciales de DATABASE_URL
    // Formato esperado: postgresql://user:password@host:port/database
    const urlObj = new URL(dbUrl);
    const user = urlObj.username;
    const password = urlObj.password;
    const host = urlObj.hostname;
    const port = urlObj.port || "5432";
    const database = urlObj.pathname.replace("/", "");

    // Usar pg_dump si está disponible
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} ${database} > "${backupPath}"`;

    await execAsync(command, { shell: "/bin/bash" });

    console.log(`✅ Backup creado: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.warn(
      "⚠️  No se pudo crear backup automático. Asegúrate de tener pg_dump instalado."
    );
    console.warn("   En macOS: brew install postgresql");
    return "";
  }
}

async function cleanDatabase(options: CleanupOptions) {
  console.log("\n🔄 Iniciando limpieza de la base de datos...\n");

  try {
    // Contar registros antes de limpiar
    const stats = {
      cambiosDivisa: await prisma.cambioDivisa.count(),
      transferencias: await prisma.transferencia.count(),
      movimientoSaldo: await prisma.movimientoSaldo.count(),
      recibos: await prisma.recibo.count(),
      cuadreCaja: await prisma.cuadreCaja.count(),
      cierreDiario: await prisma.cierreDiario.count(),
      salidaEspontanea: await prisma.salidaEspontanea.count(),
      saldoInicial: await prisma.saldoInicial.count(),
    };

    console.log("📊 Conteo de registros a eliminar:");
    console.log(`  - CambioDivisa: ${stats.cambiosDivisa}`);
    console.log(`  - Transferencias: ${stats.transferencias}`);
    console.log(`  - MovimientoSaldo: ${stats.movimientoSaldo}`);
    console.log(`  - Recibos: ${stats.recibos}`);
    console.log(`  - CuadreCaja: ${stats.cuadreCaja}`);
    console.log(`  - CierreDiario: ${stats.cierreDiario}`);
    if (options.deleteSalidaEspontanea) {
      console.log(`  - SalidaEspontanea: ${stats.salidaEspontanea}`);
    }
    if (options.deleteSaldoInicial) {
      console.log(`  - SaldoInicial: ${stats.saldoInicial}`);
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Eliminar Recibos
        console.log("\n🗑️  Eliminando Recibos...");
        const recibosDeleted = await tx.recibo.deleteMany({});
        console.log(`   ✓ ${recibosDeleted.count} registros eliminados`);

        // 2. Eliminar CambioDivisa
        console.log("🗑️  Eliminando CambiosDivisa...");
        const cambiosDeleted = await tx.cambioDivisa.deleteMany({});
        console.log(`   ✓ ${cambiosDeleted.count} registros eliminados`);

        // 3. Eliminar detalles de cuadre y cuadres de caja
        console.log("🗑️  Eliminando DetalleCuadreCaja...");
        const detalleCuadreDeleted = await tx.detalleCuadreCaja.deleteMany({});
        console.log(`   ✓ ${detalleCuadreDeleted.count} registros eliminados`);

        console.log("🗑️  Eliminando CuadreCaja...");
        const cuadreDeleted = await tx.cuadreCaja.deleteMany({});
        console.log(`   ✓ ${cuadreDeleted.count} registros eliminados`);

        // 4. Eliminar detalles de cierre de servicios externos
        console.log("🗑️  Eliminando ServicioExternoDetalleCierre...");
        const detalleCierreDeleted =
          await tx.servicioExternoDetalleCierre.deleteMany({});
        console.log(`   ✓ ${detalleCierreDeleted.count} registros eliminados`);

        // 5. Eliminar cierres diarios de servicios externos
        console.log("🗑️  Eliminando ServicioExternoCierreDiario...");
        const cierreSEDeleted = await tx.servicioExternoCierreDiario.deleteMany(
          {}
        );
        console.log(`   ✓ ${cierreSEDeleted.count} registros eliminados`);

        // 6. Eliminar cierres diarios
        console.log("🗑️  Eliminando CierreDiario...");
        const cierreDeleted = await tx.cierreDiario.deleteMany({});
        console.log(`   ✓ ${cierreDeleted.count} registros eliminados`);

        // 7. Eliminar Transferencias
        console.log("🗑️  Eliminando Transferencias...");
        const transferenciasDeleted = await tx.transferencia.deleteMany({});
        console.log(`   ✓ ${transferenciasDeleted.count} registros eliminados`);

        // 8. Eliminar movimientos de servicios externos
        console.log("🗑️  Eliminando ServicioExternoMovimiento...");
        const movimientoSEDeleted =
          await tx.servicioExternoMovimiento.deleteMany({});
        console.log(`   ✓ ${movimientoSEDeleted.count} registros eliminados`);

        // 9. Eliminar MovimientoSaldo
        console.log("🗑️  Eliminando MovimientoSaldo...");
        const movimientoSaldoDeleted = await tx.movimientoSaldo.deleteMany({});
        console.log(
          `   ✓ ${movimientoSaldoDeleted.count} registros eliminados`
        );

        // 10. Eliminar HistorialSaldo
        console.log("🗑️  Eliminando HistorialSaldo...");
        const historialDeleted = await tx.historialSaldo.deleteMany({});
        console.log(`   ✓ ${historialDeleted.count} registros eliminados`);

        // 11. Eliminar Movimiento
        console.log("🗑️  Eliminando Movimientos...");
        const movimientosDeleted = await tx.movimiento.deleteMany({});
        console.log(`   ✓ ${movimientosDeleted.count} registros eliminados`);

        // 12. Eliminar SolicitudSaldo
        console.log("🗑️  Eliminando SolicitudSaldo...");
        const solicitudesDeleted = await tx.solicitudSaldo.deleteMany({});
        console.log(`   ✓ ${solicitudesDeleted.count} registros eliminados`);

        // 13. Eliminar asignaciones de servicios externos
        console.log("🗑️  Eliminando ServicioExternoAsignacion...");
        const asignacionesDeleted =
          await tx.servicioExternoAsignacion.deleteMany({});
        console.log(`   ✓ ${asignacionesDeleted.count} registros eliminados`);

        // 14. Eliminar historial de asignaciones de puntos
        console.log("🗑️  Eliminando HistorialAsignacionPunto...");
        const historialAsignacionDeleted =
          await tx.historialAsignacionPunto.deleteMany({});
        console.log(
          `   ✓ ${historialAsignacionDeleted.count} registros eliminados`
        );

        // 14.1 Eliminar historial de saldos de servientrega
        console.log("🗑️  Eliminando ServientregaHistorialSaldo...");
        const servientregaHistorialDeleted =
          await tx.servientregaHistorialSaldo.deleteMany({});
        console.log(
          `   ✓ ${servientregaHistorialDeleted.count} registros eliminados`
        );

        // 14.2 Eliminar solicitudes de saldo de servientrega
        console.log("🗑️  Eliminando ServientregaSolicitudSaldo...");
        const servientregaSolicitudDeleted =
          await tx.servientregaSolicitudSaldo.deleteMany({});
        console.log(
          `   ✓ ${servientregaSolicitudDeleted.count} registros eliminados`
        );

        // 15. Eliminar Permisos
        console.log("🗑️  Eliminando Permisos...");
        const permisosDeleted = await tx.permiso.deleteMany({});
        console.log(`   ✓ ${permisosDeleted.count} registros eliminados`);

        // 16. Eliminar SalidaEspontanea (opcional)
        if (options.deleteSalidaEspontanea) {
          console.log("🗑️  Eliminando SalidaEspontanea...");
          const salidasDeleted = await tx.salidaEspontanea.deleteMany({});
          console.log(`   ✓ ${salidasDeleted.count} registros eliminados`);
        }

        // 17. Eliminar SaldoInicial (opcional)
        if (options.deleteSaldoInicial) {
          console.log("🗑️  Eliminando SaldoInicial...");
          const saldoInicialDeleted = await tx.saldoInicial.deleteMany({});
          console.log(`   ✓ ${saldoInicialDeleted.count} registros eliminados`);
        }

        // 18. Resetear Saldos a 0
        console.log("\n💰 Reseteando Saldos a 0...");
        const saldosReseteados = await tx.saldo.updateMany({
          data: {
            cantidad: 0,
            billetes: 0,
            monedas_fisicas: 0,
            bancos: 0,
          },
        });
        console.log(`   ✓ ${saldosReseteados.count} saldos reseteados`);

        // 19. Resetear ServicioExternoSaldo a 0
        console.log("💰 Reseteando ServicioExternoSaldo a 0...");
        const servicioExternoSaldoReseteado =
          await tx.servicioExternoSaldo.updateMany({
            data: {
              cantidad: 0,
            },
          });
        console.log(
          `   ✓ ${servicioExternoSaldoReseteado.count} saldos externos reseteados`
        );

        // 20. Resetear ServientregaSaldo
        console.log("💰 Reseteando ServientregaSaldo a 0...");
        const servientregaSaldoReseteado =
          await tx.servientregaSaldo.updateMany({
            data: {
              monto_total: 0,
              monto_usado: 0,
            },
          });
        console.log(
          `   ✓ ${servientregaSaldoReseteado.count} saldos servientrega reseteados`
        );

        // 21. Opcionalmente resetear Jornadas
        if (options.resetJornadas) {
          console.log("🗑️  Eliminando Jornadas antiguas...");
          const jornadasDeleted = await tx.jornada.deleteMany({});
          console.log(`   ✓ ${jornadasDeleted.count} jornadas eliminadas`);
        }
      },
      {
        timeout: 30000, // 30 segundos para dar tiempo a todas las operaciones
      }
    );

    console.log("\n✅ ¡LIMPIEZA COMPLETADA EXITOSAMENTE!");
    console.log("   Base de datos lista para nuevas transacciones\n");
    console.log("📋 Entidades MANTENIDAS:");
    console.log("  ✓ Usuarios");
    console.log("  ✓ Puntos de Atención");
    console.log("  ✓ Monedas");
    if (!options.resetJornadas) {
      console.log("  ✓ Jornadas");
    }
    console.log("\n📊 Entidades LIMPIADAS:");
    console.log("  ✓ CambioDivisa");
    console.log("  ✓ Transferencias");
    console.log("  ✓ MovimientoSaldo");
    console.log("  ✓ HistorialSaldo");
    console.log("  ✓ Movimientos");
    console.log("  ✓ Recibos");
    console.log("  ✓ CuadreCaja");
    console.log("  ✓ CierreDiario");
    console.log("  ✓ SolicitudSaldo");
    console.log("  ✓ ServientregaHistorialSaldo");
    console.log("  ✓ ServientregaSolicitudSaldo");
    if (options.deleteSalidaEspontanea) {
      console.log("  ✓ SalidaEspontanea");
    }
    if (options.deleteSaldoInicial) {
      console.log("  ✓ SaldoInicial");
    }
    console.log("  ✓ Saldos (reseteados a 0)");
    console.log("  ✓ ServicioExternoSaldo (reseteados a 0)");
    console.log(
      "  ✓ ServientregaSaldo (monto_total y monto_usado reseteados a 0)"
    );
  } catch (error) {
    console.error("\n❌ Error durante la limpieza:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║       SCRIPT DE LIMPIEZA DE BASE DE DATOS - PUNTO CAMBIO   ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  console.log(
    "⚠️  ADVERTENCIA: Este script eliminará todas las transacciones y movimientos."
  );
  console.log(
    "   Se mantendrán: Usuarios, Puntos de Atención, Monedas y Jornadas.\n"
  );

  // Preguntar opciones
  const createBackup = await askQuestion(
    "¿Deseas crear un backup antes de limpiar? (s/n): "
  );
  let backupPath = "";

  if (createBackup === "s" || createBackup === "y") {
    backupPath = await createDatabaseBackup();
  }

  const deleteSalidaEspontanea = await askQuestion(
    "¿Deseas eliminar también las SalidaEspontanea? (s/n): "
  );
  const deleteSaldoInicial = await askQuestion(
    "¿Deseas eliminar también los SaldoInicial? (s/n): "
  );
  const resetJornadas = await askQuestion(
    "¿Deseas resetear también las Jornadas? (s/n): "
  );

  const confirm = await askQuestion(
    "\n⚠️  ¿Estás SEGURO? Esto no se puede deshacer. (escribe 'SI' para confirmar): "
  );

  if (confirm !== "si" && confirm !== "sí") {
    console.log("\n❌ Operación cancelada.");
    process.exit(0);
  }

  const options: CleanupOptions = {
    createBackup: createBackup === "s" || createBackup === "y",
    deleteSalidaEspontanea:
      deleteSalidaEspontanea === "s" || deleteSalidaEspontanea === "y",
    deleteSaldoInicial:
      deleteSaldoInicial === "s" || deleteSaldoInicial === "y",
    resetJornadas: resetJornadas === "s" || resetJornadas === "y",
  };

  await cleanDatabase(options);

  if (backupPath) {
    console.log(`\n💾 Backup guardado en: ${backupPath}`);
  }
}

main().catch(console.error);
