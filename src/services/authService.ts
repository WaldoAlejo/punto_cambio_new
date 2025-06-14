
import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';

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
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('Intentando login con:', credentials.username);
      
      // Buscar usuario por username
      const { data: users, error: queryError } = await supabase
        .from('Usuario')
        .select('*')
        .eq('username', credentials.username)
        .eq('activo', true)
        .limit(1);

      if (queryError) {
        console.error('Error en consulta:', queryError);
        return { user: null, error: 'Error al consultar la base de datos' };
      }

      if (!users || users.length === 0) {
        return { user: null, error: 'Usuario no encontrado' };
      }

      const user = users[0];
      
      // Verificar contraseña
      const passwordMatch = await bcrypt.compare(credentials.password, user.password);
      
      if (!passwordMatch) {
        return { user: null, error: 'Contraseña incorrecta' };
      }

      // Remover la contraseña del objeto usuario antes de retornarlo
      const { password, ...userWithoutPassword } = user;
      
      return { 
        user: userWithoutPassword as AuthUser, 
        error: null 
      };
    } catch (error) {
      console.error('Error en login:', error);
      return { user: null, error: 'Error interno del servidor' };
    }
  },

  async createUser(userData: Omit<AuthUser, 'id' | 'created_at' | 'updated_at'> & { password: string }) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const { data, error } = await supabase
        .from('Usuario')
        .insert([{
          username: userData.username,
          password: hashedPassword,
          nombre: userData.nombre,
          correo: userData.correo,
          telefono: userData.telefono,
          rol: userData.rol,
          activo: userData.activo,
          punto_atencion_id: userData.punto_atencion_id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creando usuario:', error);
        return { user: null, error: error.message };
      }

      const { password, ...userWithoutPassword } = data;
      return { user: userWithoutPassword as AuthUser, error: null };
    } catch (error) {
      console.error('Error en createUser:', error);
      return { user: null, error: 'Error al crear usuario' };
    }
  }
};
