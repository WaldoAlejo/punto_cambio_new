
const API_BASE_URL = import.meta.env.VITE_API_URL;

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    console.warn(`[API] GET ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] GET ${endpoint} failed:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.warn(`[API] GET ${endpoint} success:`, data);
    return data;
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] POST ${endpoint}`, data);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] POST ${endpoint} failed:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.warn(`[API] POST ${endpoint} success:`, result);
    return result;
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    console.warn(`[API] PUT ${endpoint}`, data);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] PUT ${endpoint} failed:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.warn(`[API] PUT ${endpoint} success:`, result);
    return result;
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    console.warn(`[API] PATCH ${endpoint}`, data);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      ...(data && { body: JSON.stringify(data) })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] PATCH ${endpoint} failed:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.warn(`[API] PATCH ${endpoint} success:`, result);
    return result;
  }

  async delete<T>(endpoint: string): Promise<T> {
    console.warn(`[API] DELETE ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] DELETE ${endpoint} failed:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.warn(`[API] DELETE ${endpoint} success:`, result);
    return result;
  }
}

export const apiService = new ApiService();
