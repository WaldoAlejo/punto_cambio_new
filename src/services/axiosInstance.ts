import axios, { AxiosError, AxiosResponse } from "axios";
import { env } from "@/config/environment";

const getToken = (): string | null => localStorage.getItem("authToken");

const axiosInstance = axios.create({
  baseURL: env.API_URL,
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adjuntar el token en cada petición
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log de requests en desarrollo
    if (env.IS_DEVELOPMENT) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error("Error en request interceptor:", error);
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log de responses exitosas en desarrollo
    if (env.IS_DEVELOPMENT) {
      console.log(
        `✅ ${response.config.method?.toUpperCase()} ${response.config.url}`,
        {
          status: response.status,
          data: response.data,
        }
      );
    }
    return response;
  },
  (error: AxiosError) => {
    // Log de errores
    if (env.IS_DEVELOPMENT) {
      console.error(
        `❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        }
      );
    }

    // Manejar errores de autenticación
    if (error.response?.status === 401) {
      // Limpiar token inválido
      localStorage.removeItem("authToken");
      localStorage.removeItem("puntoAtencionSeleccionado");

      // Redirigir al login si no estamos ya ahí
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    // Manejar errores de servidor
    if (error.response?.status === 500) {
      console.error("Error interno del servidor:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
