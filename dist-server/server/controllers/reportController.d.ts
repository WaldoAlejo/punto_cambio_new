import express from "express";
import { AuthenticatedUser } from "../types/reportTypes.js";
interface AuthenticatedRequest extends express.Request {
    user?: AuthenticatedUser;
}
export declare const reportController: {
    generateReport(req: AuthenticatedRequest, res: express.Response): Promise<void>;
};
export {};
