
import { Saldo } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

export const balanceService = {
  async getBalancesByPoint(puntoAtencionId: string): Promise<{ balances: Saldo[]; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/balances/${puntoAtencionId}`);
      const data = await response.json();

      if (!response.ok) {
        return { balances: [], error: data.error || 'Error al obtener saldos' };
      }

      return { balances: data.balances, error: null };
    } catch (error) {
      console.error('Error en getBalancesByPoint:', error);
      return { balances: [], error: 'Error de conexión con el servidor' };
    }
  }
};
