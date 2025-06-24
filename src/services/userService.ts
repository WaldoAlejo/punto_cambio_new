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
    console.log('=== USER SERVICE - createUser START ===');
    console.log('Input data:', { ...data, password: '[HIDDEN]' });
    console.log('Input data JSON:', JSON.stringify({ ...data, password: '[HIDDEN]' }, null, 2));

    try {
      console.log('Calling apiService.post("/users", data)...');
      const response = await apiService.post<{ user: Usuario; success: boolean }>('/users', data);
      console.log('createUser - Raw response:', response);
      
      if (response.success) {
        console.log('createUser - Success! Created user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('createUser - Response indicates failure');
        return { user: null, error: 'Error al crear el usuario' };
      }
    } catch (error: any) {
      console.error('=== createUser ERROR ===');
      console.error('Error details:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      return { user: null, error: error.response?.data?.error || 'Error de conexión al crear usuario' };
    } finally {
      console.log('=== USER SERVICE - createUser END ===');
    }
  },

  async getAllUsers(): Promise<{ users: Usuario[]; error: string | null }> {
    console.log('=== USER SERVICE - getAllUsers START ===');
    try {
      console.log('Checking localStorage tokens...');
      console.log('Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Not found');
      console.log('AuthToken in localStorage:', localStorage.getItem('authToken') ? 'Present' : 'Not found');
      
      console.log('Calling apiService.get("/users")...');
      const response = await apiService.get<{ users: Usuario[]; success: boolean }>('/users');
      console.log('getAllUsers - Raw response:', response);
      
      if (response.success) {
        console.log('getAllUsers - Success! Users count:', response.users?.length || 0);
        return { users: response.users, error: null };
      } else {
        console.error('getAllUsers - Response indicates failure');
        return { users: [], error: 'Error al obtener los usuarios' };
      }
    } catch (error: any) {
      console.error('=== getAllUsers ERROR ===');
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      return { users: [], error: error.response?.data?.error || 'Error de conexión al obtener usuarios' };
    } finally {
      console.log('=== USER SERVICE - getAllUsers END ===');
    }
  },

  async updateUser(userId: string, data: Partial<CreateUserData>): Promise<{ user: Usuario | null; error: string | null }> {
    console.log('=== USER SERVICE - updateUser START ===');
    console.log('User ID:', userId);
    console.log('Update data:', data);

    try {
      console.log('Calling apiService.put for user update...');
      const response = await apiService.put<{ user: Usuario; success: boolean }>(`/users/${userId}`, data);
      console.log('updateUser - Raw response:', response);
      
      if (response.success) {
        console.log('updateUser - Success! Updated user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('updateUser - Response indicates failure');
        return { user: null, error: 'Error al actualizar el usuario' };
      }
    } catch (error: any) {
      console.error('=== updateUser ERROR ===');
      console.error('Error details:', error);
      return { user: null, error: error.response?.data?.error || 'Error de conexión al actualizar usuario' };
    } finally {
      console.log('=== USER SERVICE - updateUser END ===');
    }
  },

  async resetUserPassword(userId: string, password: string): Promise<{ success: boolean; error: string | null }> {
    console.log('=== USER SERVICE - resetUserPassword START ===');
    console.log('User ID:', userId);

    try {
      console.log('Calling apiService.patch for password reset...');
      const response = await apiService.patch<{ success: boolean }>(`/users/${userId}/reset-password`, { password });
      console.log('resetUserPassword - Raw response:', response);
      
      if (response.success) {
        console.log('resetUserPassword - Success!');
        return { success: true, error: null };
      } else {
        console.error('resetUserPassword - Response indicates failure');
        return { success: false, error: 'Error al resetear la contraseña' };
      }
    } catch (error: any) {
      console.error('=== resetUserPassword ERROR ===');
      console.error('Error details:', error);
      return { success: false, error: error.response?.data?.error || 'Error de conexión al resetear contraseña' };
    } finally {
      console.log('=== USER SERVICE - resetUserPassword END ===');
    }
  },

  async toggleUserStatus(userId: string): Promise<{ user: Usuario | null; error: string | null }> {
    console.log('=== USER SERVICE - toggleUserStatus START ===');
    console.log('User ID:', userId);

    try {
      console.log('Calling apiService.patch for user toggle...');
      const response = await apiService.patch<{ user: Usuario; success: boolean }>(`/users/${userId}/toggle`);
      console.log('toggleUserStatus - Raw response:', response);
      
      if (response.success) {
        console.log('toggleUserStatus - Success! Updated user:', response.user);
        return { user: response.user, error: null };
      } else {
        console.error('toggleUserStatus - Response indicates failure');
        return { user: null, error: 'Error al cambiar el estado del usuario' };
      }
    } catch (error: any) {
      console.error('=== toggleUserStatus ERROR ===');
      console.error('Error details:', error);
      return { user: null, error: error.response?.data?.error || 'Error de conexión al cambiar estado del usuario' };
    } finally {
      console.log('=== USER SERVICE - toggleUserStatus END ===');
    }
  }
};
