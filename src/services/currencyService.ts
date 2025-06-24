
import { apiService } from "./apiService";
import { Moneda, ApiResponse, ListResponse } from "../types";

interface CreateCurrencyData {
  codigo: string;
  nombre: string;
  simbolo: string;
  orden_display?: number;
}

interface CurrenciesResponse extends ListResponse<Moneda> {
  currencies: Moneda[];
}

interface CurrencyResponse extends ApiResponse<Moneda> {
  currency: Moneda;
}

export const currencyService = {
  async getAllCurrencies(): Promise<{ currencies: Moneda[]; error: string | null }> {
    console.log('=== CURRENCY SERVICE - getAllCurrencies START ===');
    try {
      console.log('Calling apiService.get("/currencies")...');
      const response = await apiService.get<CurrenciesResponse>("/currencies");
      console.log('getAllCurrencies - Raw response:', response);

      if (!response) {
        console.error('getAllCurrencies - No response received');
        return {
          currencies: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('getAllCurrencies - Response error:', response.error);
        return {
          currencies: [],
          error: response.error || "Error al obtener monedas",
        };
      }

      console.log('getAllCurrencies - Success, currencies count:', response.currencies?.length || 0);
      return { currencies: response.currencies || [], error: null };
    } catch (error) {
      console.error("=== getAllCurrencies ERROR ===");
      console.error("Error details:", error);
      return { currencies: [], error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== CURRENCY SERVICE - getAllCurrencies END ===');
    }
  },

  async createCurrency(currencyData: CreateCurrencyData): Promise<{ currency: Moneda | null; error: string | null }> {
    console.log('=== CURRENCY SERVICE - createCurrency START ===');
    console.log('Input data:', currencyData);

    try {
      console.log('Calling apiService.post("/currencies", currencyData)...');
      const response = await apiService.post<CurrencyResponse>("/currencies", currencyData);
      console.log('createCurrency - Raw response:', response);

      if (!response) {
        console.error('createCurrency - No response received from server');
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('createCurrency - Response indicates failure:', response.error);
        return {
          currency: null,
          error: response.error || "Error al crear moneda",
        };
      }

      console.log('createCurrency - Success! Created currency:', response.currency);
      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("=== createCurrency ERROR ===");
      console.error("Error details:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== CURRENCY SERVICE - createCurrency END ===');
    }
  },

  async toggleCurrencyStatus(currencyId: string): Promise<{ currency: Moneda | null; error: string | null }> {
    console.log('=== CURRENCY SERVICE - toggleCurrencyStatus START ===');
    console.log('Currency ID:', currencyId);

    try {
      console.log('Calling apiService.patch for currency toggle...');
      const response = await apiService.patch<CurrencyResponse>(`/currencies/${currencyId}/toggle`);
      console.log('toggleCurrencyStatus - Raw response:', response);

      if (!response) {
        console.error('toggleCurrencyStatus - No response received from server');
        return { currency: null, error: "No se pudo obtener la respuesta del servidor" };
      }

      if (response.error || !response.success) {
        console.error('toggleCurrencyStatus - Response indicates failure:', response.error);
        return { currency: null, error: response.error || "Error al cambiar estado de la moneda" };
      }

      console.log('toggleCurrencyStatus - Success! Updated currency:', response.currency);
      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("=== toggleCurrencyStatus ERROR ===");
      console.error("Error details:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== CURRENCY SERVICE - toggleCurrencyStatus END ===');
    }
  }
};
