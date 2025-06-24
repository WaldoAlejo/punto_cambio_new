import {
  ReportData,
  ReportRequest,
  SummaryReportResponse,
} from "../types/reportTypes.js";
import { reportDataService } from "./reportDataService.js";
import logger from "../utils/logger.js";

export const reportService = {
  async generateReport(
    request: ReportRequest,
    userId?: string
  ): Promise<ReportData[] | SummaryReportResponse> {
    const { reportType, dateFrom, dateTo } = request;

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    switch (reportType) {
      case "exchanges": {
        const reportData = await reportDataService.getExchangesData(
          startDate,
          endDate
        );

        logger.info("Reporte de cambios generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: reportData.length,
          requestedBy: userId,
        });

        return reportData;
      }

      case "transfers": {
        const reportData = await reportDataService.getTransfersData(
          startDate,
          endDate
        );

        logger.info("Reporte de transferencias generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: reportData.length,
          requestedBy: userId,
        });

        return reportData;
      }

      case "balances": {
        const reportData = await reportDataService.getBalancesData();

        logger.info("Reporte de saldos generado", {
          reportType,
          recordCount: reportData.length,
          requestedBy: userId,
        });

        return reportData;
      }

      case "users": {
        const reportData = await reportDataService.getUserActivityData(
          startDate,
          endDate
        );

        logger.info("Reporte de actividad de usuarios generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: reportData.length,
          requestedBy: userId,
        });

        return reportData;
      }

      case "summary": {
        const exchanges = await reportDataService.getExchangesData(
          startDate,
          endDate
        );
        const transfers = await reportDataService.getTransfersData(
          startDate,
          endDate
        );

        const totalExchanges = exchanges.length;
        const totalTransfers = transfers.length;

        const totalAmountExchanges = exchanges.reduce(
          (sum, r) => sum + (r.amount || 0),
          0
        );
        const totalAmountTransfers = transfers.reduce(
          (sum, r) => sum + (r.amount || 0),
          0
        );

        const totalVolume = totalAmountExchanges + totalAmountTransfers;
        const averageTransaction =
          totalVolume / Math.max(1, totalExchanges + totalTransfers);

        logger.info("Resumen de reporte generado exitosamente", {
          totalExchanges,
          totalTransfers,
          totalVolume,
          averageTransaction,
          requestedBy: userId,
        });

        const summaryReport: SummaryReportResponse = {
          exchanges,
          transfers,
          summary: {
            totalExchanges,
            totalTransfers,
            totalVolume,
            averageTransaction,
          },
        };

        return summaryReport;
      }

      default:
        throw new Error("Tipo de reporte no válido");
    }
  },
};
