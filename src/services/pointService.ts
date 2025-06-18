
import { apiService } from './apiService';
import { PuntoAtencion } from '../types';

export interface PointsResponse {
  points: PuntoAtencion[];
}

export const pointService = {
  async getAllPoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    try {
      const response = await apiService.get('/points');
      
      if (!response) {
        return { points: [], error: 'No se pudo obtener la respuesta del servidor' };
      }
      
      if (response.error) {
        return { points: [], error: response.error };
      }
      
      return { points: response.points || [], error: null };
    } catch (error) {
      console.error('Error getting points:', error);
      return { points: [], error: 'Error de conexión con el servidor' };
    }
  }
};
