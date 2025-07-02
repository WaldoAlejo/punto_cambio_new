import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authService, AuthUser } from "../services/authService";
import { PuntoAtencion } from "../types";

// Contexto de autenticación
interface AuthContextType {
  user: AuthUser | null;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  selectedPoint: PuntoAtencion | null;
  setSelectedPoint: (point: PuntoAtencion | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPoint, setSelectedPointState] = useState<PuntoAtencion | null>(
    null
  );

  // Leer punto de atención de localStorage al iniciar
  useEffect(() => {
    const storedPoint = localStorage.getItem("puntoAtencionSeleccionado");
    if (storedPoint) {
      setSelectedPointState(JSON.parse(storedPoint));
    }
  }, []);

  // Sincronizar con localStorage cada vez que cambie
  useEffect(() => {
    if (selectedPoint) {
      localStorage.setItem(
        "puntoAtencionSeleccionado",
        JSON.stringify(selectedPoint)
      );
    } else {
      localStorage.removeItem("puntoAtencionSeleccionado");
    }
  }, [selectedPoint]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { user: verifiedUser, valid } = await authService.verifyToken();
        if (valid && verifiedUser) {
          setUser(verifiedUser);
        } else {
          authService.removeStoredToken();
        }
      } catch  {
        authService.removeStoredToken();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const {
        user: loggedUser,
        token,
        error,
      } = await authService.login({ username, password });
      if (loggedUser && token) {
        setUser(loggedUser);
        return { success: true };
      } else {
        return { success: false, error: error || "Error de autenticación" };
      }
    } catch  {
      return { success: false, error: "Error de conexión" };
    }
  };

  const logout = () => {
    authService.removeStoredToken();
    setUser(null);
    setSelectedPointState(null);
    localStorage.removeItem("puntoAtencionSeleccionado");
  };

  const setSelectedPoint = (point: PuntoAtencion | null) => {
    setSelectedPointState(point);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading,
        selectedPoint,
        setSelectedPoint,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
