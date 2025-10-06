import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function limpiarTransacciones() {
    console.log("🧹 Iniciando limpieza de datos de transacciones...\n");
    try {
        // Orden de eliminación respetando las relaciones de foreign keys
        console.log("📋 Eliminando detalles de cuadre de caja...");
        const detalleCuadre = await prisma.detalleCuadreCaja.deleteMany({});
        console.log(`   ✓ ${detalleCuadre.count} registros eliminados\n`);
        console.log("📋 Eliminando cuadres de caja...");
        const cuadres = await prisma.cuadreCaja.deleteMany({});
        console.log(`   ✓ ${cuadres.count} registros eliminados\n`);
        console.log("📋 Eliminando detalles de cierre de servicios externos...");
        const detalleServicio = await prisma.servicioExternoDetalleCierre.deleteMany({});
        console.log(`   ✓ ${detalleServicio.count} registros eliminados\n`);
        console.log("📋 Eliminando cierres diarios de servicios externos...");
        const cierresServicio = await prisma.servicioExternoCierreDiario.deleteMany({});
        console.log(`   ✓ ${cierresServicio.count} registros eliminados\n`);
        console.log("📋 Eliminando cierres diarios...");
        const cierres = await prisma.cierreDiario.deleteMany({});
        console.log(`   ✓ ${cierres.count} registros eliminados\n`);
        console.log("📋 Eliminando recibos...");
        const recibos = await prisma.recibo.deleteMany({});
        console.log(`   ✓ ${recibos.count} registros eliminados\n`);
        console.log("📋 Eliminando cambios de divisa...");
        const cambios = await prisma.cambioDivisa.deleteMany({});
        console.log(`   ✓ ${cambios.count} registros eliminados\n`);
        console.log("📋 Eliminando transferencias...");
        const transferencias = await prisma.transferencia.deleteMany({});
        console.log(`   ✓ ${transferencias.count} registros eliminados\n`);
        console.log("📋 Eliminando movimientos...");
        const movimientos = await prisma.movimiento.deleteMany({});
        console.log(`   ✓ ${movimientos.count} registros eliminados\n`);
        console.log("📋 Eliminando movimientos de saldo...");
        const movimientosSaldo = await prisma.movimientoSaldo.deleteMany({});
        console.log(`   ✓ ${movimientosSaldo.count} registros eliminados\n`);
        console.log("📋 Eliminando historial de saldos...");
        const historialSaldos = await prisma.historialSaldo.deleteMany({});
        console.log(`   ✓ ${historialSaldos.count} registros eliminados\n`);
        console.log("📋 Eliminando solicitudes de saldo...");
        const solicitudes = await prisma.solicitudSaldo.deleteMany({});
        console.log(`   ✓ ${solicitudes.count} registros eliminados\n`);
        console.log("📋 Eliminando saldos iniciales...");
        const saldosIniciales = await prisma.saldoInicial.deleteMany({});
        console.log(`   ✓ ${saldosIniciales.count} registros eliminados\n`);
        console.log("📋 Eliminando saldos actuales...");
        const saldos = await prisma.saldo.deleteMany({});
        console.log(`   ✓ ${saldos.count} registros eliminados\n`);
        console.log("📋 Eliminando salidas espontáneas...");
        const salidas = await prisma.salidaEspontanea.deleteMany({});
        console.log(`   ✓ ${salidas.count} registros eliminados\n`);
        console.log("📋 Eliminando permisos...");
        const permisos = await prisma.permiso.deleteMany({});
        console.log(`   ✓ ${permisos.count} registros eliminados\n`);
        console.log("📋 Eliminando historial de asignación de puntos...");
        const historialAsignaciones = await prisma.historialAsignacionPunto.deleteMany({});
        console.log(`   ✓ ${historialAsignaciones.count} registros eliminados\n`);
        console.log("📋 Eliminando guías de Servientrega...");
        const guias = await prisma.servientregaGuia.deleteMany({});
        console.log(`   ✓ ${guias.count} registros eliminados\n`);
        console.log("📋 Eliminando remitentes de Servientrega...");
        const remitentes = await prisma.servientregaRemitente.deleteMany({});
        console.log(`   ✓ ${remitentes.count} registros eliminados\n`);
        console.log("📋 Eliminando destinatarios de Servientrega...");
        const destinatarios = await prisma.servientregaDestinatario.deleteMany({});
        console.log(`   ✓ ${destinatarios.count} registros eliminados\n`);
        console.log("📋 Eliminando saldos de Servientrega...");
        const saldosServientrega = await prisma.servientregaSaldo.deleteMany({});
        console.log(`   ✓ ${saldosServientrega.count} registros eliminados\n`);
        console.log("📋 Eliminando historial de saldos de Servientrega...");
        const historialServientrega = await prisma.servientregaHistorialSaldo.deleteMany({});
        console.log(`   ✓ ${historialServientrega.count} registros eliminados\n`);
        console.log("📋 Eliminando solicitudes de saldo de Servientrega...");
        const solicitudesServientrega = await prisma.servientregaSolicitudSaldo.deleteMany({});
        console.log(`   ✓ ${solicitudesServientrega.count} registros eliminados\n`);
        console.log("📋 Eliminando solicitudes de anulación de Servientrega...");
        const anulaciones = await prisma.servientregaSolicitudAnulacion.deleteMany({});
        console.log(`   ✓ ${anulaciones.count} registros eliminados\n`);
        console.log("📋 Eliminando movimientos de servicios externos...");
        const movimientosServicio = await prisma.servicioExternoMovimiento.deleteMany({});
        console.log(`   ✓ ${movimientosServicio.count} registros eliminados\n`);
        console.log("📋 Eliminando saldos de servicios externos...");
        const saldosServicio = await prisma.servicioExternoSaldo.deleteMany({});
        console.log(`   ✓ ${saldosServicio.count} registros eliminados\n`);
        console.log("📋 Eliminando asignaciones de servicios externos...");
        const asignacionesServicio = await prisma.servicioExternoAsignacion.deleteMany({});
        console.log(`   ✓ ${asignacionesServicio.count} registros eliminados\n`);
        console.log("✅ Limpieza completada exitosamente!\n");
        console.log("📊 Resumen:");
        console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`   Detalles de cuadre:              ${detalleCuadre.count}`);
        console.log(`   Cuadres de caja:                 ${cuadres.count}`);
        console.log(`   Detalles cierre servicios:       ${detalleServicio.count}`);
        console.log(`   Cierres servicios externos:      ${cierresServicio.count}`);
        console.log(`   Cierres diarios:                 ${cierres.count}`);
        console.log(`   Recibos:                         ${recibos.count}`);
        console.log(`   Cambios de divisa:               ${cambios.count}`);
        console.log(`   Transferencias:                  ${transferencias.count}`);
        console.log(`   Movimientos:                     ${movimientos.count}`);
        console.log(`   Movimientos de saldo:            ${movimientosSaldo.count}`);
        console.log(`   Historial de saldos:             ${historialSaldos.count}`);
        console.log(`   Solicitudes de saldo:            ${solicitudes.count}`);
        console.log(`   Saldos iniciales:                ${saldosIniciales.count}`);
        console.log(`   Saldos actuales:                 ${saldos.count}`);
        console.log(`   Salidas espontáneas:             ${salidas.count}`);
        console.log(`   Permisos:                        ${permisos.count}`);
        console.log(`   Historial asignaciones:          ${historialAsignaciones.count}`);
        console.log(`   Guías Servientrega:              ${guias.count}`);
        console.log(`   Remitentes Servientrega:         ${remitentes.count}`);
        console.log(`   Destinatarios Servientrega:      ${destinatarios.count}`);
        console.log(`   Saldos Servientrega:             ${saldosServientrega.count}`);
        console.log(`   Historial Servientrega:          ${historialServientrega.count}`);
        console.log(`   Solicitudes Servientrega:        ${solicitudesServientrega.count}`);
        console.log(`   Anulaciones Servientrega:        ${anulaciones.count}`);
        console.log(`   Movimientos servicios externos:  ${movimientosServicio.count}`);
        console.log(`   Saldos servicios externos:       ${saldosServicio.count}`);
        console.log(`   Asignaciones servicios externos: ${asignacionesServicio.count}`);
        console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        const total = detalleCuadre.count +
            cuadres.count +
            detalleServicio.count +
            cierresServicio.count +
            cierres.count +
            recibos.count +
            cambios.count +
            transferencias.count +
            movimientos.count +
            movimientosSaldo.count +
            historialSaldos.count +
            solicitudes.count +
            saldosIniciales.count +
            saldos.count +
            salidas.count +
            permisos.count +
            historialAsignaciones.count +
            guias.count +
            remitentes.count +
            destinatarios.count +
            saldosServientrega.count +
            historialServientrega.count +
            solicitudesServientrega.count +
            anulaciones.count +
            movimientosServicio.count +
            saldosServicio.count +
            asignacionesServicio.count;
        console.log(`   TOTAL REGISTROS ELIMINADOS:      ${total}`);
        console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        console.log("✨ Datos preservados:");
        const usuarios = await prisma.usuario.count();
        const puntos = await prisma.puntoAtencion.count();
        const monedas = await prisma.moneda.count();
        const jornadas = await prisma.jornada.count();
        console.log(`   👥 Usuarios:          ${usuarios}`);
        console.log(`   📍 Puntos atención:   ${puntos}`);
        console.log(`   💱 Monedas:           ${monedas}`);
        console.log(`   📅 Jornadas:          ${jornadas}\n`);
    }
    catch (error) {
        console.error("❌ Error durante la limpieza:", error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Ejecutar el script
limpiarTransacciones()
    .then(() => {
    console.log("🎉 Script finalizado correctamente");
    process.exit(0);
})
    .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
});
