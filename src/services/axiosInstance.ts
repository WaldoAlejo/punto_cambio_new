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
  timeout: 60000, // 60 segundos (evitar falsos timeouts mientras optimizamos backend)
  // No establecer Content-Type global para evitar preflights en GET/DELETE
});

// Interceptor para adjuntar el token y algunos headers útiles
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      // Solo usar Authorization; no forzar Content-Type salvo que haya body
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    // Evitar enviar Content-Type si no hay body (GET/DELETE)
    const hasBody = !!config.data;
    if (!hasBody) {
      if (config.headers) {
        delete (config.headers as any)["Content-Type"];
      }
    }

    // Header opcional para trazabilidad en logs de servidor (desactivado para evitar CORS)
    // (config.headers as any)["X-Client-Time"] = new Date().toISOString();

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

    // Normalizar mensaje amigable en el propio error para usar en UI (toasts, etc.)
    (error as any).friendlyMessage =
      status === 0 || !status
        ? "No hay conexión con el servidor. Verifica tu red."
        : serverMsg || error.message;

    // Manejar errores de autenticación
    if (status === 401) {
      // Limpiar token inválido
      localStorage.removeItem("authToken");
      localStorage.removeItem("puntoAtencionSeleccionado");

      // Redirigir al login si no estamos ya ahí
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    // Manejo específico por códigos comunes
    switch (status) {
      case 400:
      case 422:
        // Validaciones del backend
        console.error("Validación fallida:", serverMsg);
        break;
      case 403:
        console.error(
          "Acceso denegado:",
          serverMsg || "Permisos insuficientes."
        );
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
        // ✅ Aquí verás el mensaje real (antes veías "Object")
        console.error("Error interno del servidor:", serverMsg);
        break;
      default:
        if (!status) {
          // Timeout o red caida
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
