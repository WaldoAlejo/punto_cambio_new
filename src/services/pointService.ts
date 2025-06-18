
import { apiService } from './apiService';
import { PuntoAtencion } from '../types';

export interface PointsResponse {
  points: PuntoAtencion[];
}

export interface CreatePointData {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal?: string;
  telefono?: string;
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
  },

  async createPoint(pointData: CreatePointData): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const response = await apiService.post('/points', pointData);
      
      if (!response) {
        return { point: null, error: 'No se pudo obtener la respuesta del servidor' };
      }
      
      if (response.error) {
        return { point: null, error: response.error };
      }
      
      return { point: response.point || null, error: null };
    } catch (error) {
      console.error('Error creating point:', error);
      return { point: null, error: 'Error de conexión con el servidor' };
    }
  }
};
