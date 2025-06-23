
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthUser } from '../services/authService';

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
    const checkStoredAuth = async () => {
      try {
        const token = authService.getStoredToken();
        if (token) {
          console.log('Token encontrado, verificando validez...');
          // Verificar token con el servidor
          const verificationResult = await authService.verifyToken();
          if (verificationResult.user) {
            setUser(verificationResult.user);
            console.log('Usuario autenticado:', verificationResult.user.username);
          } else {
            console.log('Token inválido, removiendo...');
            authService.removeStoredToken();
          }
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
        console.log('Login exitoso para:', result.user.username);
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
    console.log('Usuario desconectado');
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
