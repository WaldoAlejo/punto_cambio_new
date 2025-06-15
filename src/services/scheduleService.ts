
const API_BASE_URL = 'http://localhost:3001/api';

export interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo: string | null;
  fecha_regreso: string | null;
  fecha_salida: string | null;
  usuario?: any;
  puntoAtencion?: any;
}

export const scheduleService = {
  async getAllSchedules(): Promise<{ schedules: Schedule[]; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/schedules`);
      const data = await response.json();

      if (!response.ok) {
        return { schedules: [], error: data.error || 'Error al obtener horarios' };
      }

      return { schedules: data.schedules, error: null };
    } catch (error) {
      console.error('Error en getAllSchedules:', error);
      return { schedules: [], error: 'Error de conexión con el servidor' };
    }
  }
};
