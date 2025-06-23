
import { apiService } from "./apiService";
import { Moneda, CreateCurrencyData, ApiResponse, ListResponse } from "../types";

interface CurrenciesResponse extends ListResponse<Moneda> {
  currencies: Moneda[];
}

interface CurrencyResponse extends ApiResponse<Moneda> {
  currency: Moneda;
}

export const currencyService = {
  async getAllCurrencies(): Promise<{
    currencies: Moneda[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<CurrenciesResponse>("/currencies");

      if (!response) {
        return {
          currencies: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          currencies: [],
          error: response.error || "Error al obtener monedas",
        };
      }

      return { currencies: response.currencies || [], error: null };
    } catch (error) {
      console.error("Error en getAllCurrencies:", error);
      return { currencies: [], error: "Error de conexión con el servidor" };
    }
  },

  async createCurrency(currencyData: CreateCurrencyData): Promise<{
    currency: Moneda | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.post<CurrencyResponse>("/currencies", currencyData);

      if (!response) {
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          currency: null,
          error: response.error || "Error al crear moneda",
        };
      }

      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("Error en createCurrency:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    }
  },
};
