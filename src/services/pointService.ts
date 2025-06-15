
import { PuntoAtencion } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

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
      const response = await fetch(`${API_BASE_URL}/points`);
      const data = await response.json();

      if (!response.ok) {
        return { points: [], error: data.error || 'Error al obtener puntos' };
      }

      return { points: data.points, error: null };
    } catch (error) {
      console.error('Error en getAllPoints:', error);
      return { points: [], error: 'Error de conexión con el servidor' };
    }
  },

  async createPoint(pointData: CreatePointData): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pointData)
      });

      const data = await response.json();

      if (!response.ok) {
        return { point: null, error: data.error || 'Error al crear punto' };
      }

      return { point: data.point, error: null };
    } catch (error) {
      console.error('Error en createPoint:', error);
      return { point: null, error: 'Error de conexión con el servidor' };
    }
  }
};
