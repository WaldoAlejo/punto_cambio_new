
import { apiService } from "./apiService";

export interface Currency {
  id: string;
  nombre: string;
  simbolo: string;
  codigo: string;
  activo: boolean;
  orden_display: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCurrencyData {
  nombre: string;
  simbolo: string;
  codigo: string;
  orden_display?: number;
}

interface CurrencyListResponse {
  currencies: Currency[];
  success: boolean;
  error?: string;
}

interface CurrencyCreateResponse {
  currency: Currency;
  success: boolean;
  error?: string;
}

export const currencyService = {
  async getAllCurrencies(): Promise<{
    currencies: Currency[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<CurrencyListResponse>("/currencies");

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

  async createCurrency(
    currencyData: CreateCurrencyData
  ): Promise<{ currency: Currency | null; error: string | null }> {
    try {
      const response = await apiService.post<CurrencyCreateResponse>("/currencies", currencyData);

      if (!response) {
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return { currency: null, error: response.error || "Error al crear moneda" };
      }

      return { currency: response.currency || null, error: null };
    } catch (error) {
      console.error("Error en createCurrency:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    }
  },
};
