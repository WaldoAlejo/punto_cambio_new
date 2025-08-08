import { authService } from "@/services/authService";

// Configuración base para las llamadas a la API
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://35.238.95.118:3001/api";

export const apiClient = {
  async get<TResponse = unknown>(endpoint: string): Promise<TResponse | null> {
    try {
      console.log(`Making GET request to: ${API_BASE_URL}${endpoint}`);

      const token = authService.getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers,
      });

      if (response.status === 401) {
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      const data = await response.json();
      console.log(`Response for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  },

  async post<TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse | null> {
    try {
      console.log(`Making POST request to: ${API_BASE_URL}${endpoint}`, data);

      const token = authService.getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (response.status === 401) {
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      const responseData = await response.json();
      console.log(`Response for POST ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  },
};
