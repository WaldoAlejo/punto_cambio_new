
import { apiService } from './apiService';

export interface ReportData {
  point: string;
  user?: string;
  amount?: number;
  transfers?: number;
  balance?: number;
  exchanges?: number;
}

export interface ReportResponse {
  data: ReportData[];
  success: boolean;
  error?: string;
}

export const reportService = {
  async getReportData(
    reportType: 'exchanges' | 'transfers' | 'balances' | 'users',
    dateFrom: string,
    dateTo: string
  ): Promise<{ data: ReportData[]; error: string | null }> {
    try {
      console.log(`Fetching report data for type: ${reportType}, from: ${dateFrom}, to: ${dateTo}`);
      
      const response = await apiService.post<ReportResponse>('/reports', {
        reportType,
        dateFrom,
        dateTo
      });

      if (!response) {
        return { data: [], error: 'No se pudo conectar con el servidor' };
      }

      if (response.error) {
        return { data: [], error: response.error };
      }

      return { data: response.data || [], error: null };
    } catch (error) {
      console.error('Error in getReportData:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Error desconocido al obtener reportes' 
      };
    }
  }
};
