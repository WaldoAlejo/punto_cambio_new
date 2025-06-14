
import { PuntoAtencion } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

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
  }
};
