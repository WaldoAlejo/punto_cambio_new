
// Configuración base para las llamadas a la API
export const API_BASE_URL = 'http://localhost:3001/api';

export const apiClient = {
  async get(endpoint: string) {
    try {
      console.log(`Making GET request to: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      const data = await response.json();
      console.log(`Response for ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  },

  async post(endpoint: string, data: any) {
    try {
      console.log(`Making POST request to: ${API_BASE_URL}${endpoint}`, data);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      const responseData = await response.json();
      console.log(`Response for POST ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  }
};
