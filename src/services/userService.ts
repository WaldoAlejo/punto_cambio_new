
const API_BASE_URL = 'http://localhost:3001/api';

export interface CreateUserData {
  username: string;
  password: string;
  nombre: string;
  correo: string;
  rol: 'SUPER_USUARIO' | 'ADMIN' | 'OPERADOR' | 'CONCESION';
  punto_atencion_id?: string;
}

export const userService = {
  async getAllUsers() {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const data = await response.json();
      
      if (!response.ok) {
        return { users: [], error: data.error };
      }
      
      return { users: data.users, error: null };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [], error: 'Error de conexión con el servidor' };
    }
  },

  async createUser(userData: CreateUserData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        return { user: null, error: data.error };
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error creating user:', error);
      return { user: null, error: 'Error de conexión con el servidor' };
    }
  },

  async toggleUserStatus(userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error toggling user status:', error);
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  }
};
