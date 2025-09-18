import axios, { AxiosError, AxiosResponse } from "axios";
import { env } from "@/config/environment";

const getToken = (): string | null => localStorage.getItem("authToken");

/** Extrae un mensaje legible desde cualquier payload del backend */
function extractServerMessage(data: unknown): string {
  if (!data) return "Sin detalle";
  if (typeof data === "string") return data;

  // Intentos comunes
  const maybe = data as any;
  if (typeof maybe.message === "string") return maybe.message;
  if (typeof maybe.error === "string") return maybe.error;
  if (Array.isArray(maybe.errors)) {
    // e.g. [{ message: '...' }, '...']
    const parts = maybe.errors
      .map((e: any) =>
        typeof e === "string"
          ? e
          : typeof e?.message === "string"
          ? e.message
          : JSON.stringify(e)
      )
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }
  if (Array.isArray(maybe.details)) {
    const parts = maybe.details
      .map((d: any) => d?.message || d?.detail || JSON.stringify(d))
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }

  try {
    return JSON.stringify(maybe);
  } catch {
    return String(maybe);
  }
}

export const axiosInstance = axios.create({
  baseURL: env.API_URL,
  timeout: 30000, // 30s → si el back corta antes (statement_timeout), la UX no se bloquee
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adjuntar el token y algunos headers útiles
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Header opcional para trazabilidad en logs de servidor
    (config.headers as any)["X-Client-Time"] = new Date().toISOString();

    // Log de requests en desarrollo
    if (env.IS_DEVELOPMENT) {
      console.log(
        `🚀 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        {
          params: config.params,
          data: config.data,
        }
      );
    }

    return config;
  },
  (error: AxiosError) => {
    console.error("Error en request interceptor:", error.message);
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log de responses exitosas en desarrollo
    if (env.IS_DEVELOPMENT) {
      console.log(
        `✅ ${response.config.method?.toUpperCase()} ${
          response.config.baseURL
        }${response.config.url}`,
        {
          status: response.status,
          data: response.data,
        }
      );
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const serverMsg = extractServerMessage(payload);
    const method = error.config?.method?.toUpperCase();
    const url = `${error.config?.baseURL || ""}${error.config?.url || ""}`;

    // Log enriquecido en desarrollo
    if (env.IS_DEVELOPMENT) {
      if (status) {
        console.error(`❌ ${method} ${url} [${status}]`, {
          message: serverMsg,
          data: payload,
        });
      } else if ((error as any).code === "ECONNABORTED") {
        console.error(`⏱️ Timeout ${method} ${url}`, {
          message: error.message,
        });
      } else if (!error.response) {
        console.error(`📡 Error de red ${method} ${url}`, {
          message: error.message,
        });
      } else {
        console.error(`❌ ${method} ${url}`, { message: error.message });
      }
    }

    // Normalizar mensaje amigable para UI (toasts, banners)
    (error as any).friendlyMessage =
      status === 0 || !status
        ? "No hay conexión con el servidor. Verifica tu red."
        : serverMsg || error.message;

    // === Manejo de autenticación: tratar 401 y 403 ===
    // Solo cerramos sesión si el backend confirma que el token no sirve y es un endpoint de /auth
    if (status === 401 || status === 403) {
      const urlStr = `${error.config?.baseURL || ""}${error.config?.url || ""}`;
      const isAuthEndpoint =
        urlStr.includes("/auth/verify") || urlStr.includes("/auth/login");
      if (isAuthEndpoint) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("puntoAtencionSeleccionado");
        const isOnLogin = window.location.pathname.includes("/login");
        if (!isOnLogin) {
          window.location.href = "/login";
        }
      } else {
        console.warn("401/403 en endpoint no-auth, manteniendo sesión.", {
          url: urlStr,
        });
      }
      return Promise.reject(error);
    }

    // Manejo específico por códigos comunes (no afectan sesión)
    switch (status) {
      case 400:
      case 422:
        console.error("Validación fallida:", serverMsg);
        break;
      case 404:
        console.error("No encontrado:", serverMsg || "Recurso no encontrado.");
        break;
      case 409:
        console.error(
          "Conflicto:",
          serverMsg || "Conflicto al procesar la petición."
        );
        break;
      case 429:
        console.error(
          "Demasiadas solicitudes:",
          serverMsg || "Intenta nuevamente más tarde."
        );
        break;
      case 500:
        // ✅ Verás el mensaje real del servidor
        console.error("Error interno del servidor:", serverMsg);
        break;
      default:
        if (!status) {
          // Timeout o red caída, NO tocar sesión
          if ((error as any).code === "ECONNABORTED") {
            console.error("La petición excedió el tiempo de espera.");
          } else {
            console.error("Error de red o sin respuesta del servidor.");
          }
        }
        break;
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
