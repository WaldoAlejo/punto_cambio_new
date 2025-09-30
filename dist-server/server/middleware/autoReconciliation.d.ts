import { Request, Response, NextFunction } from "express";
interface AuthenticatedUser {
    id: string;
    username: string;
    nombre: string;
    rol: string;
    activo: boolean;
    punto_atencion_id: string | null;
}
interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}
/**
 * Middleware de Auto-Reconciliación
 *
 * Este middleware se ejecuta después de operaciones que pueden afectar saldos
 * para garantizar que siempre estén cuadrados con los movimientos registrados.
 */
/**
 * Middleware que ejecuta reconciliación automática después de operaciones de saldo
 * Se debe usar en rutas que modifiquen saldos (transferencias, cambios, etc.)
 */
export declare const autoReconciliationMiddleware: (options?: {
    pointIdParam?: string;
    currencyIdParam?: string;
    pointIdBody?: string;
    currencyIdBody?: string;
    skipOnError?: boolean;
}) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware específico para transferencias
 * Reconcilia tanto el origen como el destino
 */
export declare const transferAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware específico para cambios de divisa
 */
export declare const exchangeAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware específico para actualizaciones de saldo directo
 */
export declare const balanceUpdateAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware genérico que intenta detectar automáticamente los campos
 */
export declare const genericAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
declare const _default: {
    autoReconciliationMiddleware: (options?: {
        pointIdParam?: string;
        currencyIdParam?: string;
        pointIdBody?: string;
        currencyIdBody?: string;
        skipOnError?: boolean;
    }) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    transferAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    exchangeAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    balanceUpdateAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    genericAutoReconciliation: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
};
export default _default;
