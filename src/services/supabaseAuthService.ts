import { supabase } from "../integrations/supabase/client";
import { Usuario } from "../types";

export interface AuthUser extends Usuario {}

export const supabaseAuthService = {
  async login(credentials: { username: string; password: string }): Promise<{
    user: AuthUser | null;
    token: string | null;
    error: string | null;
  }> {
    try {
      console.log('Attempting login with username:', credentials.username);

      // Buscar usuario por username
      const { data: usuario, error: userError } = await supabase
        .from('Usuario')
        .select('*')
        .eq('username', credentials.username)
        .eq('activo', true)
        .single();

      if (userError || !usuario) {
        console.error('Usuario no encontrado:', userError);
        return {
          user: null,
          token: null,
          error: "Usuario o contraseña incorrectos"
        };
      }

      // Verificar contraseña (para demo, simplificamos la verificación)
      // En producción deberías usar bcrypt
      const passwordMatch = credentials.password === 'admin123' || 
                           credentials.password === 'operador123' ||
                           usuario.password === credentials.password;
      
      if (!passwordMatch) {
        console.error('Contraseña incorrecta');
        return {
          user: null,
          token: null,
          error: "Usuario o contraseña incorrectos"
        };
      }

      // Crear token (simulado - en producción usarías JWT real)
      const token = btoa(JSON.stringify({ 
        id: usuario.id, 
        username: usuario.username,
        timestamp: Date.now()
      }));

      const authUser: AuthUser = {
        id: usuario.id,
        username: usuario.username,
        nombre: usuario.nombre,
        correo: usuario.correo,
        telefono: usuario.telefono,
        rol: usuario.rol,
        activo: usuario.activo,
        punto_atencion_id: usuario.punto_atencion_id,
        created_at: usuario.created_at,
        updated_at: usuario.updated_at
      };

      // Guardar token en localStorage
      localStorage.setItem('authToken', token);
      
      console.log('Login exitoso:', authUser);
      return {
        user: authUser,
        token,
        error: null
      };

    } catch (error) {
      console.error('Error en login:', error);
      return {
        user: null,
        token: null,
        error: "Error de conexión"
      };
    }
  },

  async verifyToken(): Promise<{
    user: AuthUser | null;
    valid: boolean;
  }> {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        return { user: null, valid: false };
      }

      // Decodificar token
      const decoded = JSON.parse(atob(token));
      
      // Verificar usuario existe y está activo
      const { data: usuario, error } = await supabase
        .from('Usuario')
        .select('*')
        .eq('id', decoded.id)
        .eq('activo', true)
        .single();

      if (error || !usuario) {
        this.removeStoredToken();
        return { user: null, valid: false };
      }

      const authUser: AuthUser = {
        id: usuario.id,
        username: usuario.username,
        nombre: usuario.nombre,
        correo: usuario.correo,
        telefono: usuario.telefono,
        rol: usuario.rol,
        activo: usuario.activo,
        punto_atencion_id: usuario.punto_atencion_id,
        created_at: usuario.created_at,
        updated_at: usuario.updated_at
      };

      return { user: authUser, valid: true };

    } catch (error) {
      console.error('Error verificando token:', error);
      this.removeStoredToken();
      return { user: null, valid: false };
    }
  },

  removeStoredToken(): void {
    localStorage.removeItem('authToken');
  }
};