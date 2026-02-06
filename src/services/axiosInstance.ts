import axios, { AxiosError, AxiosResponse } from "axios";
import { env } from "@/config/environment";

const getToken = (): string | null => localStorage.getItem("authToken");

/** Extrae un mensaje legible desde cualquier payload del backend */
function extractServerMessage(data: unknown): string {
  if (!data) return "Sin detalle";
  if (typeof data === "string") return data;

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;

  // Intentos comunes
  if (isRecord(data)) {
    const message = data["message"];
    if (typeof message === "string") return message;
    const error = data["error"];
    if (typeof error === "string") return error;
  }

  if (isRecord(data) && Array.isArray(data["errors"])) {
    // e.g. [{ message: '...' }, '...']
    const errors = data["errors"] as unknown[];
    const parts = errors
      .map((e: unknown) => {
        if (typeof e === "string") return e;
        if (isRecord(e)) {
          const msg = e["message"];
          if (typeof msg === "string") return msg;
        }
        try {
          return JSON.stringify(e);
        } catch {
          return String(e);
        }
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }

  if (isRecord(data) && Array.isArray(data["details"])) {
    const details = data["details"] as unknown[];
    const parts = details
      .map((d: unknown) => {
        if (isRecord(d)) {
          const msg = d["message"];
          if (typeof msg === "string") return msg;
          const detail = d["detail"];
          if (typeof detail === "string") return detail;
        }
        try {
          return JSON.stringify(d);
        } catch {
          return String(d);
        }
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
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
      const headers =
        config.headers && typeof config.headers === "object"
          ? (config.headers as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      headers["Authorization"] = `Bearer ${token}`;
      config.headers = headers;
    }

    // Evitar enviar Content-Type si no hay body (GET/DELETE)
    const hasBody = !!config.data;
    if (!hasBody) {
      if (config.headers) {
        const headers = config.headers as Record<string, unknown>;
        delete headers["Content-Type"];
        delete headers["content-type"];
      }
    }

    // Header opcional para trazabilidad en logs de servidor (desactivado para evitar CORS)
    // (config.headers as any)["X-Client-Time"] = new Date().toISOString();

    // Log de requests en desarrollo
    if (env.IS_DEVELOPMENT) {
      console.warn(
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
      console.warn(
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
    type AxiosErrorWithFriendlyMessage = AxiosError & {
      friendlyMessage?: string;
    };

    const err = error as AxiosErrorWithFriendlyMessage;
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
      } else if (error.code === "ECONNABORTED") {
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
    err.friendlyMessage =
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
          if (error.code === "ECONNABORTED") {
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
