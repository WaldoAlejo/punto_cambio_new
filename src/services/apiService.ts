import { env } from "../config/environment";

const API_BASE_URL = env.API_URL;

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem("authToken");
    return {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(
    response: Response,
    endpoint: string
  ): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[API] ${response.status} error on ${endpoint}:`,
        errorText
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    console.warn(`[API] GET ${endpoint}`);
    // Remover /api del endpoint si ya está en API_BASE_URL
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(4)
      : endpoint;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] POST ${endpoint}`, data);
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(4)
      : endpoint;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] PUT ${endpoint}`, data);
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(4)
      : endpoint;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    console.warn(`[API] PATCH ${endpoint}`, data);
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(4)
      : endpoint;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async delete<T>(endpoint: string): Promise<T> {
    console.warn(`[API] DELETE ${endpoint}`);
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint.substring(4)
      : endpoint;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }
}

export const apiService = new ApiService();
