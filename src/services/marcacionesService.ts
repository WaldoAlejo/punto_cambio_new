import { axiosInstance } from "./axiosInstance";

export const tiposMarcacion: Record<string, string> = {
  ENTRADA: "Entrada", ALMUERZO: "Inicio de almuerzo", REGRESO: "Regreso de almuerzo",
  SALIDA: "Salida", SALIDA_ESPONTANEA: "Salida espontánea", REGRESO_ESPONTANEO: "Regreso de salida",
};
export interface MarcacionEvent {
  id: string; registroId: string; origen: string; usuarioId: string; nombre: string;
  username: string; puntoId: string; punto: string; direccionPunto: string; tipo: string;
  fecha: string; estado: string;
  ubicacion: { lat: number; lng: number; accuracy: number | null; direccion: string | null } | null;
  dispositivo: string | null; motivoSinGps: string | null; observaciones: string | null;
}
export interface MarcacionesFilters {
  from: string; to: string; usuario_id: string; punto_atencion_id: string; tipo: string; ubicacion: string;
}
export interface MarcacionesData {
  events: MarcacionEvent[]; total: number; page: number; pageSize: number;
  summary: { total: number; conUbicacion: number; sinUbicacion: number; usuarios: number };
  markers: MarcacionEvent[]; markersTotal: number; markersLimit: number;
  users: { id: string; nombre: string; username: string; activo: boolean }[];
  points: { id: string; nombre: string }[]; from: string; to: string;
}
export async function getMarcaciones(filters: MarcacionesFilters, page: number, signal: AbortSignal) {
  const params = Object.fromEntries(Object.entries({ ...filters, page, pageSize: 25 }).filter(([, value]) => value !== ""));
  const response = await axiosInstance.get<{ success: boolean; data: MarcacionesData }>("/admin/marcaciones", { params, signal });
  if (!response.data.success) throw new Error("No se pudo consultar las marcaciones.");
  return response.data.data;
}
export const fechaMarcacion = (value: string) => new Date(value).toLocaleString("es-EC", {
  timeZone: "America/Guayaquil", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
