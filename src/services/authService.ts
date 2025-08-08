import { env } from "../config/environment";

const API_BASE_URL = env.API_URL;

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION";
  activo: boolean;
  punto_atencion_id?: string | null;
  created_at: string;
  updated_at: string;
  // Campos adicionales del login
  jornada_id?: string | null;
  hasActiveJornada?: boolean;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
  success: boolean;
  hasActiveJornada?: boolean;
  timestamp?: string;
  error?: string;
}

interface TokenVerificationResponse {
  user: AuthUser | null;
  valid: boolean;
  error?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{
    user: AuthUser | null;
    token: string | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        if (response.status >= 500) {
          return {
            user: null,
            token: null,
            error:
              "Error interno del servidor. Verifique que el servidor esté ejecutándose.",
          };
        }
        if (response.status === 401) {
          return {
            user: null,
            token: null,
            error: "Credenciales incorrectas. Verifique usuario y contraseña.",
          };
        }
        return {
          user: null,
          token: null,
          error: "Error de conexión o credenciales incorrectas",
        };
      }

      const data: Partial<LoginResponse> = await response.json();

      if (!data.success || !data.user || !data.token) {
        return {
          user: null,
          token: null,
          error: data.error || "Credenciales incorrectas",
        };
      }

      // Guardar token en localStorage
      localStorage.setItem("authToken", data.token);

      return { user: data.user, token: data.token, error: null };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          user: null,
          token: null,
          error:
            "Error de conexión con el servidor. Verifique que el servidor esté ejecutándose correctamente.",
        };
      }
      return {
        user: null,
        token: null,
        error: "Error de conexión con el servidor",
      };
    }
  },

  async verifyToken(): Promise<TokenVerificationResponse> {
    try {
      const token = this.getStoredToken();
      if (!token) {
        return { user: null, valid: false, error: "No token found" };
      }
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (response.status === 401 || response.status === 403) {
        return { user: null, valid: false, error: "Token inválido o expirado" };
      }

      if (!response.ok) {
        return { user: null, valid: false, error: "Error verificando token" };
      }

      const data = await response.json();
      return { user: data.user, valid: true };
    } catch {
      return { user: null, valid: false, error: "Network error" };
    }
  },

  getStoredToken(): string | null {
    return localStorage.getItem("authToken");
  },

  removeStoredToken(): void {
    localStorage.removeItem("authToken");
  },
};
