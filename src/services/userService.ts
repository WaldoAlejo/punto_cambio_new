
import { apiService } from './apiService';
import { Usuario } from '../types';

export interface CreateUserData {
  username: string;
  password: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  rol: 'SUPER_USUARIO' | 'ADMIN' | 'OPERADOR' | 'CONCESION';
  punto_atencion_id?: string;
}

export const userService = {
  async createUser(data: CreateUserData): Promise<{ user: Usuario | null; error: string | null }> {
    try {
      console.log('Creating user:', { ...data, password: '[HIDDEN]' });
      const response = await apiService.post<{ user: Usuario; success: boolean }>('/users', data);
      
      if (response.success) {
        return { user: response.user, error: null };
      } else {
        return { user: null, error: 'Error al crear el usuario' };
      }
    } catch (error) {
      console.error('Error creating user:', error);
      return { user: null, error: 'Error de conexión al crear usuario' };
    }
  },

  async getAllUsers(): Promise<{ users: Usuario[]; error: string | null }> {
    try {
      console.log('Fetching all users');
      const response = await apiService.get<{ users: Usuario[]; success: boolean }>('/users');
      
      if (response.success) {
        return { users: response.users, error: null };
      } else {
        return { users: [], error: 'Error al obtener los usuarios' };
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [], error: 'Error de conexión al obtener usuarios' };
    }
  },

  async toggleUserStatus(userId: string): Promise<{ user: Usuario | null; error: string | null }> {
    try {
      console.log('Toggling user status:', userId);
      const response = await apiService.patch<{ user: Usuario; success: boolean }>(`/users/${userId}/toggle`);
      
      if (response.success) {
        return { user: response.user, error: null };
      } else {
        return { user: null, error: 'Error al cambiar el estado del usuario' };
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      return { user: null, error: 'Error de conexión al cambiar estado del usuario' };
    }
  }
};
