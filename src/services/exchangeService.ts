import { apiService } from "./apiService";
import { CambioDivisa } from "../types";

export interface CreateExchangeData {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  tipo_operacion: "COMPRA" | "VENTA";
  punto_atencion_id: string;
  datos_cliente: {
    nombre: string;
    apellido: string;
    documento: string;
    cedula: string;
    telefono?: string;
  };
  divisas_entregadas: {
    billetes: number;
    monedas: number;
    total: number;
  };
  divisas_recibidas: {
    billetes: number;
    monedas: number;
    total: number;
  };
  observacion?: string;

  // Métodos de entrega
  metodo_entrega: "efectivo" | "transferencia";
  transferencia_numero?: string | null;
  transferencia_banco?: string | null;
  transferencia_imagen_url?: string | null;

  // ==== FLUJO DE ABONOS PARCIALES ====
  abono_inicial_monto?: number | null;
  abono_inicial_fecha?: string | Date | null;
  abono_inicial_recibido_por?: string | null; // id usuario que recibe abono
  saldo_pendiente?: number | null;
  referencia_cambio_principal?: string | null; // id o número recibo principal si aplica
}

interface ExchangeResponse {
  exchange: CambioDivisa;
  success: boolean;
}

interface ExchangesResponse {
  exchanges: CambioDivisa[];
  success: boolean;
}

export const exchangeService = {
  async createExchange(
    data: CreateExchangeData
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      console.warn("Creating exchange:", data);
      const response = await apiService.post<ExchangeResponse>(
        "/exchanges",
        data
      );

      if (response.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return { exchange: null, error: "Error al crear el cambio de divisa" };
      }
    } catch (error) {
      console.error("Error creating exchange:", error);
      return { exchange: null, error: "Error de conexión al crear el cambio" };
    }
  },

  async getAllExchanges(): Promise<{
    exchanges: CambioDivisa[];
    error: string | null;
  }> {
    try {
      console.warn("Fetching all exchanges");
      const response = await apiService.get<ExchangesResponse>("/exchanges");

      if (response.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: "Error al obtener los cambios de divisa",
        };
      }
    } catch (error) {
      console.error("Error fetching exchanges:", error);
      return { exchanges: [], error: "Error de conexión al obtener cambios" };
    }
  },

  async getExchangesByPoint(
    pointId: string
  ): Promise<{ exchanges: CambioDivisa[]; error: string | null }> {
    try {
      console.warn("Fetching exchanges for point:", pointId);
      const response = await apiService.get<ExchangesResponse>(
        `/exchanges?point_id=${pointId}`
      );

      if (response.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: "Error al obtener los cambios del punto",
        };
      }
    } catch (error) {
      console.error("Error fetching exchanges by point:", error);
      return {
        exchanges: [],
        error: "Error de conexión al obtener cambios del punto",
      };
    }
  },
};
