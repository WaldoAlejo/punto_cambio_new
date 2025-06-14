
import { prisma } from "@/lib/prisma";
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
      
      // Buscar usuario por username usando Prisma
      const user = await prisma.usuario.findFirst({
        where: {
          username: credentials.username,
          activo: true
        }
      });

      if (!user) {
        console.log('Usuario no encontrado');
        return { user: null, error: 'Usuario no encontrado' };
      }

      console.log('Usuario encontrado:', user.username);
      
      // Verificar contraseña
      const passwordMatch = await bcrypt.compare(credentials.password, user.password);
      
      if (!passwordMatch) {
        console.log('Contraseña incorrecta');
        return { user: null, error: 'Contraseña incorrecta' };
      }

      console.log('Login exitoso para:', user.username);

      // Remover la contraseña del objeto usuario antes de retornarlo
      const { password, ...userWithoutPassword } = user;
      
      return { 
        user: {
          ...userWithoutPassword,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        } as AuthUser, 
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
      
      const user = await prisma.usuario.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          nombre: userData.nombre,
          correo: userData.correo,
          telefono: userData.telefono,
          rol: userData.rol,
          activo: userData.activo,
          punto_atencion_id: userData.punto_atencion_id
        }
      });

      const { password, ...userWithoutPassword } = user;
      
      return { 
        user: {
          ...userWithoutPassword,
          created_at: user.created_at.toISOString(),
          updated_at: user.updated_at.toISOString()
        } as AuthUser, 
        error: null 
      };
    } catch (error) {
      console.error('Error en createUser:', error);
      return { user: null, error: 'Error al crear usuario' };
    }
  }
};
