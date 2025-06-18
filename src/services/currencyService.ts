
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
      console.log('Fetching currencies from API...');
      const response = await apiService.get<CurrencyListResponse>("/currencies");

      if (!response) {
        console.warn('No response received from currencies API');
        return {
          currencies: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Currencies API response:', response);

      if (response.error || !response.success) {
        console.warn('Currencies API returned error:', response.error);
        return {
          currencies: [],
          error: response.error || "Error al obtener monedas",
        };
      }

      console.log('Currencies fetched successfully:', response.currencies?.length || 0);
      return { currencies: response.currencies || [], error: null };
    } catch (error) {
      console.error("Error en getAllCurrencies:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { currencies: [], error: errorMessage };
    }
  },

  async createCurrency(
    currencyData: CreateCurrencyData
  ): Promise<{ currency: Currency | null; error: string | null }> {
    try {
      console.log('Creating currency via API...', currencyData);
      const response = await apiService.post<CurrencyCreateResponse>("/currencies", currencyData);

      if (!response) {
        console.warn('No response received from create currency API');
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Create currency API response:', response);

      if (response.error || !response.success) {
        console.warn('Create currency API returned error:', response.error);
        return { currency: null, error: response.error || "Error al crear moneda" };
      }

      console.log('Currency created successfully:', response.currency);
      return { currency: response.currency || null, error: null };
    } catch (error) {
      console.error("Error en createCurrency:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { currency: null, error: errorMessage };
    }
  },
};
