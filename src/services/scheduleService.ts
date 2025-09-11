import { apiService } from "./apiService";
import { PuntoAtencion, Usuario } from "../types";

// Eliminamos la definición duplicada de PuntoAtencion

export interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo: string | null;
  fecha_regreso: string | null;
  fecha_salida: string | null;
  estado: "ACTIVO" | "COMPLETADO" | "CANCELADO";
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  usuario?: Usuario;
  puntoAtencion?: PuntoAtencion;
}

interface SchedulesResponse {
  schedules: Schedule[];
  success: boolean;
  error?: string;
}

interface ScheduleResponse {
  schedule: Schedule | null;
  success: boolean;
  error?: string;
}

export const scheduleService = {
  async getAllSchedules(params?: {
    fecha?: string; // YYYY-MM-DD
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    estados?: string[]; // ["ACTIVO","ALMUERZO","COMPLETADO"]
    usuario_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    schedules: Schedule[];
    error: string | null;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.fecha) q.set("fecha", params.fecha);
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      if (params?.estados?.length) q.set("estados", params.estados.join(","));
      if (params?.usuario_id) q.set("usuario_id", params.usuario_id);
      if (typeof params?.limit === "number")
        q.set("limit", String(params.limit));
      if (typeof params?.offset === "number")
        q.set("offset", String(params.offset));
      const url = `/schedules${q.toString() ? `?${q.toString()}` : ""}`;
      const response = await apiService.get<SchedulesResponse>(url);
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

  async getActiveSchedule(): Promise<{
    schedule: Schedule | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.get<ScheduleResponse>(
        "/schedules/active"
      );
      if (!response) {
        return {
          schedule: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }
      if (response.error || !response.success) {
        return {
          schedule: null,
          error: response.error || "Error al obtener horario activo",
        };
      }
      return { schedule: response.schedule, error: null };
    } catch (error) {
      console.error("Error en getActiveSchedule:", error);
      return { schedule: null, error: "Error de conexión con el servidor" };
    }
  },

  async createOrUpdateSchedule(scheduleData: {
    usuario_id: string;
    punto_atencion_id: string;
    fecha_inicio?: string;
    fecha_almuerzo?: string;
    fecha_regreso?: string;
    fecha_salida?: string;
    ubicacion_inicio?: { lat: number; lng: number; direccion?: string };
    ubicacion_salida?: { lat: number; lng: number; direccion?: string };
  }): Promise<{ schedule: Schedule | null; error: string | null }> {
    try {
      console.log(
        "📡 scheduleService.createOrUpdateSchedule - Enviando:",
        scheduleData
      );

      const response = await apiService.post<ScheduleResponse>(
        "/schedules",
        scheduleData
      );

      console.log(
        "📡 scheduleService.createOrUpdateSchedule - Respuesta:",
        response
      );
      if (!response) {
        return {
          schedule: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }
      if (response.error || !response.success) {
        return {
          schedule: null,
          error: response.error || "Error al guardar horario",
        };
      }
      return { schedule: response.schedule, error: null };
    } catch (error) {
      console.error("Error en createOrUpdateSchedule:", error);
      return { schedule: null, error: "Error de conexión con el servidor" };
    }
  },
};
