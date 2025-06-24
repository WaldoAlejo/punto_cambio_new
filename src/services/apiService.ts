
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
      console.log('=== API SERVICE REQUEST INTERCEPTOR ===');
      console.log('Request URL:', config.baseURL + config.url);
      console.log('Request method:', config.method?.toUpperCase());
      console.log('Request data:', config.data);
      
      // Buscar el token en ambas ubicaciones para asegurar compatibilidad
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Token added to request (first 20 chars):', token.substring(0, 20) + '...');
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
      console.log('=== API SERVICE RESPONSE INTERCEPTOR ===');
      console.log('Response URL:', response.config.url);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
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
      console.log('=== API SERVICE GET ===');
      console.log('GET endpoint:', endpoint);
      const response = await axiosInstance.get(endpoint);
      console.log('GET response data:', response.data);
      return response.data as T;
    },

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
      console.log('=== API SERVICE POST ===');
      console.log('POST endpoint:', endpoint);
      console.log('POST data:', data);
      const response = await axiosInstance.post(endpoint, data);
      console.log('POST response data:', response.data);
      return response.data as T;
    },

    async put<T>(endpoint: string, data?: unknown): Promise<T> {
      console.log('=== API SERVICE PUT ===');
      console.log('PUT endpoint:', endpoint);
      console.log('PUT data:', data);
      const response = await axiosInstance.put(endpoint, data);
      console.log('PUT response data:', response.data);
      return response.data as T;
    },

    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
      console.log('=== API SERVICE PATCH ===');
      console.log('PATCH endpoint:', endpoint);
      console.log('PATCH data:', data);
      const response = await axiosInstance.patch(endpoint, data);
      console.log('PATCH response data:', response.data);
      return response.data as T;
    },

    async delete<T>(endpoint: string): Promise<T> {  
      console.log('=== API SERVICE DELETE ===');
      console.log('DELETE endpoint:', endpoint);
      const response = await axiosInstance.delete(endpoint);
      console.log('DELETE response data:', response.data);
      return response.data as T;
    },
  };
};

export const apiService = createApiService();
