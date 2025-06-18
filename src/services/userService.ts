
import { apiService } from "./apiService";
import { User } from "../types";

export interface CreateUserData {
  username: string;
  password: string;
  nombre: string;
  correo: string;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION";
  punto_atencion_id?: string;
}

interface UsersResponse {
  users: User[];
  success: boolean;
  error?: string;
}

interface CreateUserResponse {
  user: User;
  success: boolean;
  error?: string;
}

interface ToggleUserResponse {
  success: boolean;
  error?: string;
}

export const userService = {
  async getAllUsers(): Promise<{
    users: User[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<UsersResponse>("/users");

      if (!response) {
        return {
          users: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          users: [],
          error: response.error || "Error al obtener usuarios",
        };
      }

      return { users: response.users || [], error: null };
    } catch (error) {
      console.error("Error en getAllUsers:", error);
      return { users: [], error: "Error de conexión con el servidor" };
    }
  },

  async createUser(userData: CreateUserData): Promise<{
    user: User | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.post<CreateUserResponse>("/users", userData);

      if (!response) {
        return {
          user: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return { user: null, error: response.error || "Error al crear usuario" };
      }

      return { user: response.user || null, error: null };
    } catch (error) {
      console.error("Error en createUser:", error);
      return { user: null, error: "Error de conexión con el servidor" };
    }
  },

  async toggleUserStatus(userId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const response = await apiService.put<ToggleUserResponse>(`/users/${userId}/toggle`, {});

      if (!response) {
        return {
          success: false,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return { success: false, error: response.error || "Error al actualizar usuario" };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error("Error en toggleUserStatus:", error);
      return { success: false, error: "Error de conexión con el servidor" };
    }
  },
};
