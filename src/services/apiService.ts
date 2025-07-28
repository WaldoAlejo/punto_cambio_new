
const API_BASE_URL = import.meta.env.VITE_API_URL;


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
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, endpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] POST ${endpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, endpoint);
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] PUT ${endpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, endpoint);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    console.warn(`[API] PATCH ${endpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return this.handleResponse<T>(res, endpoint);
  }

  async delete<T>(endpoint: string): Promise<T> {
    console.warn(`[API] DELETE ${endpoint}`);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, endpoint);
  }
}

export const apiService = new ApiService();
