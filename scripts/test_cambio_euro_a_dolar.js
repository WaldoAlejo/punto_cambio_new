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
// scripts/test_cambio_euro_a_dolar.ts
var prisma_1 = require("../server/lib/prisma");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var punto_atencion_id, moneda_origen_id, moneda_destino_id, monto_origen, monto_destino, saldoUSD, saldoBilletes, saldoMonedas, saldoFisicoTotal;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    punto_atencion_id = '416efc7b-a531-4bc0-949a-ee98568ee6bb';
                    moneda_origen_id = 'a5c09e3a-ceca-4065-abc3-daf4452bc2da';
                    moneda_destino_id = 'd7b34ea2-f014-4046-b7ca-d0aa5885a6a4';
                    monto_origen = 10;
                    monto_destino = 10.5;
                    return [4 /*yield*/, prisma_1.default.saldo.findUnique({
                            where: {
                                punto_atencion_id_moneda_id: {
                                    punto_atencion_id: punto_atencion_id,
                                    moneda_id: moneda_destino_id,
                                },
                            },
                        })];
                case 1:
                    saldoUSD = _a.sent();
                    console.log('Saldo USD antes del cambio:', saldoUSD);
                    saldoBilletes = Number((saldoUSD === null || saldoUSD === void 0 ? void 0 : saldoUSD.billetes) || 0);
                    saldoMonedas = Number((saldoUSD === null || saldoUSD === void 0 ? void 0 : saldoUSD.monedas_fisicas) || 0);
                    saldoFisicoTotal = saldoBilletes + saldoMonedas;
                    if (monto_destino > saldoFisicoTotal) {
                        console.error('ERROR: SALDO_INSUFICIENTE_CAMBIO');
                        console.error("Disponible: ".concat(saldoFisicoTotal, " (Billetes: ").concat(saldoBilletes, ", Monedas: ").concat(saldoMonedas, "), Requerido: ").concat(monto_destino));
                    }
                    else {
                        console.log('Cambio permitido. Hay saldo suficiente.');
                    }
                    return [4 /*yield*/, prisma_1.default.$disconnect()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
