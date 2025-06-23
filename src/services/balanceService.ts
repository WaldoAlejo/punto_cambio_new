
import { apiService } from './apiService';
import { Saldo } from '../types';

export const balanceService = {
  async getBalancesByPoint(pointId: string): Promise<{ balances: Saldo[]; error: string | null }> {
    try {
      console.log('Fetching balances for point:', pointId);
      const response = await apiService.get<{ balances: Saldo[]; success: boolean }>(`/balances/${pointId}`);
      
      if (response.success) {
        return { balances: response.balances, error: null };
      } else {
        return { balances: [], error: 'Error al obtener los saldos' };
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      return { balances: [], error: 'Error de conexión al obtener saldos' };
    }
  },

  async updateBalance(pointId: string, currencyId: string, data: { cantidad: number; billetes: number; monedas_fisicas: number }): Promise<{ balance: Saldo | null; error: string | null }> {
    try {
      console.log('Updating balance:', { pointId, currencyId, data });
      const response = await apiService.patch<{ balance: Saldo; success: boolean }>(`/balances/${pointId}/${currencyId}`, data);
      
      if (response.success) {
        return { balance: response.balance, error: null };
      } else {
        return { balance: null, error: 'Error al actualizar el saldo' };
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      return { balance: null, error: 'Error de conexión al actualizar saldo' };
    }
  }
};
