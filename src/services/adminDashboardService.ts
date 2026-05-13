import { apiService } from "./apiService";

export interface CierreReciente {
  id: string;
  fecha: string;
  punto: string;
  operador: string;
  moneda: string;
  diferencia: number;
  estado: "perfecto" | "sobrante" | "faltante";
}

export interface ActividadHora {
  hora: string;
  cambios: number;
  transferencias: number;
  servicios: number;
}

export interface PuntoEstado {
  id: string;
  nombre: string;
  cambiosHoy: number;
  transferenciasHoy: number;
  jornadasHoy: number;
  estado: "operativo" | "en_cierre" | "cerrado";
}

export interface DashboardStats {
  totalUsuarios: number;
  totalPuntos: number;
  totalMonedas: number;
  operadoresActivos: number;
  transaccionesHoy: number;
  transferenciasHoy: number;
  serviciosHoy: number;
  cierresPendientes: number;
  aperturasPendientes: number;
  diferenciasHoy: number;
}

export interface AdminDashboardResponse {
  success: boolean;
  stats: DashboardStats;
  cierresRecientes: CierreReciente[];
  actividad: ActividadHora[];
  puntosEstado: {
    operativos: number;
    enCierre: number;
    cerrados: number;
    detalle: PuntoEstado[];
  };
}

export const adminDashboardService = {
  async getStats(): Promise<{
    data: AdminDashboardResponse | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.get<AdminDashboardResponse>(
        "/admin/dashboard-stats"
      );
      if (!response) {
        return { data: null, error: "Sin respuesta del servidor" };
      }
      if (response.error || !response.success) {
        return {
          data: null,
          error: response.error || "Error cargando dashboard",
        };
      }
      return { data: response, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: err?.response?.data?.error || "Error de conexión",
      };
    }
  },
};
