
const API_BASE_URL = "http://localhost:3001/api";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  rol: "SUPER_USUARIO" | "ADMIN" | "OPERADOR" | "CONCESION";
  activo: boolean;
  punto_atencion_id?: string;
  created_at: string;
  updated_at: string;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
  success: boolean;
  error?: string;
}

interface TokenVerificationResponse {
  user: AuthUser | null;
  valid: boolean;
  error?: string;
}

export const authService = {
  async login(
    credentials: LoginCredentials
  ): Promise<{
    user: AuthUser | null;
    token: string | null;
    error: string | null;
  }> {
    try {
      console.log("Intentando login con:", credentials.username);
      console.log("Making request to:", `${API_BASE_URL}/auth/login`);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify(credentials),
      });

      console.log("Login response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Login HTTP error:", response.status, errorText);
        
        if (response.status >= 500) {
          return {
            user: null,
            token: null,
            error: "Error interno del servidor. Verifique que el servidor esté ejecutándose.",
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
      console.log("Login response data:", data);

      if (!data.success || !data.user || !data.token) {
        console.log("Error en login:", data.error);
        return {
          user: null,
          token: null,
          error: data.error || "Credenciales incorrectas",
        };
      }

      console.log("Login exitoso para:", data.user.username);

      // Guardar token en localStorage
      localStorage.setItem("authToken", data.token);

      return { user: data.user, token: data.token, error: null };
    } catch (error) {
      console.error("Error en login:", error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          user: null,
          token: null,
          error: "Error de conexión con el servidor. Verifique que el servidor esté ejecutándose en http://localhost:3001",
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

      console.log("Verificando token...");
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
      });

      if (response.status === 401 || response.status === 403) {
        console.log("Token inválido o expirado");
        return { user: null, valid: false, error: "Token invalid" };
      }

      if (!response.ok) {
        console.error("Error verificando token:", response.status);
        return { user: null, valid: false, error: "Verification failed" };
      }

      const data = await response.json();
      console.log("Token verificado exitosamente");
      return { user: data.user, valid: true };
    } catch (error) {
      console.error("Error verificando token:", error);
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
