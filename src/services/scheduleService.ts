import { apiService } from "./apiService";
import { PuntoAtencion, Usuario } from "../types";

// =====================
// Tipos
// =====================
export interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo: string | null;
  fecha_regreso: string | null;
  fecha_salida: string | null;
  estado: "ACTIVO" | "ALMUERZO" | "COMPLETADO" | "CANCELADO";
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
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

type SchedulesResult = { schedules: Schedule[]; error: string | null };
type ScheduleResult = { schedule: Schedule | null; error: string | null };

// =====================
// Service
// =====================
export const scheduleService = {
  // Listado con filtros (fecha única o rango, estados, usuario, paginación)
  async getAllSchedules(params?: {
    fecha?: string; // YYYY-MM-DD
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    estados?: string[]; // ["ACTIVO","ALMUERZO","COMPLETADO","CANCELADO"]
    usuario_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<SchedulesResult> {
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

  // Jornada activa del usuario autenticado
  async getActiveSchedule(): Promise<ScheduleResult> {
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

  // Crear o actualizar jornada
  // Nota: override es opcional y solo tendrá efecto para roles privilegiados (ADMINISTRATIVO/ADMIN/SUPER)
  async createOrUpdateSchedule(scheduleData: {
    usuario_id: string;
    punto_atencion_id: string;
    fecha_inicio?: string;
    fecha_almuerzo?: string;
    fecha_regreso?: string;
    fecha_salida?: string;
    ubicacion_inicio?: { lat: number; lng: number; direccion?: string } | null;
    ubicacion_salida?: { lat: number; lng: number; direccion?: string } | null;
    override?: boolean; // <- agregado
  }): Promise<ScheduleResult> {
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

  // === Helpers opcionales para vistas de administración ===

  // Jornadas empezadas hoy (ACTIVO/ALMUERZO) — requiere ADMIN/SUPER/ADMINISTRATIVO
  async getStartedToday(): Promise<SchedulesResult> {
    try {
      const response = await apiService.get<SchedulesResponse>(
        "/schedules/started-today"
      );
      if (!response) {
        return {
          schedules: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }
      if (response.error || !response.success) {
        return {
          schedules: [],
          error: response.error || "Error al obtener jornadas de hoy",
        };
      }
      return { schedules: response.schedules || [], error: null };
    } catch (error) {
      console.error("Error en getStartedToday:", error);
      return { schedules: [], error: "Error de conexión con el servidor" };
    }
  },

  // Historial de un usuario (admin/super/administrativo o el propio usuario)
  async getUserHistory(params: {
    userId: string;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    estados?: string[]; // ["ACTIVO","ALMUERZO","COMPLETADO","CANCELADO"]
  }): Promise<SchedulesResult> {
    try {
      const q = new URLSearchParams();
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.estados?.length) q.set("estados", params.estados.join(","));

      const response = await apiService.get<SchedulesResponse>(
        `/schedules/user/${params.userId}${
          q.toString() ? `?${q.toString()}` : ""
        }`
      );

      if (!response) {
        return {
          schedules: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }
      if (response.error || !response.success) {
        return {
          schedules: [],
          error: response.error || "Error al obtener historial",
        };
      }
      return { schedules: response.schedules || [], error: null };
    } catch (error) {
      console.error("Error en getUserHistory:", error);
      return { schedules: [], error: "Error de conexión con el servidor" };
    }
  },
};
