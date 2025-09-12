import { axiosInstance } from "./axiosInstance";
import type { ApiResponse, Permiso, PermisoTipo, EstadoPermiso } from "@/types";

export interface CreatePermisoData {
  tipo: PermisoTipo;
  fecha_inicio: string; // ISO
  fecha_fin: string; // ISO
  descripcion?: string;
  archivo_url?: string;
  archivo_nombre?: string;
  punto_atencion_id?: string;
}

export const permissionService = {
  async list(params?: { usuario_id?: string; estado?: EstadoPermiso }) {
    const { data } = await axiosInstance.get<{
      success: boolean;
      permisos: Permiso[];
    }>("/permissions", { params });
    return data;
  },

  async create(payload: CreatePermisoData) {
    const { data } = await axiosInstance.post<{
      success: boolean;
      permiso: Permiso;
    }>("/permissions", payload);
    return data;
  },

  async approve(id: string) {
    const { data } = await axiosInstance.patch<{
      success: boolean;
      permiso: Permiso;
    }>(`/permissions/${id}/approve`);
    return data;
  },

  async reject(id: string) {
    const { data } = await axiosInstance.patch<{
      success: boolean;
      permiso: Permiso;
    }>(`/permissions/${id}/reject`);
    return data;
  },
};
