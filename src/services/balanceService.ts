
const API_BASE_URL = 'http://localhost:3001/api';

export interface Balance {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  cantidad: number;
  billetes: number;
  monedas_fisicas: number;
  updated_at: string;
  moneda?: {
    id: string;
    codigo: string;
    nombre: string;
    simbolo: string;
  };
}

export const balanceService = {
  async getBalancesByPoint(pointId: string): Promise<{ balances: Balance[]; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/balances/${pointId}`);
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
