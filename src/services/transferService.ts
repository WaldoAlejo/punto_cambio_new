
import { apiService } from "./apiService";
import { Transferencia, CreateTransferData, ApiResponse, ListResponse } from "../types";

interface TransfersResponse extends ListResponse<Transferencia> {
  transfers: Transferencia[];
}

interface TransferResponse extends ApiResponse<Transferencia> {
  transfer: Transferencia;
}

export const transferService = {
  async getAllTransfers(): Promise<{
    transfers: Transferencia[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<TransfersResponse>("/transfers");

      if (!response) {
        return {
          transfers: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          transfers: [],
          error: response.error || "Error al obtener transferencias",
        };
      }

      return { transfers: response.transfers || [], error: null };
    } catch (error) {
      console.error("Error en getAllTransfers:", error);
      return { transfers: [], error: "Error de conexión con el servidor" };
    }
  },

  async createTransfer(transferData: CreateTransferData): Promise<{
    transfer: Transferencia | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.post<TransferResponse>("/transfers", transferData);

      if (!response) {
        return {
          transfer: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          transfer: null,
          error: response.error || "Error al crear transferencia",
        };
      }

      return { transfer: response.transfer, error: null };
    } catch (error) {
      console.error("Error en createTransfer:", error);
      return { transfer: null, error: "Error de conexión con el servidor" };
    }
  },
};
