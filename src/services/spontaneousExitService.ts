
import { apiService } from "./apiService";

export interface SpontaneousExit {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  motivo: 'BANCO' | 'DILIGENCIA_PERSONAL' | 'TRAMITE_GOBIERNO' | 'EMERGENCIA_MEDICA' | 'OTRO';
  descripcion?: string;
  fecha_salida: string;
  fecha_regreso?: string;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_regreso?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  duracion_minutos?: number;
  aprobado_por?: string;
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
  created_at: string;
  updated_at: string;
  usuario?: {
    id: string;
    nombre: string;
    username: string;
  };
  puntoAtencion?: {
    id: string;
    nombre: string;
  };
  usuarioAprobador?: {
    id: string;
    nombre: string;
    username: string;
  };
}

interface SpontaneousExitsResponse {
  exits: SpontaneousExit[];
  success: boolean;
  error?: string;
}

interface CreateExitData {
  motivo: 'BANCO' | 'DILIGENCIA_PERSONAL' | 'TRAMITE_GOBIERNO' | 'EMERGENCIA_MEDICA' | 'OTRO';
  descripcion?: string;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
}

interface CreateExitResponse {
  exit: SpontaneousExit;
  success: boolean;
  error?: string;
}

interface ReturnExitData {
  ubicacion_regreso?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
}

export const spontaneousExitService = {
  async getAllExits(usuarioId?: string): Promise<{
    exits: SpontaneousExit[];
    error: string | null;
  }> {
    try {
      const endpoint = usuarioId ? `/spontaneous-exits?usuario_id=${usuarioId}` : '/spontaneous-exits';
      const response = await apiService.get<SpontaneousExitsResponse>(endpoint);

      if (!response) {
        return {
          exits: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          exits: [],
          error: response.error || "Error al obtener salidas espontáneas",
        };
      }

      return { exits: response.exits || [], error: null };
    } catch (error) {
      console.error("Error en getAllExits:", error);
      return { exits: [], error: "Error de conexión con el servidor" };
    }
  },

  async createExit(exitData: CreateExitData): Promise<{
    exit: SpontaneousExit | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.post<CreateExitResponse>("/spontaneous-exits", exitData);

      if (!response) {
        return {
          exit: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          exit: null,
          error: response.error || "Error al crear salida espontánea",
        };
      }

      return { exit: response.exit, error: null };
    } catch (error) {
      console.error("Error en createExit:", error);
      return { exit: null, error: "Error de conexión con el servidor" };
    }
  },

  async markReturn(exitId: string, returnData: ReturnExitData): Promise<{
    exit: SpontaneousExit | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.put<CreateExitResponse>(`/spontaneous-exits/${exitId}/return`, returnData);

      if (!response) {
        return {
          exit: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          exit: null,
          error: response.error || "Error al marcar regreso",
        };
      }

      return { exit: response.exit, error: null };
    } catch (error) {
      console.error("Error en markReturn:", error);
      return { exit: null, error: "Error de conexión con el servidor" };
    }
  },
};
