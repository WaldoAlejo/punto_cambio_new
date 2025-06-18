
import { authService } from "./authService";

const API_BASE_URL = "http://localhost:3001/api";

class ApiService {
  private getAuthHeaders() {
    const token = authService.getStoredToken();
    return {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async get<T>(endpoint: string): Promise<T | null> {
    try {
      console.log(`Making GET request to: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
        cache: "no-store",
      });

      if (response.status === 401) {
        console.warn("Unauthorized request, removing token");
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error de respuesta del servidor" }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: T = await response.json();
      console.log(`Response for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  }

  async post<T>(endpoint: string, data: unknown): Promise<T | null> {
    try {
      console.log(`Making POST request to: ${API_BASE_URL}${endpoint}`, data);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
        cache: "no-store",
      });

      if (response.status === 401) {
        console.warn("Unauthorized request, removing token");
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error de respuesta del servidor" }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData: T = await response.json();
      console.log(`Response for POST ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  }

  async put<T>(endpoint: string, data: unknown): Promise<T | null> {
    try {
      console.log(`Making PUT request to: ${API_BASE_URL}${endpoint}`, data);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
        cache: "no-store",
      });

      if (response.status === 401) {
        console.warn("Unauthorized request, removing token");
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error de respuesta del servidor" }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData: T = await response.json();
      console.log(`Response for PUT ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in PUT ${endpoint}:`, error);
      throw error;
    }
  }

  async delete<T>(endpoint: string): Promise<T | null> {
    try {
      console.log(`Making DELETE request to: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
        cache: "no-store",
      });

      if (response.status === 401) {
        console.warn("Unauthorized request, removing token");
        authService.removeStoredToken();
        window.location.href = "/login";
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error de respuesta del servidor" }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData: T = await response.json();
      console.log(`Response for DELETE ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in DELETE ${endpoint}:`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
