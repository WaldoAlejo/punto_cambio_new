
import { supabase } from "@/integrations/supabase/client";
import { Moneda } from '../types';

export const currencyService = {
  async getAllCurrencies(): Promise<{ currencies: Moneda[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('Moneda')
        .select('*')
        .eq('activo', true)
        .order('orden_display');

      if (error) {
        console.error('Error obteniendo monedas:', error);
        return { currencies: [], error: error.message };
      }

      return { currencies: data || [], error: null };
    } catch (error) {
      console.error('Error en getAllCurrencies:', error);
      return { currencies: [], error: 'Error al obtener monedas' };
    }
  },

  async createCurrency(currencyData: Omit<Moneda, 'id' | 'created_at' | 'updated_at'>): Promise<{ currency: Moneda | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('Moneda')
        .insert([currencyData])
        .select()
        .single();

      if (error) {
        console.error('Error creando moneda:', error);
        return { currency: null, error: error.message };
      }

      return { currency: data, error: null };
    } catch (error) {
      console.error('Error en createCurrency:', error);
      return { currency: null, error: 'Error al crear moneda' };
    }
  }
};
