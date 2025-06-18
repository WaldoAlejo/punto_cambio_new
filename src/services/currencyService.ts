const API_BASE_URL = "http://localhost:3001/api";

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
  error?: string;
}

interface CurrencyCreateResponse {
  currency: Currency;
  error?: string;
}

export const currencyService = {
  async getAllCurrencies(): Promise<{
    currencies: Currency[];
    error: string | null;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/currencies`);
      const data: CurrencyListResponse = await response.json();

      if (!response.ok) {
        return {
          currencies: [],
          error: data.error || "Error al obtener monedas",
        };
      }

      return { currencies: data.currencies, error: null };
    } catch (error) {
      console.error("Error en getAllCurrencies:", error);
      return { currencies: [], error: "Error de conexión con el servidor" };
    }
  },

  async createCurrency(
    currencyData: CreateCurrencyData
  ): Promise<{ currency: Currency | null; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/currencies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currencyData),
      });

      const data: CurrencyCreateResponse = await response.json();

      if (!response.ok) {
        return { currency: null, error: data.error || "Error al crear moneda" };
      }

      return { currency: data.currency, error: null };
    } catch (error) {
      console.error("Error en createCurrency:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    }
  },
};
