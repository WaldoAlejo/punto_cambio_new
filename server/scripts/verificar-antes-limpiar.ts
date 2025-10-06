import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verificarDatos() {
  console.log("🔍 VERIFICACIÓN DE DATOS ANTES DE LIMPIAR\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    console.log("📊 DATOS QUE SERÁN ELIMINADOS:\n");
    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const detalleCuadre = await prisma.detalleCuadreCaja.count();
    console.log(`   Detalles de cuadre:              ${detalleCuadre}`);

    const cuadres = await prisma.cuadreCaja.count();
    console.log(`   Cuadres de caja:                 ${cuadres}`);

    const detalleServicio = await prisma.servicioExternoDetalleCierre.count();
    console.log(`   Detalles cierre servicios:       ${detalleServicio}`);

    const cierresServicio = await prisma.servicioExternoCierreDiario.count();
    console.log(`   Cierres servicios externos:      ${cierresServicio}`);

    const cierres = await prisma.cierreDiario.count();
    console.log(`   Cierres diarios:                 ${cierres}`);

    const recibos = await prisma.recibo.count();
    console.log(`   Recibos:                         ${recibos}`);

    const cambios = await prisma.cambioDivisa.count();
    console.log(`   Cambios de divisa:               ${cambios}`);

    const transferencias = await prisma.transferencia.count();
    console.log(`   Transferencias:                  ${transferencias}`);

    const movimientos = await prisma.movimiento.count();
    console.log(`   Movimientos:                     ${movimientos}`);

    const movimientosSaldo = await prisma.movimientoSaldo.count();
    console.log(`   Movimientos de saldo:            ${movimientosSaldo}`);

    const historialSaldos = await prisma.historialSaldo.count();
    console.log(`   Historial de saldos:             ${historialSaldos}`);

    const solicitudes = await prisma.solicitudSaldo.count();
    console.log(`   Solicitudes de saldo:            ${solicitudes}`);

    const saldosIniciales = await prisma.saldoInicial.count();
    console.log(`   Saldos iniciales:                ${saldosIniciales}`);

    const saldos = await prisma.saldo.count();
    console.log(`   Saldos actuales:                 ${saldos}`);

    const salidas = await prisma.salidaEspontanea.count();
    console.log(`   Salidas espontáneas:             ${salidas}`);

    const permisos = await prisma.permiso.count();
    console.log(`   Permisos:                        ${permisos}`);

    const historialAsignaciones = await prisma.historialAsignacionPunto.count();
    console.log(`   Historial asignaciones:          ${historialAsignaciones}`);

    const guias = await prisma.servientregaGuia.count();
    console.log(`   Guías Servientrega:              ${guias}`);

    const remitentes = await prisma.servientregaRemitente.count();
    console.log(`   Remitentes Servientrega:         ${remitentes}`);

    const destinatarios = await prisma.servientregaDestinatario.count();
    console.log(`   Destinatarios Servientrega:      ${destinatarios}`);

    const saldosServientrega = await prisma.servientregaSaldo.count();
    console.log(`   Saldos Servientrega:             ${saldosServientrega}`);

    const historialServientrega =
      await prisma.servientregaHistorialSaldo.count();
    console.log(`   Historial Servientrega:          ${historialServientrega}`);

    const solicitudesServientrega =
      await prisma.servientregaSolicitudSaldo.count();
    console.log(
      `   Solicitudes Servientrega:        ${solicitudesServientrega}`
    );

    const anulaciones = await prisma.servientregaSolicitudAnulacion.count();
    console.log(`   Anulaciones Servientrega:        ${anulaciones}`);

    const movimientosServicio = await prisma.servicioExternoMovimiento.count();
    console.log(`   Movimientos servicios externos:  ${movimientosServicio}`);

    const saldosServicio = await prisma.servicioExternoSaldo.count();
    console.log(`   Saldos servicios externos:       ${saldosServicio}`);

    const asignacionesServicio = await prisma.servicioExternoAsignacion.count();
    console.log(`   Asignaciones servicios externos: ${asignacionesServicio}`);

    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const total =
      detalleCuadre +
      cuadres +
      detalleServicio +
      cierresServicio +
      cierres +
      recibos +
      cambios +
      transferencias +
      movimientos +
      movimientosSaldo +
      historialSaldos +
      solicitudes +
      saldosIniciales +
      saldos +
      salidas +
      permisos +
      historialAsignaciones +
      guias +
      remitentes +
      destinatarios +
      saldosServientrega +
      historialServientrega +
      solicitudesServientrega +
      anulaciones +
      movimientosServicio +
      saldosServicio +
      asignacionesServicio;

    console.log(`   TOTAL A ELIMINAR:                ${total}`);
    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("✅ DATOS QUE SE MANTENDRÁN:\n");
    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const usuarios = await prisma.usuario.count();
    console.log(`   👥 Usuarios:          ${usuarios}`);

    const puntos = await prisma.puntoAtencion.count();
    console.log(`   📍 Puntos atención:   ${puntos}`);

    const monedas = await prisma.moneda.count();
    console.log(`   💱 Monedas:           ${monedas}`);

    const jornadas = await prisma.jornada.count();
    console.log(`   📅 Jornadas:          ${jornadas}`);

    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("⚠️  ADVERTENCIA:");
    console.log("   Esta operación NO se puede deshacer.");
    console.log(
      "   Se recomienda hacer un backup de la base de datos antes de continuar.\n"
    );

    console.log("📝 Para ejecutar la limpieza, ejecuta:");
    console.log("   npm run script:limpiar-transacciones\n");
  } catch (error) {
    console.error("❌ Error durante la verificación:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
verificarDatos()
  .then(() => {
    console.log("✅ Verificación completada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  });
