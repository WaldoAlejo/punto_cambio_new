import { reportService } from "../services/reportService.js";
import logger from "../utils/logger.js";
export const reportController = {
    async generateReport(req, res) {
        try {
            res.set({
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
                "Surrogate-Control": "no-store",
            });
            const { reportType, dateFrom, dateTo, pointId, userId } = req.body;
            if (!reportType || !dateFrom || !dateTo) {
                res.status(400).json({
                    success: false,
                    error: "Faltan parámetros requeridos: reportType, dateFrom, dateTo",
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const requestPayload = {
                reportType,
                dateFrom,
                dateTo,
                pointId,
                userId,
            };
            const data = await reportService.generateReport(requestPayload, req.user?.id);
            res.status(200).json({
                success: true,
                data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
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
