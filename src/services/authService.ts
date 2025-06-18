
const API_BASE_URL = 'http://localhost:3001/api';

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
  rol: 'SUPER_USUARIO' | 'ADMIN' | 'OPERADOR' | 'CONCESION';
  activo: boolean;
  punto_atencion_id?: string;
  created_at: string;
  updated_at: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser | null; token: string | null; error: string | null }> {
    try {
      console.log('Intentando login con:', credentials.username);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('Error en login:', data.error);
        return { user: null, token: null, error: data.error };
      }

      console.log('Login exitoso para:', data.user.username);
      
      // Guardar token en localStorage
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      
      return { user: data.user, token: data.token, error: null };
    } catch (error) {
      console.error('Error en login:', error);
      return { user: null, token: null, error: 'Error de conexión con el servidor' };
    }
  },

  getStoredToken(): string | null {
    return localStorage.getItem('authToken');
  },

  removeStoredToken(): void {
    localStorage.removeItem('authToken');
  }
};
