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

  async createCurrency(
    currencyData: CreateCurrencyData
  ): Promise<{ currency: Moneda | null; error: string | null }> {
    console.warn("=== CURRENCY SERVICE - createCurrency START ===");
    console.warn("Input data:", currencyData);

    try {
      console.warn('Calling apiService.post("/currencies", currencyData)...');
      const response = await apiService.post<CurrencyResponse>(
        "/currencies",
        currencyData
      );
      console.warn("createCurrency - Raw response:", response);

      if (!response) {
        console.error("createCurrency - No response received from server");
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error(
          "createCurrency - Response indicates failure:",
          response.error
        );
        return {
          currency: null,
          error: response.error || "Error al crear moneda",
        };
      }

      console.warn(
        "createCurrency - Success! Created currency:",
        response.currency
      );
      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("=== createCurrency ERROR ===");
      console.error("Error details:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    } finally {
      console.warn("=== CURRENCY SERVICE - createCurrency END ===");
    }
  },

  async toggleCurrencyStatus(
    currencyId: string
  ): Promise<{ currency: Moneda | null; error: string | null }> {
    console.warn("=== CURRENCY SERVICE - toggleCurrencyStatus START ===");
    console.warn("Currency ID:", currencyId);

    try {
      console.warn("Calling apiService.patch for currency toggle...");
      const response = await apiService.patch<CurrencyResponse>(
        `/currencies/${currencyId}/toggle`
      );
      console.warn("toggleCurrencyStatus - Raw response:", response);

      if (!response) {
        console.error(
          "toggleCurrencyStatus - No response received from server"
        );
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error(
          "toggleCurrencyStatus - Response indicates failure:",
          response.error
        );
        return {
          currency: null,
          error: response.error || "Error al cambiar estado de la moneda",
        };
      }

      console.warn(
        "toggleCurrencyStatus - Success! Updated currency:",
        response.currency
      );
      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("=== toggleCurrencyStatus ERROR ===");
      console.error("Error details:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    } finally {
      console.warn("=== CURRENCY SERVICE - toggleCurrencyStatus END ===");
    }
  },

  async updateCurrency(
    currencyId: string,
    data: Partial<Moneda>
  ): Promise<{ currency: Moneda | null; error: string | null }> {
    console.warn("=== CURRENCY SERVICE - updateCurrency START ===");
    console.warn("Currency ID:", currencyId, "Data:", data);

    try {
      console.warn('Calling apiService.put("/currencies/:id", data)...');
      const response = await apiService.put<CurrencyResponse>(
        `/currencies/${currencyId}`,
        data
      );
      console.warn("updateCurrency - Raw response:", response);

      if (!response) {
        console.error("updateCurrency - No response received from server");
        return {
          currency: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error(
          "updateCurrency - Response indicates failure:",
          response.error
        );
        return {
          currency: null,
          error: response.error || "Error al actualizar moneda",
        };
      }

      console.warn(
        "updateCurrency - Success! Updated currency:",
        response.currency
      );
      return { currency: response.currency, error: null };
    } catch (error) {
      console.error("=== updateCurrency ERROR ===");
      console.error("Error details:", error);
      return { currency: null, error: "Error de conexión con el servidor" };
    } finally {
      console.warn("=== CURRENCY SERVICE - updateCurrency END ===");
    }
  },
};
