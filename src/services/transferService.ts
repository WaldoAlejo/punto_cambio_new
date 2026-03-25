import { apiService } from "./apiService";
import { Transferencia, ResponsableMovilizacion } from "../types";
import { generateIdempotencyKey } from "../utils/idempotency";

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
  via?: "EFECTIVO" | "BANCO" | "MIXTO";
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
      // Validar datos antes de enviar
      if (!data.destino_id || !data.moneda_id || !data.monto || data.monto <= 0) {
        return { 
          transfer: null, 
          error: "Datos incompletos: destino, moneda y monto son requeridos" 
        };
      }

      // Asegurar que el monto sea número
      const payload = {
        ...data,
        monto: Number(data.monto),
        // Agregar campo via por defecto si no viene
        via: (data as unknown as Record<string, string>).via || "EFECTIVO",
      };

      console.log("[TransferService] Enviando datos:", payload);
      
      // 🔑 Generar clave de idempotencia única para prevenir duplicados
      const idempotencyKey = generateIdempotencyKey("transfer");

      const response = await apiService.post<TransferResponse>(
        "/transfers",
        payload,
        idempotencyKey
      );

      if (response && response.success && response.transfer) {
        return { transfer: response.transfer, error: null };
      } else {
        const errorMsg = response?.message || "Error al crear la transferencia";
        return { transfer: null, error: errorMsg };
      }
    } catch (error) {
      console.error("[TransferService] Error completo:", error);
      
      // Manejar ApiError
      if (error instanceof Error) {
        // Si es ApiError, tiene status y payload
        const apiError = error as { status?: number; payload?: { error?: string; message?: string; details?: unknown } };
        if (apiError.payload) {
          const errorMsg = apiError.payload.error || apiError.payload.message || JSON.stringify(apiError.payload);
          return { transfer: null, error: errorMsg };
        }
        return { transfer: null, error: error.message };
      }
      
      return {
        transfer: null,
        error: "Error de conexión al crear la transferencia. Verifique su conexión e intente nuevamente.",
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

  async getPendingAcceptanceTransfers(pointId?: string): Promise<{
    transfers: Transferencia[];
    error: string | null;
  }> {
    try {
      const endpoint = pointId
        ? `/transfers/pending-acceptance?point_id=${encodeURIComponent(pointId)}`
        : "/transfers/pending-acceptance";

      const response = await apiService.get<TransfersResponse>(endpoint);
      if (response && response.success) {
        return { transfers: response.transfers, error: null };
      } else {
        return {
          transfers: [],
          error: "Error al obtener las transferencias pendientes de aceptación",
        };
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const err = error as { response?: { data?: { error?: string; message?: string } } };
        const msg = err.response?.data?.error || err.response?.data?.message;
        if (msg) {
          return { transfers: [], error: msg };
        }
      }
      return {
        transfers: [],
        error: "Error de conexión al obtener transferencias pendientes de aceptación",
      };
    }
  },

  async acceptTransfer(
    transferId: string,
    observaciones?: string
  ): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      const response = await apiService.post<TransferResponse>(
        `/transfer-approvals/${transferId}/accept`,
        { observaciones }
      );
      if (response && response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: response?.message || "Error al aceptar la transferencia" };
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
        error: "Error de conexión al aceptar transferencia",
      };
    }
  },

  async rejectPendingTransfer(
    transferId: string,
    observaciones?: string
  ): Promise<{ transfer: Transferencia | null; error: string | null }> {
    try {
      const response = await apiService.post<TransferResponse>(
        `/transfer-approvals/${transferId}/reject`,
        { observaciones }
      );
      if (response && response.success) {
        return { transfer: response.transfer, error: null };
      } else {
        return { transfer: null, error: response?.message || "Error al rechazar la transferencia" };
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
        error: "Error de conexión al rechazar transferencia",
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

  async cancelTransfer(
    transferId: string,
    observaciones_rechazo?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await apiService.post<{
        success: boolean;
        message: string;
      }>(
        `/transfers/${transferId}/cancel`,
        { observaciones_rechazo }
      );
      if (response && response.success) {
        return { success: true, error: null };
      } else {
        return { success: false, error: response?.message || "Error al cancelar la transferencia" };
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const err = error as { response?: { data?: { error?: string } } };
        if (err.response?.data?.error) {
          return { success: false, error: err.response.data.error };
        }
      }
      return {
        success: false,
        error: "Error de conexión al cancelar transferencia",
      };
    }
  },
};
