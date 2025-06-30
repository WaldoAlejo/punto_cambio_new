import { apiService } from "./apiService";
import { Transferencia, ResponsableMovilizacion } from "../types";

export interface CreateTransferData {
  origen_id: string;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia:
    | "ENTRE_PUNTOS"
    | "DEPOSITO_MATRIZ"
    | "RETIRO_GERENCIA"
    | "DEPOSITO_GERENCIA";
  descripcion: string;
  solicitado_por: string;
  detalle_divisas?: {
    billetes: number;
    monedas: number;
    total: number;
  };
  responsable_movilizacion?: ResponsableMovilizacion;
}

interface TransferResponse {
  transfer: Transferencia;
  success: boolean;
  message?: string;
}

interface TransfersResponse {
  transfers: Transferencia[];
  success: boolean;
}

export const transferService = {
  async createTransfer(
    data: CreateTransferData
  ): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      const response = await apiService.post<TransferResponse>(
        "/transfers",
        data
      );

      if (response && response.success && response.transfer) {
        return { transfer: response.transfer, error: null };
      } else {
        const errorMsg = response?.message || "Error al crear la transferencia";
        return { transfer: null, error: errorMsg };
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const err = error as { response?: { data?: { error?: string } } };
        if (err.response?.data?.error) {
          return { transfer: null, error: err.response.data.error };
        }
      }
      return {
        transfer: null,
        error: "Error de conexión al crear la transferencia",
      };
    }
  },

  async getAllTransfers(): Promise<{
    transfers: Transferencia[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<TransfersResponse>("/transfers");
      if (response && response.success) {
        return { transfers: response.transfers, error: null };
      } else {
        return { transfers: [], error: "Error al obtener las transferencias" };
      }
    } catch {
      return {
        transfers: [],
        error: "Error de conexión al obtener transferencias",
      };
    }
  },

  async getPendingTransfers(): Promise<{
    transfers: Transferencia[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<TransfersResponse>(
        "/transfer-approvals"
      );
      if (response && response.success) {
        return { transfers: response.transfers, error: null };
      } else {
        return {
          transfers: [],
          error: "Error al obtener las transferencias pendientes",
        };
      }
    } catch {
      return {
        transfers: [],
        error: "Error de conexión al obtener transferencias pendientes",
      };
    }
  },

  async approveTransfer(
    transferId: string,
    observaciones?: string
  ): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      const response = await apiService.patch<TransferResponse>(
        `/transfer-approvals/${transferId}/approve`,
        { observaciones }
      );
      if (response && response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: "Error al aprobar la transferencia" };
      }
    } catch {
      return {
        transfer: null,
        error: "Error de conexión al aprobar transferencia",
      };
    }
  },

  async rejectTransfer(
    transferId: string,
    observaciones?: string
  ): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      const response = await apiService.patch<TransferResponse>(
        `/transfer-approvals/${transferId}/reject`,
        { observaciones }
      );
      if (response && response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: "Error al rechazar la transferencia" };
      }
    } catch {
      return {
        transfer: null,
        error: "Error de conexión al rechazar transferencia",
      };
    }
  },
};
