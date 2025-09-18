// src/services/apiService.ts
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
  /**
   * Construye headers según el método/cuerpo:
   * - Authorization si existe token
   * - Content-Type solo cuando hay body (evita preflight innecesario en GET/DELETE)
   */
  private getHeaders(hasBody: boolean): HeadersInit {
    const token = localStorage.getItem("authToken");
    const headers: Record<string, string> = {};

    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // IMPORTANTE: no enviar headers de caché en la solicitud (Cache-Control/Pragma/Expires)
    return headers;
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
      console.error(`[API] ${response.status} error on ${endpoint}:`, body);

      const message =
        (body && (body.error || body.message || body.details)) ||
        response.statusText ||
        `HTTP error! status: ${response.status}`;

      throw new ApiError(message, response.status, body);
    }

    // Intentar parsear JSON; si no es JSON, devolver texto
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await this.parseMaybeJson(response)) as T;
  }

  async get<T>(endpoint: string): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] GET ${cleanEndpoint}`);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "GET",
      headers: this.getHeaders(false), // sin Content-Type en GET
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] POST ${cleanEndpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "POST",
      headers: this.getHeaders(true), // con Content-Type
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] PUT ${cleanEndpoint}`, data);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PUT",
      headers: this.getHeaders(true), // con Content-Type
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] PATCH ${cleanEndpoint}`, data);
    const hasBody = data !== undefined;
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(hasBody), // Content-Type solo si hay body
      ...(hasBody ? { body: JSON.stringify(data) } : {}),
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const cleanEndpoint = this.clean(endpoint);
    console.warn(`[API] DELETE ${cleanEndpoint}`);
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(false), // sin Content-Type en DELETE
    });
    return this.handleResponse<T>(res, cleanEndpoint);
  }
}

export const apiService = new ApiService();
