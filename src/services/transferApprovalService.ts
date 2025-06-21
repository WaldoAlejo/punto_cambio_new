
import { apiService } from "./apiService";
import { Transferencia } from "../types";

interface TransferApprovalsResponse {
  transfers: Transferencia[];
  success: boolean;
  error?: string;
}

interface ApprovalData {
  observaciones?: string;
}

interface ApprovalResponse {
  transfer: Transferencia;
  success: boolean;
  error?: string;
}

export const transferApprovalService = {
  async getPendingTransfers(): Promise<{
    transfers: Transferencia[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<TransferApprovalsResponse>("/transfer-approvals");

      if (!response) {
        return {
          transfers: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          transfers: [],
          error: response.error || "Error al obtener transferencias pendientes",
        };
      }

      return { transfers: response.transfers || [], error: null };
    } catch (error) {
      console.error("Error en getPendingTransfers:", error);
      return { transfers: [], error: "Error de conexión con el servidor" };
    }
  },

  async approveTransfer(transferId: string, data: ApprovalData): Promise<{
    transfer: Transferencia | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.put<ApprovalResponse>(`/transfer-approvals/${transferId}/approve`, data);

      if (!response) {
        return {
          transfer: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          transfer: null,
          error: response.error || "Error al aprobar transferencia",
        };
      }

      return { transfer: response.transfer, error: null };
    } catch (error) {
      console.error("Error en approveTransfer:", error);
      return { transfer: null, error: "Error de conexión con el servidor" };
    }
  },

  async rejectTransfer(transferId: string, data: ApprovalData): Promise<{
    transfer: Transferencia | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.put<ApprovalResponse>(`/transfer-approvals/${transferId}/reject`, data);

      if (!response) {
        return {
          transfer: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          transfer: null,
          error: response.error || "Error al rechazar transferencia",
        };
      }

      return { transfer: response.transfer, error: null };
    } catch (error) {
      console.error("Error en rejectTransfer:", error);
      return { transfer: null, error: "Error de conexión con el servidor" };
    }
  },
};
