import express from "express";
interface AuthenticatedUser {
    id: string;
    username: string;
    nombre: string;
    rol: string;
    activo: boolean;
    punto_atencion_id: string | null;
}
interface AuthenticatedRequest extends express.Request {
    user?: AuthenticatedUser;
}
declare const controller: {
    createTransfer(req: AuthenticatedRequest, res: express.Response): Promise<void>;
    getAllTransfers(req: AuthenticatedRequest, res: express.Response): Promise<void>;
};
export default controller;
