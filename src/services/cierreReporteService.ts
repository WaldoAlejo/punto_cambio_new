/**
 * cierreReporteService.ts
 * 
 * Servicio para generar y gestionar los reportes de cierre de caja
 * tanto para operadores como para administradores.
 */

import axiosInstance from "./axiosInstance";

// Tipo para errores de Axios
interface AxiosError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export interface ReporteCierreOperador {
  cuadre_id: string;
  fecha: string;
  punto_atencion: {
    id: string;
    nombre: string;
    ciudad: string;
  };
  operador: {
    id: string;
    nombre: string;
    username: string;
  };
  detalles: Array<{
    moneda_id: string;
    codigo: string;
    nombre: string;
    simbolo: string;
    saldo_apertura: number;
    ingresos_periodo: number;
    egresos_periodo: number;
    saldo_cierre: number;
    conteo_fisico: number;
    billetes: number;
    monedas: number;
    bancos_teorico: number;
    conteo_bancos: number;
    diferencia: number;
    diferencia_bancos: number;
    movimientos_periodo: number;
  }>;
  totales: {
    ingresos: number;
    egresos: number;
    movimientos: number;
  };
  observaciones: string | null;
  estado: "ABIERTO" | "PARCIAL" | "CERRADO";
  fecha_cierre: string | null;
  created_at: string;
}

export interface ReporteCierreAdmin {
  fecha_consultada: string;
  estadisticas: {
    total_puntos: number;
    puntos_con_cierre: number;
    puntos_sin_cierre: number;
    porcentaje_cumplimiento: number;
  };
  puntos: Array<{
    punto_id: string;
    punto_nombre: string;
    ciudad: string;
    tiene_cierre: boolean;
    cierre?: {
      cuadre_id: string;
      usuario_id: string;
      usuario_nombre: string;
      fecha_cierre: string;
      estado: string;
      observaciones: string | null;
      detalles: Array<{
        moneda_codigo: string;
        moneda_nombre: string;
        saldo_apertura: number;
        saldo_cierre: number;
        conteo_fisico: number;
        diferencia: number;
        billetes: number;
        monedas: number;
      }>;
      totales: {
        ingresos: number;
        egresos: number;
      };
    };
    jornada?: {
      hora_inicio: string;
      hora_salida: string | null;
      estado: string;
    };
  }>;
}

export interface ValidacionCierre {
  valido: boolean;
  errores: Array<{
    tipo: "INCOMPLETO" | "DIFERENCIA" | "DESGLOSE" | "SIN_JORNADA";
    moneda_codigo?: string;
    mensaje: string;
    severidad: "ERROR" | "ADVERTENCIA";
  }>;
  advertencias: Array<{
    tipo: string;
    mensaje: string;
  }>;
}

class CierreReporteService {
  /**
   * Obtiene el reporte de cierre para el operador actual
   */
  async getReporteOperador(fecha?: string): Promise<{
    success: boolean;
    data?: ReporteCierreOperador;
    error?: string;
  }> {
    try {
      const params = fecha ? `?fecha=${fecha}` : "";
      const response = await axiosInstance.get(
        `/cierre-reporte/operador${params}`
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data?.error || "Error al obtener reporte",
      };
    }
  }

  /**
   * Obtiene el reporte completo de cierres para administradores
   */
  async getReporteAdmin(fecha?: string): Promise<{
    success: boolean;
    data?: ReporteCierreAdmin;
    error?: string;
  }> {
    try {
      const params = fecha ? `?fecha=${fecha}` : "";
      const response = await axiosInstance.get(
        `/cierre-reporte/admin${params}`
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data?.error || "Error al obtener reporte",
      };
    }
  }

  /**
   * Valida si el cierre puede realizarse
   */
  async validarCierre(
    puntoId: string,
    fecha?: string
  ): Promise<{
    success: boolean;
    data?: ValidacionCierre;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (puntoId) params.append("puntoId", puntoId);
      if (fecha) params.append("fecha", fecha);
      
      const response = await axiosInstance.get(
        `/cierre-reporte/validar?${params.toString()}`
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data?.error || "Error al validar cierre",
      };
    }
  }

  /**
   * Obtiene el historial de cierres de un punto específico
   */
  async getHistorialCierres(
    puntoId: string,
    dias: number = 30
  ): Promise<{
    success: boolean;
    data?: Array<{
      cuadre_id: string;
      fecha: string;
      estado: string;
      usuario_nombre: string;
      total_diferencias: number;
      diferencias?: Array<{
        moneda_codigo: string;
        diferencia: number;
      }>;
    }>;
    error?: string;
  }> {
    try {
      const response = await axiosInstance.get(
        `/cierre-reporte/historial/${puntoId}?dias=${dias}`
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data?.error || "Error al obtener historial",
      };
    }
  }

  /**
   * Genera un reporte PDF/imprimible del cierre
   */
  async generarReportePDF(cuadreId: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const response = await axiosInstance.get(
        `/cierre-reporte/pdf/${cuadreId}`
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data?.error || "Error al generar PDF",
      };
    }
  }
}

export const cierreReporteService = new CierreReporteService();
export default cierreReporteService;
