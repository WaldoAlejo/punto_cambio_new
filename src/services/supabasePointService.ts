import { supabase } from "../integrations/supabase/client";
import { PuntoAtencion } from "../types";

export const supabasePointService = {
  async getAllPoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    try {
      console.log('Fetching all points from Supabase...');
      
      const { data: points, error } = await supabase
        .from('PuntoAtencion')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) {
        console.error('Error fetching points:', error);
        return { points: [], error: error.message };
      }

      console.log('Points fetched successfully:', points);
      return { points: points || [], error: null };

    } catch (error) {
      console.error('Error in getAllPoints:', error);
      return { points: [], error: "Error de conexión" };
    }
  },

  async getActivePoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    try {
      console.log('Fetching available points from Supabase...');
      
      // Obtener puntos que NO tienen jornadas activas hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Primero obtener IDs de puntos con jornadas activas
      const { data: activeSchedules, error: scheduleError } = await supabase
        .from('Jornada')
        .select('punto_atencion_id')
        .eq('estado', 'ACTIVO')
        .gte('fecha_inicio', today.toISOString())
        .lt('fecha_inicio', tomorrow.toISOString());

      if (scheduleError) {
        console.error('Error fetching active schedules:', scheduleError);
        return { points: [], error: scheduleError.message };
      }

      const occupiedPointIds = activeSchedules?.map(s => s.punto_atencion_id) || [];

      // Obtener puntos que NO están en la lista de ocupados
      let query = supabase
        .from('PuntoAtencion')
        .select('*')
        .eq('activo', true);

      if (occupiedPointIds.length > 0) {
        query = query.not('id', 'in', `(${occupiedPointIds.join(',')})`);
      }

      const { data: availablePoints, error: pointsError } = await query.order('nombre');

      if (pointsError) {
        console.error('Error fetching available points:', pointsError);
        return { points: [], error: pointsError.message };
      }

      console.log('Available points fetched successfully:', availablePoints);
      return { points: availablePoints || [], error: null };

    } catch (error) {
      console.error('Error in getActivePoints:', error);
      return { points: [], error: "Error de conexión" };
    }
  }
};