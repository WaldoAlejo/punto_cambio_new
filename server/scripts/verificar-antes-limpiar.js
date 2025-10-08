"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function verificarDatos() {
    return __awaiter(this, void 0, void 0, function () {
        var detalleCuadre, cuadres, detalleServicio, cierresServicio, cierres, recibos, cambios, transferencias, movimientos, movimientosSaldo, historialSaldos, solicitudes, saldosIniciales, saldos, salidas, permisos, historialAsignaciones, guias, remitentes, destinatarios, saldosServientrega, historialServientrega, solicitudesServientrega, anulaciones, movimientosServicio, saldosServicio, asignacionesServicio, total, usuarios, puntos, monedas, jornadas, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🔍 VERIFICACIÓN DE DATOS ANTES DE LIMPIAR\n");
                    console.log("═══════════════════════════════════════════════════════════\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 33, 34, 36]);
                    console.log("📊 DATOS QUE SERÁN ELIMINADOS:\n");
                    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    return [4 /*yield*/, prisma.detalleCuadreCaja.count()];
                case 2:
                    detalleCuadre = _a.sent();
                    console.log("   Detalles de cuadre:              ".concat(detalleCuadre));
                    return [4 /*yield*/, prisma.cuadreCaja.count()];
                case 3:
                    cuadres = _a.sent();
                    console.log("   Cuadres de caja:                 ".concat(cuadres));
                    return [4 /*yield*/, prisma.servicioExternoDetalleCierre.count()];
                case 4:
                    detalleServicio = _a.sent();
                    console.log("   Detalles cierre servicios:       ".concat(detalleServicio));
                    return [4 /*yield*/, prisma.servicioExternoCierreDiario.count()];
                case 5:
                    cierresServicio = _a.sent();
                    console.log("   Cierres servicios externos:      ".concat(cierresServicio));
                    return [4 /*yield*/, prisma.cierreDiario.count()];
                case 6:
                    cierres = _a.sent();
                    console.log("   Cierres diarios:                 ".concat(cierres));
                    return [4 /*yield*/, prisma.recibo.count()];
                case 7:
                    recibos = _a.sent();
                    console.log("   Recibos:                         ".concat(recibos));
                    return [4 /*yield*/, prisma.cambioDivisa.count()];
                case 8:
                    cambios = _a.sent();
                    console.log("   Cambios de divisa:               ".concat(cambios));
                    return [4 /*yield*/, prisma.transferencia.count()];
                case 9:
                    transferencias = _a.sent();
                    console.log("   Transferencias:                  ".concat(transferencias));
                    return [4 /*yield*/, prisma.movimiento.count()];
                case 10:
                    movimientos = _a.sent();
                    console.log("   Movimientos:                     ".concat(movimientos));
                    return [4 /*yield*/, prisma.movimientoSaldo.count()];
                case 11:
                    movimientosSaldo = _a.sent();
                    console.log("   Movimientos de saldo:            ".concat(movimientosSaldo));
                    return [4 /*yield*/, prisma.historialSaldo.count()];
                case 12:
                    historialSaldos = _a.sent();
                    console.log("   Historial de saldos:             ".concat(historialSaldos));
                    return [4 /*yield*/, prisma.solicitudSaldo.count()];
                case 13:
                    solicitudes = _a.sent();
                    console.log("   Solicitudes de saldo:            ".concat(solicitudes));
                    return [4 /*yield*/, prisma.saldoInicial.count()];
                case 14:
                    saldosIniciales = _a.sent();
                    console.log("   Saldos iniciales:                ".concat(saldosIniciales));
                    return [4 /*yield*/, prisma.saldo.count()];
                case 15:
                    saldos = _a.sent();
                    console.log("   Saldos actuales:                 ".concat(saldos));
                    return [4 /*yield*/, prisma.salidaEspontanea.count()];
                case 16:
                    salidas = _a.sent();
                    console.log("   Salidas espont\u00E1neas:             ".concat(salidas));
                    return [4 /*yield*/, prisma.permiso.count()];
                case 17:
                    permisos = _a.sent();
                    console.log("   Permisos:                        ".concat(permisos));
                    return [4 /*yield*/, prisma.historialAsignacionPunto.count()];
                case 18:
                    historialAsignaciones = _a.sent();
                    console.log("   Historial asignaciones:          ".concat(historialAsignaciones));
                    return [4 /*yield*/, prisma.servientregaGuia.count()];
                case 19:
                    guias = _a.sent();
                    console.log("   Gu\u00EDas Servientrega:              ".concat(guias));
                    return [4 /*yield*/, prisma.servientregaRemitente.count()];
                case 20:
                    remitentes = _a.sent();
                    console.log("   Remitentes Servientrega:         ".concat(remitentes));
                    return [4 /*yield*/, prisma.servientregaDestinatario.count()];
                case 21:
                    destinatarios = _a.sent();
                    console.log("   Destinatarios Servientrega:      ".concat(destinatarios));
                    return [4 /*yield*/, prisma.servientregaSaldo.count()];
                case 22:
                    saldosServientrega = _a.sent();
                    console.log("   Saldos Servientrega:             ".concat(saldosServientrega));
                    return [4 /*yield*/, prisma.servientregaHistorialSaldo.count()];
                case 23:
                    historialServientrega = _a.sent();
                    console.log("   Historial Servientrega:          ".concat(historialServientrega));
                    return [4 /*yield*/, prisma.servientregaSolicitudSaldo.count()];
                case 24:
                    solicitudesServientrega = _a.sent();
                    console.log("   Solicitudes Servientrega:        ".concat(solicitudesServientrega));
                    return [4 /*yield*/, prisma.servientregaSolicitudAnulacion.count()];
                case 25:
                    anulaciones = _a.sent();
                    console.log("   Anulaciones Servientrega:        ".concat(anulaciones));
                    return [4 /*yield*/, prisma.servicioExternoMovimiento.count()];
                case 26:
                    movimientosServicio = _a.sent();
                    console.log("   Movimientos servicios externos:  ".concat(movimientosServicio));
                    return [4 /*yield*/, prisma.servicioExternoSaldo.count()];
                case 27:
                    saldosServicio = _a.sent();
                    console.log("   Saldos servicios externos:       ".concat(saldosServicio));
                    return [4 /*yield*/, prisma.servicioExternoAsignacion.count()];
                case 28:
                    asignacionesServicio = _a.sent();
                    console.log("   Asignaciones servicios externos: ".concat(asignacionesServicio));
                    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    total = detalleCuadre +
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
                    console.log("   TOTAL A ELIMINAR:                ".concat(total));
                    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
                    console.log("✅ DATOS QUE SE MANTENDRÁN:\n");
                    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    return [4 /*yield*/, prisma.usuario.count()];
                case 29:
                    usuarios = _a.sent();
                    console.log("   \uD83D\uDC65 Usuarios:          ".concat(usuarios));
                    return [4 /*yield*/, prisma.puntoAtencion.count()];
                case 30:
                    puntos = _a.sent();
                    console.log("   \uD83D\uDCCD Puntos atenci\u00F3n:   ".concat(puntos));
                    return [4 /*yield*/, prisma.moneda.count()];
                case 31:
                    monedas = _a.sent();
                    console.log("   \uD83D\uDCB1 Monedas:           ".concat(monedas));
                    return [4 /*yield*/, prisma.jornada.count()];
                case 32:
                    jornadas = _a.sent();
                    console.log("   \uD83D\uDCC5 Jornadas:          ".concat(jornadas));
                    console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
                    console.log("⚠️  ADVERTENCIA:");
                    console.log("   Esta operación NO se puede deshacer.");
                    console.log("   Se recomienda hacer un backup de la base de datos antes de continuar.\n");
                    console.log("📝 Para ejecutar la limpieza, ejecuta:");
                    console.log("   npm run script:limpiar-transacciones\n");
                    return [3 /*break*/, 36];
                case 33:
                    error_1 = _a.sent();
                    console.error("❌ Error durante la verificación:", error_1);
                    throw error_1;
                case 34: return [4 /*yield*/, prisma.$disconnect()];
                case 35:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 36: return [2 /*return*/];
            }
        });
    });
}
// Ejecutar el script
verificarDatos()
    .then(function () {
    console.log("✅ Verificación completada");
    process.exit(0);
})
    .catch(function (error) {
    console.error("💥 Error fatal:", error);
    process.exit(1);
});
