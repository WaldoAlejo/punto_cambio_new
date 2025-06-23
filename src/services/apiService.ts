
import axios from 'axios';

const API_BASE_URL = '/api';

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
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw error;
    }
  );

  return {
    async get<T>(endpoint: string): Promise<T> {
      const response = await axiosInstance.get(endpoint);
      return response.data as T;
    },

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
      const response = await axiosInstance.post(endpoint, data);
      return response.data as T;
    },

    async put<T>(endpoint: string, data?: unknown): Promise<T> {
      const response = await axiosInstance.put(endpoint, data);
      return response.data as T;
    },

    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
      const response = await axiosInstance.patch(endpoint, data);
      return response.data as T;
    },

    async delete<T>(endpoint: string): Promise<T> {  
      const response = await axiosInstance.delete(endpoint);
      return response.data as T;
    },
  };
};

export const apiService = createApiService();
