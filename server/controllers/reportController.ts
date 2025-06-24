
import express from "express";
import { reportService } from "../services/reportService.js";
import { AuthenticatedUser, ReportRequest } from "../types/reportTypes.js";
import logger from "../utils/logger.js";

interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

export const reportController = {
  async generateReport(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const { reportType, dateFrom, dateTo } = req.body;

      if (!reportType || !dateFrom || !dateTo) {
        res.status(400).json({
          error: "Faltan parámetros requeridos: reportType, dateFrom, dateTo",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const reportRequest: ReportRequest = {
        reportType,
        dateFrom,
        dateTo
      };

      const reportData = await reportService.generateReport(reportRequest, req.user?.id);

      res.status(200).json({
        data: reportData,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al generar reporte", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorMessage = error instanceof Error ? error.message : "Error interno del servidor al generar reporte";
      const statusCode = error instanceof Error && error.message === "Tipo de reporte no válido" ? 400 : 500;

      res.status(statusCode).json({
        error: errorMessage,
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
};
