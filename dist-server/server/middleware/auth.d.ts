import { RequestHandler } from "express";
interface AuthenticatedUser {
    id: string;
    username: string;
    nombre: string;
    rol: string;
    activo: boolean;
    punto_atencion_id: string | null;
}
declare module "express-serve-static-core" {
    interface Request {
        user?: AuthenticatedUser;
    }
}
export declare const authenticateToken: RequestHandler;
export declare const requireRole: (roles: string[]) => RequestHandler;
export declare const generateToken: (userId: string) => string;
export {};
