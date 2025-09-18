import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { authService, AuthUser } from "../services/authService";
import { scheduleService } from "../services/scheduleService";
import { pointService } from "../services/pointService";
import { PuntoAtencion } from "../types";
import {
  validateAndTransformUser,
  validateAndTransformPuntoAtencion,
} from "../utils/typeValidation";

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
  const didInit = useRef(false); // evita dobles llamados por StrictMode

  // === Cargar punto seleccionado desde localStorage ===
  useEffect(() => {
    const storedPoint = localStorage.getItem("puntoAtencionSeleccionado");
    if (storedPoint) {
      try {
        const parsed = JSON.parse(storedPoint);
        const safe = validateAndTransformPuntoAtencion
          ? validateAndTransformPuntoAtencion(parsed)
          : (parsed as PuntoAtencion);
        setSelectedPointState(safe);
      } catch {
        localStorage.removeItem("puntoAtencionSeleccionado");
      }
    }
  }, []);

  // === Persistir punto seleccionado ===
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

  // === Helper: cargar punto según rol/usuario ===
  const resolvePointForUser = async (u: AuthUser) => {
    try {
      // Si ya hay uno guardado en localStorage, no haces nada.
      const storedPoint = localStorage.getItem("puntoAtencionSeleccionado");
      if (storedPoint) return;

      // ADMIN / SUPER_USUARIO: usar su punto principal si existe
      if (
        (u.rol === "ADMIN" || u.rol === "SUPER_USUARIO") &&
        u.punto_atencion_id
      ) {
        const { points } = await pointService.getAllPoints();
        const adminPoint = points.find((p) => p.id === u.punto_atencion_id);
        if (adminPoint) {
          const safe = validateAndTransformPuntoAtencion
            ? validateAndTransformPuntoAtencion(adminPoint)
            : (adminPoint as PuntoAtencion);
          setSelectedPointState(safe);
          return;
        }
      }

      // OPERADOR: usar jornada activa
      if (u.rol === "OPERADOR") {
        const res = await scheduleService.getActiveSchedule();
        if (res?.schedule?.puntoAtencion) {
          const safe = validateAndTransformPuntoAtencion
            ? validateAndTransformPuntoAtencion(res.schedule.puntoAtencion)
            : (res.schedule.puntoAtencion as PuntoAtencion);
          setSelectedPointState(safe);
          return;
        }
      }

      // CONCESION: punto asignado
      if (u.rol === "CONCESION" && u.punto_atencion_id) {
        const { points } = await pointService.getAllPoints();
        const concesionPoint = points.find((p) => p.id === u.punto_atencion_id);
        if (concesionPoint) {
          const safe = validateAndTransformPuntoAtencion
            ? validateAndTransformPuntoAtencion(concesionPoint)
            : (concesionPoint as PuntoAtencion);
          setSelectedPointState(safe);
          return;
        }
      }
    } catch (e) {
      // No rompas la sesión por fallas aquí
      console.warn("resolvePointForUser error:", e);
    }
  };

  // === Inicialización / verificación de token con reintentos ===
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const initializeAuth = async () => {
      const token = authService.getStoredToken?.();
      // Si hay token, mantenemos al usuario provisional mientras verificamos
      if (token) setUser((prev) => prev ?? ({} as any));

      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          const {
            user: verifiedUser,
            valid,
            error,
          } = await authService.verifyToken();

          if (valid && verifiedUser) {
            const safeUser = validateAndTransformUser
              ? validateAndTransformUser(verifiedUser)
              : (verifiedUser as AuthUser);

            setUser(safeUser);
            await resolvePointForUser(safeUser);
            setIsLoading(false);
            return;
          }

          // Si backend confirma token inválido/expirado → limpiar y salir
          if (
            error === "Token inválido o expirado" ||
            error === "Usuario inactivo"
          ) {
            authService.removeStoredToken?.();
            setUser(null);
            setSelectedPointState(null);
            localStorage.removeItem("puntoAtencionSeleccionado");
            setIsLoading(false);
            return;
          }

          // Errores no concluyentes: reintentar con backoff
          await new Promise((r) => setTimeout(r, 500 * attempt * attempt));
        } catch (e) {
          // Timeouts / red: reintentar
          await new Promise((r) => setTimeout(r, 500 * attempt * attempt));
        }
      }

      // Si no hubo confirmación pero existe token, no limpies: modo “offline”
      if (token) {
        setUser((prev) => prev ?? ({} as any));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // === Login ===
  const login = async (username: string, password: string) => {
    try {
      const {
        user: loggedUser,
        token,
        error,
      } = await authService.login({ username, password });

      if (loggedUser && token) {
        const safeUser = validateAndTransformUser
          ? validateAndTransformUser(loggedUser)
          : (loggedUser as AuthUser);

        setUser(safeUser);
        await resolvePointForUser(safeUser);
        return { success: true };
      } else {
        return { success: false, error: error || "Error de autenticación" };
      }
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  // === Logout ===
  const logout = () => {
    authService.removeStoredToken?.();
    setUser(null);
    setSelectedPointState(null);
    localStorage.removeItem("puntoAtencionSeleccionado");
  };

  const setSelectedPoint = (point: PuntoAtencion | null) => {
    try {
      const safe =
        point && validateAndTransformPuntoAtencion
          ? validateAndTransformPuntoAtencion(point)
          : point;
      setSelectedPointState(safe as PuntoAtencion | null);
    } catch {
      // Si falla validación, no guardes nada (evita estado corrupto)
      console.warn("setSelectedPoint: punto inválido");
    }
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
