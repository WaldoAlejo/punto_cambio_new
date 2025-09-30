import { Request, Response, NextFunction } from "express";
/**
 * Middleware para validar que el usuario existe y está activo
 */
export declare const validateUserExists: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware para validar que el punto de atención existe y está activo
 */
export declare const validatePuntoAtencionExists: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware para validar que la moneda existe y está activa
 */
export declare const validateMonedaExists: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware para validar permisos de rol
 */
export declare const validateRole: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware para validar formato de UUID
 */
export declare const validateUUID: (paramName: string) => (req: Request, res: Response, next: NextFunction) => void;
declare global {
    namespace Express {
        interface Request {
            validatedUser?: {
                id: string;
                activo: boolean;
                rol: string;
                nombre: string;
            };
            validatedPunto?: {
                id: string;
                activo: boolean;
                nombre: string;
            };
            validatedMoneda?: {
                id: string;
                activo: boolean;
                codigo: string;
                nombre: string;
            };
        }
    }
}
