
const API_BASE_URL = "http://localhost:3001/api";

// Función para obtener el token de autenticación
const getAuthToken = (): string | null => {
  return localStorage.getItem("authToken");
};

// Función para manejar respuestas HTTP
const handleResponse = async <T>(response: Response): Promise<T | null> => {
  if (response.status === 401) {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`HTTP Error ${response.status}:`, errorText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
};

// Servicio API genérico
export const apiService = {
  async get<T>(endpoint: string): Promise<T | null> {
    try {
      console.log(`GET request to: ${API_BASE_URL}${endpoint}`);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
      return await handleResponse<T>(response);
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T | null> {
    try {
      console.log(`POST request to: ${API_BASE_URL}${endpoint}`, data);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      return await handleResponse<T>(response);
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T | null> {
    try {
      console.log(`PUT request to: ${API_BASE_URL}${endpoint}`, data);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "PUT",
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      return await handleResponse<T>(response);
    } catch (error) {
      console.error(`Error in PUT ${endpoint}:`, error);
      throw error;
    }
  },

  async delete<T>(endpoint: string): Promise<T | null> {
    try {
      console.log(`DELETE request to: ${API_BASE_URL}${endpoint}`);
      
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "DELETE",
        headers,
      });

      return await handleResponse<T>(response);
    } catch (error) {
      console.error(`Error in DELETE ${endpoint}:`, error);
      throw error;
    }
  },
};
