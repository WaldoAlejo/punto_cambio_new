import {
  ReportData,
  ReportRequest,
  SummaryReportResponse,
} from "../types/reportTypes.js";
import { reportDataService } from "./reportDataService.js";
import logger from "../utils/logger.js";
import { gyeParseDateOnly, gyeDayRangeUtcFromYMD } from "../utils/timezone.js";

export const reportService = {
  async generateReport(
    request: ReportRequest,
    userId?: string
  ): Promise<ReportData[] | SummaryReportResponse> {
    logger.info("🚨 DEBUG - Servicio de reportes iniciado", {
      request,
      userId,
      timestamp: new Date().toISOString(),
    });

    const { reportType, dateFrom, dateTo } = request;

    logger.info("🚨 DEBUG - Procesando fechas", {
      reportType,
      dateFrom,
      dateTo,
    });

    // Normalizar rango por día GYE
    let startDate: Date, endDate: Date;
    try {
      const { y: y1, m: m1, d: d1 } = gyeParseDateOnly(dateFrom);
      const { y: y2, m: m2, d: d2 } = gyeParseDateOnly(dateTo);
      const startRange = gyeDayRangeUtcFromYMD(y1, m1, d1);
      const endRange = gyeDayRangeUtcFromYMD(y2, m2, d2);
      startDate = startRange.gte;
      endDate = endRange.lt;

      logger.info("🚨 DEBUG - Fechas procesadas", {
        startDate,
        endDate,
        reportType,
      });
    } catch (dateError) {
      logger.error("🚨 DEBUG - Error procesando fechas", {
        error: dateError instanceof Error ? dateError.message : dateError,
        dateFrom,
        dateTo,
      });
      throw dateError;
    }

    logger.info("🚨 DEBUG - Iniciando switch para tipo de reporte", {
      reportType,
    });

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

      case "worktime": {
        const reportData = await reportDataService.getWorkTimeData(
          startDate,
          endDate,
          {
            pointId: request.pointId,
            userId: request.userId,
          }
        );

        logger.info("Reporte de tiempo de trabajo generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });

        return reportData as ReportData[];
      }

      case "exchanges_detailed": {
        const reportData = await reportDataService.getExchangesDetailedData(
          startDate,
          endDate,
          {
            pointId: request.pointId,
            userId: request.userId,
            currencyId: request.currencyId,
            estado: request.estado,
            metodoEntrega: request.metodoEntrega,
          }
        );

        logger.info("Reporte detallado de cambios generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });

        return reportData as ReportData[];
      }

      case "transfers_detailed": {
        const reportData = await reportDataService.getTransfersDetailedData(
          startDate,
          endDate,
          {
            pointId: request.pointId,
            userId: request.userId,
            estado: request.estado,
            currencyId: request.currencyId,
          }
        );
        logger.info("Reporte detallado de transferencias generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });
        return reportData as ReportData[];
      }

      case "accounting_movements": {
        const reportData = await reportDataService.getAccountingMovementsData(
          startDate,
          endDate,
          {
            pointId: request.pointId,
            userId: request.userId,
            currencyId: request.currencyId,
            tipoReferencia: request.estado, // reutilizamos 'estado' como filtro libre si se requiere
          }
        );
        logger.info("Reporte de movimientos contables generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });
        return reportData as ReportData[];
      }

      case "eod_balances": {
        const reportData = await reportDataService.getEodBalancesData(
          startDate,
          endDate,
          { pointId: request.pointId }
        );
        logger.info("Reporte de saldos de cierre generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });
        return reportData as ReportData[];
      }

      case "point_assignments": {
        const reportData = await reportDataService.getPointAssignmentsData(
          startDate,
          endDate,
          { userId: request.userId }
        );
        logger.info("Reporte de asignaciones de punto generado", {
          reportType,
          dateFrom,
          dateTo,
          recordCount: Array.isArray(reportData) ? reportData.length : 0,
          requestedBy: userId,
        });
        return reportData as ReportData[];
      }

      default:
        logger.error("🚨 DEBUG - Tipo de reporte no válido", {
          reportType,
          availableTypes: [
            "exchanges",
            "transfers",
            "balances",
            "users",
            "summary",
            "worktime",
            "exchanges_detailed",
            "transfers_detailed",
            "accounting_movements",
            "eod_balances",
            "point_assignments",
          ],
        });
        throw new Error(`Tipo de reporte no válido: ${reportType}`);
    }
  },
};
