
import { authService } from './authService';

const API_BASE_URL = 'http://localhost:3001/api';

class ApiService {
  private getAuthHeaders() {
    const token = authService.getStoredToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async get(endpoint: string) {
    try {
      console.log(`Making GET request to: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: this.getAuthHeaders()
      });
      
      if (response.status === 401) {
        authService.removeStoredToken();
        window.location.href = '/login';
        return null;
      }
      
      const data = await response.json();
      console.log(`Response for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  }

  async post(endpoint: string, data: any) {
    try {
      console.log(`Making POST request to: ${API_BASE_URL}${endpoint}`, data);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (response.status === 401) {
        authService.removeStoredToken();
        window.location.href = '/login';
        return null;
      }
      
      const responseData = await response.json();
      console.log(`Response for POST ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
