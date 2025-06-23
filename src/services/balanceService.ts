
import { apiService } from "./apiService";
import { Saldo, ApiResponse, ListResponse } from "../types";

interface BalancesResponse extends ListResponse<Saldo> {
  balances: Saldo[];
}

export const balanceService = {
  async getBalancesByPoint(pointId: string): Promise<{
    balances: Saldo[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<BalancesResponse>(`/balances/${pointId}`);

      if (!response) {
        return {
          balances: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          balances: [],
          error: response.error || "Error al obtener saldos",
        };
      }

      return { balances: response.balances || [], error: null };
    } catch (error) {
      console.error("Error en getBalancesByPoint:", error);
      return { balances: [], error: "Error de conexión con el servidor" };
    }
  },
};
