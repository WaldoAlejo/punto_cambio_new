
import { apiService } from "./apiService";
import { Usuario, CreateUserData, ApiResponse, ListResponse } from "../types";

interface UsersResponse extends ListResponse<Usuario> {
  users: Usuario[];
}

interface UserResponse extends ApiResponse<Usuario> {
  user: Usuario;
}

export const userService = {
  async getAllUsers(): Promise<{
    users: Usuario[];
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
    user: Usuario | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.post<UserResponse>("/users", userData);

      if (!response) {
        return {
          user: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          user: null,
          error: response.error || "Error al crear usuario",
        };
      }

      return { user: response.user, error: null };
    } catch (error) {
      console.error("Error en createUser:", error);
      return { user: null, error: "Error de conexión con el servidor" };
    }
  },

  async toggleUserStatus(userId: string): Promise<{
    user: Usuario | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.put<UserResponse>(`/users/${userId}/toggle`);

      if (!response) {
        return {
          user: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          user: null,
          error: response.error || "Error al cambiar estado del usuario",
        };
      }

      return { user: response.user, error: null };
    } catch (error) {
      console.error("Error en toggleUserStatus:", error);
      return { user: null, error: "Error de conexión con el servidor" };
    }
  },
};
