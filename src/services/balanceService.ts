
import { supabase } from "@/integrations/supabase/client";
import { Saldo } from '../types';

export const balanceService = {
  async getBalancesByPoint(puntoAtencionId: string): Promise<{ balances: Saldo[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('Saldo')
        .select(`
          *,
          moneda:Moneda(*)
        `)
        .eq('punto_atencion_id', puntoAtencionId);

      if (error) {
        console.error('Error obteniendo saldos:', error);
        return { balances: [], error: error.message };
      }

      return { balances: data || [], error: null };
    } catch (error) {
      console.error('Error en getBalancesByPoint:', error);
      return { balances: [], error: 'Error al obtener saldos' };
    }
  },

  async updateBalance(
    puntoAtencionId: string, 
    monedaId: string, 
    cantidad: number, 
    billetes: number = 0, 
    monedasFisicas: number = 0
  ): Promise<{ balance: Saldo | null; error: string | null }> {
    try {
      // Verificar si ya existe un saldo para este punto y moneda
      const { data: existingBalance, error: checkError } = await supabase
        .from('Saldo')
        .select('*')
        .eq('punto_atencion_id', puntoAtencionId)
        .eq('moneda_id', monedaId)
        .maybeSingle();

      if (checkError) {
        console.error('Error verificando saldo existente:', checkError);
        return { balance: null, error: checkError.message };
      }

      let result;
      if (existingBalance) {
        // Actualizar saldo existente
        const { data, error } = await supabase
          .from('Saldo')
          .update({
            cantidad,
            billetes,
            monedas_fisicas: monedasFisicas,
            updated_at: new Date().toISOString()
          })
          .eq('punto_atencion_id', puntoAtencionId)
          .eq('moneda_id', monedaId)
          .select()
          .single();

        result = { data, error };
      } else {
        // Crear nuevo saldo
        const { data, error } = await supabase
          .from('Saldo')
          .insert([{
            punto_atencion_id: puntoAtencionId,
            moneda_id: monedaId,
            cantidad,
            billetes,
            monedas_fisicas: monedasFisicas
          }])
          .select()
          .single();

        result = { data, error };
      }

      if (result.error) {
        console.error('Error actualizando saldo:', result.error);
        return { balance: null, error: result.error.message };
      }

      return { balance: result.data, error: null };
    } catch (error) {
      console.error('Error en updateBalance:', error);
      return { balance: null, error: 'Error al actualizar saldo' };
    }
  }
};
