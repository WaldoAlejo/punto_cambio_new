import { apiService } from "./apiService";
import logger from "../../server/utils/logger";

export interface ReportItem {
  point: string;
  user?: string;
  amount?: number;
  transfers?: number;
  balance?: number;
  exchanges?: number;
}

export interface SummaryData {
  totalExchanges: number;
  totalTransfers: number;
  totalVolume: number;
  averageTransaction: number;
}

export interface FullReportResponse {
  exchanges: ReportItem[];
  transfers: ReportItem[];
  summary: SummaryData;
}

export const reportService = {
  async generateReport(
    reportType: "exchanges" | "transfers" | "summary" | "balances" | "users",
    filters: {
      dateFrom: string;
      dateTo: string;
      pointId?: string;
      userId?: string;
    }
  ): Promise<FullReportResponse> {
    try {
      logger.info("Generando reporte avanzado", { reportType, filters });

      const response = await apiService.post<{ data: FullReportResponse }>(
        "/reports",
        {
          reportType,
          ...filters,
        }
      );

      if (!response?.data) {
        logger.warn("No se pudo conectar con el servidor en generateReport");
        return {
          exchanges: [],
          transfers: [],
          summary: {
            totalExchanges: 0,
            totalTransfers: 0,
            totalVolume: 0,
            averageTransaction: 0,
          },
        };
      }

      return response.data;
    } catch (error) {
      logger.error("Excepción en generateReport", {
        message: error instanceof Error ? error.message : "Error desconocido",
      });

      return {
        exchanges: [],
        transfers: [],
        summary: {
          totalExchanges: 0,
          totalTransfers: 0,
          totalVolume: 0,
          averageTransaction: 0,
        },
      };
    }
  },
};
