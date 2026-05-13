import apiService from "./axiosInstance";

export interface UnifiedAssignment {
  id: string;
  fecha: string;
  categoria: "GENERAL" | "SERVICIO_EXTERNO" | "SERVIENTREGA";
  tipo: string;
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  moneda_id: string;
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  servicio?: string | null;
  saldo_anterior: number;
  cantidad_asignada: number;
  saldo_nuevo: number;
  asignado_por_id: string;
  asignado_por_nombre: string;
  observaciones: string | null;
}

export interface ReporteResumen {
  total_general: number;
  total_servicios_externos: number;
  total_servientrega: number;
  total_inicial: number;
  total_recarga: number;
  por_punto: Array<{
    punto_id: string;
    punto_nombre: string;
    total: number;
    cantidad: number;
  }>;
  por_moneda: Array<{
    moneda_id: string;
    moneda_codigo: string;
    moneda_nombre: string;
    total: number;
    cantidad: number;
  }>;
}

export interface ReporteAsignacionesResponse {
  success: boolean;
  asignaciones: UnifiedAssignment[];
  resumen: ReporteResumen;
}

export interface ReporteFilters {
  punto_atencion_id?: string;
  from?: string;
  to?: string;
  tipo?: "INICIAL" | "RECARGA";
  categoria?: "GENERAL" | "SERVICIO_EXTERNO" | "SERVIENTREGA";
  servicio?: string;
  moneda_id?: string;
}

export const reporteAsignacionesService = {
  async getReporte(filters?: ReporteFilters): Promise<{
    data: ReporteAsignacionesResponse | null;
    error: string | null;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters?.punto_atencion_id)
        params.set("punto_atencion_id", filters.punto_atencion_id);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      if (filters?.tipo) params.set("tipo", filters.tipo);
      if (filters?.categoria) params.set("categoria", filters.categoria);
      if (filters?.servicio) params.set("servicio", filters.servicio);
      if (filters?.moneda_id) params.set("moneda_id", filters.moneda_id);

      const qs = params.toString();
      const url = `/reportes/asignaciones${qs ? `?${qs}` : ""}`;

      const response = await apiService.get<ReporteAsignacionesResponse>(url);
      return { data: response.data, error: null };
    } catch (err: any) {
      console.error("Error cargando reporte de asignaciones:", err);
      return {
        data: null,
        error: err?.response?.data?.message || "Error cargando reporte",
      };
    }
  },
};
