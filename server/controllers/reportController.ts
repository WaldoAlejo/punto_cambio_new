import express from "express";
import { reportService } from "../services/reportService.js";
import { AuthenticatedUser, ReportRequest } from "../types/reportTypes.js";
import logger from "../utils/logger.js";

interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUser;
}

export const reportController = {
  async generateReport(
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> {
    try {
      logger.info("🚨 DEBUG - Iniciando generación de reporte", {
        user: req.user
          ? {
              id: req.user.id,
              username: req.user.username,
              rol: req.user.rol,
            }
          : null,
        body: req.body,
        timestamp: new Date().toISOString(),
      });

      res.set({
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      });

      const { reportType, dateFrom, dateTo, pointId, userId } = req.body;

      logger.info("🚨 DEBUG - Parámetros extraídos", {
        reportType,
        dateFrom,
        dateTo,
        pointId,
        userId,
      });

      if (!reportType || !dateFrom || !dateTo) {
        logger.warn("🚨 DEBUG - Faltan parámetros requeridos", {
          reportType: !!reportType,
          dateFrom: !!dateFrom,
          dateTo: !!dateTo,
        });
        res.status(400).json({
          success: false,
          error: "Faltan parámetros requeridos: reportType, dateFrom, dateTo",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const requestPayload: ReportRequest = {
        reportType,
        dateFrom,
        dateTo,
        pointId,
        userId,
      };

      logger.info("🚨 DEBUG - Llamando al servicio de reportes", {
        requestPayload,
        userId: req.user?.id,
      });

      const data = await reportService.generateReport(
        requestPayload,
        req.user?.id
      );

      logger.info("🚨 DEBUG - Reporte generado exitosamente", {
        dataType: typeof data,
        dataLength: Array.isArray(data) ? data.length : "N/A",
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al generar reporte", {
        error: error instanceof Error ? error.message : "Error desconocido",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error interno al generar el reporte",
        timestamp: new Date().toISOString(),
      });
    }
  },
};
