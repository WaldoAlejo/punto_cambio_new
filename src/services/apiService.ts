import { env } from "../config/environment";

const API_BASE_URL = env.API_URL;

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem("authToken");
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** Une base y endpoint evitando // o faltas de / */
  private buildUrl(endpoint: string): string {
    const cleanBase = (API_BASE_URL || "").replace(/\/+$/, "");
    const cleanEndpoint = endpoint.replace(/^\/+/, "");
    return `${cleanBase}/${cleanEndpoint}`;
  }

  /** Normaliza el endpoint: si empieza con /api/, lo recorta (tu API_BASE_URL ya lo incluye) */
  private normalizeEndpoint(endpoint: string): string {
    return endpoint.startsWith("/api/") ? endpoint.substring(4) : endpoint;
  }

  /** Manejo robusto de respuestas:
   * - Intenta parsear JSON; si no, deja texto.
   * - Si !ok, lanza Error con message del backend (data.error || data.message).
   * - Soporta 204/empty body.
   */
  private async handleResponse<T>(
    response: Response,
    endpoint: string
  ): Promise<T> {
    let rawText = "";
    try {
      rawText = await response.text();
    } catch {
      // error leyendo el body; continuar con vacío
    }

    let data: any = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        // no es JSON; dejamos texto plano en data
        data = rawText;
      }
    }

    if (!response.ok) {
      const backendMsg =
        (data && typeof data === "object" && (data.error || data.message)) ||
        (typeof data === "string" && data) ||
        `HTTP ${response.status} en ${endpoint}`;

      console.error(
        `[API] ${response.status} error on ${endpoint}:`,
        data ?? rawText
      );

      const err: any = new Error(backendMsg);
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    // 204 No Content o cuerpo vacío
    if (!rawText) return {} as T;

    // Si el body es texto plano y no JSON, intenta retornar algo útil
    if (data !== null && typeof data !== "object") {
      return { data } as unknown as T;
    }

    return (data ?? {}) as T;
  }

  async get<T>(endpoint: string): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.buildUrl(ep);
    console.warn(`[API] GET ${ep}`);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await this.handleResponse<T>(res, ep);
    } catch (e: any) {
      // Errores de red (CORS, DNS, timeout del navegador, etc.)
      if (!e?.status) {
        console.error(`[API] Network/Fetch error on GET ${ep}:`, e);
        const err = new Error("Error de conexión con el servidor");
        (err as any).cause = e;
        throw err;
      }
      throw e;
    }
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.buildUrl(ep);
    console.warn(`[API] POST ${ep}`, data);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse<T>(res, ep);
    } catch (e: any) {
      if (!e?.status) {
        console.error(`[API] Network/Fetch error on POST ${ep}:`, e);
        const err = new Error("Error de conexión con el servidor");
        (err as any).cause = e;
        throw err;
      }
      throw e;
    }
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.buildUrl(ep);
    console.warn(`[API] PUT ${ep}`, data);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse<T>(res, ep);
    } catch (e: any) {
      if (!e?.status) {
        console.error(`[API] Network/Fetch error on PUT ${ep}:`, e);
        const err = new Error("Error de conexión con el servidor");
        (err as any).cause = e;
        throw err;
      }
      throw e;
    }
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.buildUrl(ep);
    console.warn(`[API] PATCH ${ep}`, data);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: this.getHeaders(),
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      });
      return await this.handleResponse<T>(res, ep);
    } catch (e: any) {
      if (!e?.status) {
        console.error(`[API] Network/Fetch error on PATCH ${ep}:`, e);
        const err = new Error("Error de conexión con el servidor");
        (err as any).cause = e;
        throw err;
      }
      throw e;
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.buildUrl(ep);
    console.warn(`[API] DELETE ${ep}`);
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      return await this.handleResponse<T>(res, ep);
    } catch (e: any) {
      if (!e?.status) {
        console.error(`[API] Network/Fetch error on DELETE ${ep}:`, e);
        const err = new Error("Error de conexión con el servidor");
        (err as any).cause = e;
        throw err;
      }
      throw e;
    }
  }
}

export const apiService = new ApiService();
