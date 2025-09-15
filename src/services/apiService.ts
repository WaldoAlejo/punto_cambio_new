import { env } from "../config/environment";

const API_BASE_URL = env.API_URL;

export class ApiError extends Error {
  status: number;
  payload?: any;
  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem("authToken");
    return {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async parseMaybeJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text || null;
    }
  }

  private clean(endpoint: string) {
    return endpoint.startsWith("/api/") ? endpoint.substring(4) : endpoint;
  }

  private async handleResponse<T>(
    response: Response,
    endpoint: string
  ): Promise<T> {
    if (!response.ok) {
      const body = await this.parseMaybeJson(response);
      // Log con el cuerpo real del error del backend
      console.error(`[API] ${response.status} error on ${endpoint}:`, body);

      const message =
        (body && (body.error || body.message || body.details)) ||
        response.statusText ||
        `HTTP error! status: ${response.status}`;

      throw new ApiError(message, response.status, body);
    }
    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] GET ${cleanEndpoint}`);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] POST ${cleanEndpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] PUT ${cleanEndpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] PATCH ${cleanEndpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] DELETE ${cleanEndpoint}`);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }
}

export const apiService = new ApiService();
