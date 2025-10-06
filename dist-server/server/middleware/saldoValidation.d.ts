import { Request, Response, NextFunction } from "express";
interface SaldoValidationRequest extends Request {
    body: {
        punto_atencion_id?: string;
        moneda_id?: string;
        monto?: number;
        tipo_movimiento?: string;
        tipo?: string;
        punto_origen_id?: string;
        punto_destino_id?: string;
        moneda_origen_id?: string;
        moneda_destino_id?: string;
        monto_origen?: number;
        monto_destino?: number;
    };
}
/**
 * Middleware para validar saldo suficiente antes de egresos
 * Solo bloquea EGRESOS, permite INGRESOS sin restricción
 */
export declare function validarSaldoSuficiente(req: SaldoValidationRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware específico para transferencias
 */
export declare function validarSaldoTransferencia(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware específico para cambios de divisa
 * Aplica la misma lógica de normalización que el endpoint de exchanges
 * para validar la moneda correcta según el tipo de operación
 */
export declare function validarSaldoCambioDivisa(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare const _default: {
    validarSaldoSuficiente: typeof validarSaldoSuficiente;
    validarSaldoTransferencia: typeof validarSaldoTransferencia;
    validarSaldoCambioDivisa: typeof validarSaldoCambioDivisa;
};
export default _default;
