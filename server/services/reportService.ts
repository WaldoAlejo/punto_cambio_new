
import { ReportData, ReportRequest } from "../types/reportTypes.js";
import { reportDataService } from "./reportDataService.js";
import logger from "../utils/logger.js";

export const reportService = {
  async generateReport(request: ReportRequest, userId?: string): Promise<ReportData[]> {
    const { reportType, dateFrom, dateTo } = request;
    
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    let reportData: ReportData[] = [];

    switch (reportType) {
      case 'exchanges': {
        reportData = await reportDataService.getExchangesData(startDate, endDate);
        break;
      }
      case 'transfers': {
        reportData = await reportDataService.getTransfersData(startDate, endDate);
        break;
      }
      case 'balances': {
        reportData = await reportDataService.getBalancesData();
        break;
      }
      case 'users': {
        reportData = await reportDataService.getUserActivityData(startDate, endDate);
        break;
      }
      default:
        throw new Error("Tipo de reporte no válido");
    }

    logger.info("Reporte generado exitosamente", {
      reportType,
      dateFrom,
      dateTo,
      recordCount: reportData.length,
      requestedBy: userId,
    });

    return reportData;
  }
};
