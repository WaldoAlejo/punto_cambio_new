
import { supabase } from "@/integrations/supabase/client";
import { PuntoAtencion } from '../types';

export const pointService = {
  async getAllPoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('PuntoAtencion')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) {
        console.error('Error obteniendo puntos:', error);
        return { points: [], error: error.message };
      }

      return { points: data || [], error: null };
    } catch (error) {
      console.error('Error en getAllPoints:', error);
      return { points: [], error: 'Error al obtener puntos de atención' };
    }
  },

  async getPointById(id: string): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('PuntoAtencion')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error obteniendo punto:', error);
        return { point: null, error: error.message };
      }

      return { point: data, error: null };
    } catch (error) {
      console.error('Error en getPointById:', error);
      return { point: null, error: 'Error al obtener punto de atención' };
    }
  },

  async createPoint(pointData: Omit<PuntoAtencion, 'id' | 'created_at' | 'updated_at'>): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('PuntoAtencion')
        .insert([pointData])
        .select()
        .single();

      if (error) {
        console.error('Error creando punto:', error);
        return { point: null, error: error.message };
      }

      return { point: data, error: null };
    } catch (error) {
      console.error('Error en createPoint:', error);
      return { point: null, error: 'Error al crear punto de atención' };
    }
  },

  async updatePoint(id: string, pointData: Partial<PuntoAtencion>): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('PuntoAtencion')
        .update(pointData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando punto:', error);
        return { point: null, error: error.message };
      }

      return { point: data, error: null };
    } catch (error) {
      console.error('Error en updatePoint:', error);
      return { point: null, error: 'Error al actualizar punto de atención' };
    }
  }
};
