
import { apiService } from "./apiService";

export interface Usuario {
  id: string;
  nombre: string;
  username: string;
}

export interface PuntoAtencion {
  id: string;
  nombre: string;
}

export interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo: string | null;
  fecha_regreso: string | null;
  fecha_salida: string | null;
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

interface SchedulesResponse {
  schedules: Schedule[];
  success: boolean;
  error?: string;
}

export const scheduleService = {
  async getAllSchedules(): Promise<{
    schedules: Schedule[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<SchedulesResponse>("/schedules");

      if (!response) {
        return {
          schedules: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          schedules: [],
          error: response.error || "Error al obtener horarios",
        };
      }

      return { schedules: response.schedules || [], error: null };
    } catch (error) {
      console.error("Error en getAllSchedules:", error);
      return { schedules: [], error: "Error de conexión con el servidor" };
    }
  },
};
