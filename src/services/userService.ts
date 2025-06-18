
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
      console.log('Fetching users from API...');
      const response = await apiService.get<UsersResponse>("/users");

      if (!response) {
        console.warn('No response received from users API');
        return {
          users: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Users API response:', response);

      if (response.error || !response.success) {
        console.warn('Users API returned error:', response.error);
        return {
          users: [],
          error: response.error || "Error al obtener usuarios",
        };
      }

      console.log('Users fetched successfully:', response.users?.length || 0);
      return { users: response.users || [], error: null };
    } catch (error) {
      console.error("Error en getAllUsers:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { users: [], error: errorMessage };
    }
  },

  async createUser(userData: CreateUserData): Promise<{
    user: User | null;
    error: string | null;
  }> {
    try {
      console.log('Creating user via API...', userData);
      const response = await apiService.post<CreateUserResponse>("/users", userData);

      if (!response) {
        console.warn('No response received from create user API');
        return {
          user: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Create user API response:', response);

      if (response.error || !response.success) {
        console.warn('Create user API returned error:', response.error);
        return { user: null, error: response.error || "Error al crear usuario" };
      }

      console.log('User created successfully:', response.user);
      return { user: response.user || null, error: null };
    } catch (error) {
      console.error("Error en createUser:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { user: null, error: errorMessage };
    }
  },

  async toggleUserStatus(userId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      console.log('Toggling user status via API...', userId);
      const response = await apiService.put<ToggleUserResponse>(`/users/${userId}/toggle`, {});

      if (!response) {
        console.warn('No response received from toggle user API');
        return {
          success: false,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Toggle user API response:', response);

      if (response.error || !response.success) {
        console.warn('Toggle user API returned error:', response.error);
        return { success: false, error: response.error || "Error al actualizar usuario" };
      }

      console.log('User status toggled successfully');
      return { success: true, error: null };
    } catch (error) {
      console.error("Error en toggleUserStatus:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { success: false, error: errorMessage };
    }
  },
};
