
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export interface ApiService {
  get<T>(endpoint: string): Promise<T>;
  post<T>(endpoint: string, data?: unknown): Promise<T>;
  put<T>(endpoint: string, data?: unknown): Promise<T>;
  patch<T>(endpoint: string, data?: unknown): Promise<T>;
  delete<T>(endpoint: string): Promise<T>;
}

const createApiService = (): ApiService => {
  const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  axiosInstance.interceptors.request.use(
    (config) => {
      console.warn('=== API SERVICE REQUEST INTERCEPTOR ===');
      console.warn('Request URL:', config.baseURL + config.url);
      console.warn('Request method:', config.method?.toUpperCase());
      console.warn('Request data:', config.data);
      
      // Buscar el token en ambas ubicaciones para asegurar compatibilidad
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.warn('Token added to request (first 20 chars):', token.substring(0, 20) + '...');
      } else {
        console.warn('No token found in localStorage');
      }
      return config;
    },
    (error) => {
      console.error('=== API REQUEST INTERCEPTOR ERROR ===');
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => {
      console.warn('=== API SERVICE RESPONSE INTERCEPTOR ===');
      console.warn('Response URL:', response.config.url);
      console.warn('Response status:', response.status);
      console.warn('Response data:', response.data);
      return response;
    },
    (error) => {
      console.error('=== API SERVICE RESPONSE ERROR ===');
      console.error('Error URL:', error.config?.url);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      console.error('Error response data:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.warn('401 Unauthorized - Clearing tokens and redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw error;
    }
  );

  return {
    async get<T>(endpoint: string): Promise<T> {
      console.warn('=== API SERVICE GET ===');
      console.warn('GET endpoint:', endpoint);
      const response = await axiosInstance.get(endpoint);
      console.warn('GET response data:', response.data);
      return response.data as T;
    },

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
      console.warn('=== API SERVICE POST ===');
      console.warn('POST endpoint:', endpoint);
      console.warn('POST data:', data);
      const response = await axiosInstance.post(endpoint, data);
      console.warn('POST response data:', response.data);
      return response.data as T;
    },

    async put<T>(endpoint: string, data?: unknown): Promise<T> {
      console.warn('=== API SERVICE PUT ===');
      console.warn('PUT endpoint:', endpoint);
      console.warn('PUT data:', data);
      const response = await axiosInstance.put(endpoint, data);
      console.warn('PUT response data:', response.data);
      return response.data as T;
    },

    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
      console.warn('=== API SERVICE PATCH ===');
      console.warn('PATCH endpoint:', endpoint);
      console.warn('PATCH data:', data);
      const response = await axiosInstance.patch(endpoint, data);
      console.warn('PATCH response data:', response.data);
      return response.data as T;
    },

    async delete<T>(endpoint: string): Promise<T> {  
      console.warn('=== API SERVICE DELETE ===');
      console.warn('DELETE endpoint:', endpoint);
      const response = await axiosInstance.delete(endpoint);
      console.warn('DELETE response data:', response.data);
      return response.data as T;
    },
  };
};

export const apiService = createApiService();
