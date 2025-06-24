
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

interface ErrorResponse {
  response?: {
    status: number;
    statusText: string;
    data: {
      error: string;
    };
  };
  message: string;
}

export const userService = {
  async createUser(data: CreateUserData): Promise<{ user: Usuario | null; error: string | null }> {
    console.warn('=== USER SERVICE - createUser START ===');
    console.warn('Input data:', { ...data, password: '[HIDDEN]' });
    console.warn('Input data JSON:', JSON.stringify({ ...data, password: '[HIDDEN]' }, null, 2));

    try {
      console.warn('Calling apiService.post("/users", data)...');
      const response = await apiService.post<{ user: Usuario; success: boolean }>('/users', data);
      console.warn('createUser - Raw response:', response);
      
      if (response.success) {
        console.warn('createUser - Success! Created user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('createUser - Response indicates failure');
        return { user: null, error: 'Error al crear el usuario' };
      }
    } catch (error) {
      const err = error as ErrorResponse;
      console.error('=== createUser ERROR ===');
      console.error('Error details:', err);
      console.error('Error response data:', err.response?.data);
      console.error('Error response status:', err.response?.status);
      return { user: null, error: err.response?.data?.error || 'Error de conexión al crear usuario' };
    } finally {
      console.warn('=== USER SERVICE - createUser END ===');
    }
  },

  async getAllUsers(): Promise<{ users: Usuario[]; error: string | null }> {
    console.warn('=== USER SERVICE - getAllUsers START ===');
    try {
      console.warn('Checking localStorage tokens...');
      console.warn('Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Not found');
      console.warn('AuthToken in localStorage:', localStorage.getItem('authToken') ? 'Present' : 'Not found');
      
      console.warn('Calling apiService.get("/users")...');
      const response = await apiService.get<{ users: Usuario[]; success: boolean }>('/users');
      console.warn('getAllUsers - Raw response:', response);
      
      if (response.success) {
        console.warn('getAllUsers - Success! Users count:', response.users?.length || 0);
        return { users: response.users, error: null };
      } else {
        console.error('getAllUsers - Response indicates failure');
        return { users: [], error: 'Error al obtener los usuarios' };
      }
    } catch (error) {
      const err = error as ErrorResponse;
      console.error('=== getAllUsers ERROR ===');
      console.error('Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      return { users: [], error: err.response?.data?.error || 'Error de conexión al obtener usuarios' };
    } finally {
      console.warn('=== USER SERVICE - getAllUsers END ===');
    }
  },

  async updateUser(userId: string, data: Partial<CreateUserData>): Promise<{ user: Usuario | null; error: string | null }> {
    console.warn('=== USER SERVICE - updateUser START ===');
    console.warn('User ID:', userId);
    console.warn('Update data:', data);

    try {
      console.warn('Calling apiService.put for user update...');
      const response = await apiService.put<{ user: Usuario; success: boolean }>(`/users/${userId}`, data);
      console.warn('updateUser - Raw response:', response);
      
      if (response.success) {
        console.warn('updateUser - Success! Updated user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('updateUser - Response indicates failure');
        return { user: null, error: 'Error al actualizar el usuario' };
      }
    } catch (error) {
      const err = error as ErrorResponse;
      console.error('=== updateUser ERROR ===');
      console.error('Error details:', err);
      return { user: null, error: err.response?.data?.error || 'Error de conexión al actualizar usuario' };
    } finally {
      console.warn('=== USER SERVICE - updateUser END ===');
    }
  },

  async resetUserPassword(userId: string, password: string): Promise<{ success: boolean; error: string | null }> {
    console.warn('=== USER SERVICE - resetUserPassword START ===');
    console.warn('User ID:', userId);

    try {
      console.warn('Calling apiService.patch for password reset...');
      const response = await apiService.patch<{ success: boolean }>(`/users/${userId}/reset-password`, { password });
      console.warn('resetUserPassword - Raw response:', response);
      
      if (response.success) {
        console.warn('resetUserPassword - Success!');
        return { success: true, error: null };
      } else {
        console.error('resetUserPassword - Response indicates failure');
        return { success: false, error: 'Error al resetear la contraseña' };
      }
    } catch (error) {
      const err = error as ErrorResponse;
      console.error('=== resetUserPassword ERROR ===');
      console.error('Error details:', err);
      return { success: false, error: err.response?.data?.error || 'Error de conexión al resetear contraseña' };
    } finally {
      console.warn('=== USER SERVICE - resetUserPassword END ===');
    }
  },

  async toggleUserStatus(userId: string): Promise<{ user: Usuario | null; error: string | null }> {
    console.warn('=== USER SERVICE - toggleUserStatus START ===');
    console.warn('User ID:', userId);

    try {
      console.warn('Calling apiService.patch for user toggle...');
      const response = await apiService.patch<{ user: Usuario; success: boolean }>(`/users/${userId}/toggle`);
      console.warn('toggleUserStatus - Raw response:', response);
      
      if (response.success) {
        console.warn('toggleUserStatus - Success! Updated user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('toggleUserStatus - Response indicates failure');
        return { user: null, error: 'Error al cambiar el estado del usuario' };
      }
    } catch (error) {
      const err = error as ErrorResponse;
      console.error('=== toggleUserStatus ERROR ===');
      console.error('Error details:', err);
      return { user: null, error: err.response?.data?.error || 'Error de conexión al cambiar estado del usuario' };
    } finally {
      console.warn('=== USER SERVICE - toggleUserStatus END ===');
    }
  }
};
