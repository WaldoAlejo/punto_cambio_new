// src/services/axiosInstance.ts
import axios from "axios";

const getToken = () => localStorage.getItem("authToken");

const axiosInstance = axios.create({
  baseURL: "/", // o pon el API_BASE_URL solo si NO usas proxy en Vite/React
});

// Interceptor para adjuntar el token en cada petición
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
