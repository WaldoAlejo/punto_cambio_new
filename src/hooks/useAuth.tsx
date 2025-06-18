
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthUser, LoginCredentials } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un token guardado al cargar la página
    const checkStoredAuth = async () => {
      try {
        const token = authService.getStoredToken();
        if (token) {
          // Aquí podrías hacer una verificación del token con el servidor
          // Por ahora, solo verificamos que exista
          console.log('Token encontrado en localStorage');
        }
      } catch (error) {
        console.error('Error verificando token:', error);
        authService.removeStoredToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkStoredAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const result = await authService.login({ username, password });
      
      if (result.user && result.token) {
        setUser(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Error desconocido' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.removeStoredToken();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
