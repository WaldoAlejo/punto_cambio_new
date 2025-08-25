import { apiService } from "./apiService";
import { CambioDivisa } from "../types";

export interface CreateExchangeData {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;

  // Tasas diferenciadas
  tasa_cambio_billetes: number;
  tasa_cambio_monedas: number;

  // Detalles de divisas entregadas (por el cliente)
  divisas_entregadas_billetes: number;
  divisas_entregadas_monedas: number;
  divisas_entregadas_total: number;

  // Detalles de divisas recibidas (por el cliente)
  divisas_recibidas_billetes: number;
  divisas_recibidas_monedas: number;
  divisas_recibidas_total: number;

  tipo_operacion: "COMPRA" | "VENTA";
  punto_atencion_id: string;
  datos_cliente: {
    nombre: string;
    apellido: string;
    documento: string;
    cedula: string;
    telefono?: string;
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

export interface ClienteEncontrado {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  fuente: "exchange" | "recibo";
  fecha_ultima_operacion: string;
  numero_recibo: string | null;
}

interface SearchCustomersResponse {
  clientes: ClienteEncontrado[];
  success: boolean;
}

export const exchangeService = {
  async createExchange(
    data: CreateExchangeData
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      // Creating exchange
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
      // Fetching all exchanges
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
      // Fetching exchanges for point
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

  async getPendingExchangesByPoint(
    pointId: string
  ): Promise<{ exchanges: CambioDivisa[]; error: string | null }> {
    try {
      // Fetching pending exchanges for point
      const response = await apiService.get<ExchangesResponse>(
        `/exchanges/pending?pointId=${pointId}`
      );

      if (response.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: "Error al obtener los cambios pendientes del punto",
        };
      }
    } catch (error) {
      console.error("Error fetching pending exchanges by point:", error);
      return {
        exchanges: [],
        error: "Error de conexión al obtener cambios pendientes del punto",
      };
    }
  },

  async closePendingExchange(
    exchangeId: string
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      // Closing pending exchange
      const response = await apiService.patch<ExchangeResponse>(
        `/exchanges/${exchangeId}/cerrar`
      );

      if (response.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return { exchange: null, error: "Error al cerrar el cambio pendiente" };
      }
    } catch (error) {
      console.error("Error closing pending exchange:", error);
      return { exchange: null, error: "Error de conexión al cerrar el cambio" };
    }
  },

  async completeExchange(
    exchangeId: string,
    deliveryDetails: any
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      const response = await apiService.patch<ExchangeResponse>(
        `/exchanges/${exchangeId}/completar`,
        {
          metodo_entrega: deliveryDetails.metodoEntrega,
          transferencia_numero: deliveryDetails.transferenciaNumero,
          transferencia_banco: deliveryDetails.transferenciaBanco,
          transferencia_imagen_url: deliveryDetails.transferenciaImagen
            ? "uploaded"
            : null,
          divisas_recibidas_billetes:
            deliveryDetails.divisasRecibidas?.billetes || 0,
          divisas_recibidas_monedas:
            deliveryDetails.divisasRecibidas?.monedas || 0,
          divisas_recibidas_total: deliveryDetails.divisasRecibidas?.total || 0,
        }
      );

      if (response.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return { exchange: null, error: "Error al completar el cambio" };
      }
    } catch (error) {
      console.error("Error completing exchange:", error);
      return {
        exchange: null,
        error: "Error de conexión al completar el cambio",
      };
    }
  },

  async searchCustomers(
    query: string
  ): Promise<{ clientes: ClienteEncontrado[]; error: string | null }> {
    try {
      if (!query || query.trim().length < 2) {
        return {
          clientes: [],
          error: "Debe ingresar al menos 2 caracteres para buscar",
        };
      }

      const response = await apiService.get<SearchCustomersResponse>(
        `/exchanges/search-customers?query=${encodeURIComponent(query.trim())}`
      );

      if (response.success) {
        return { clientes: response.clientes, error: null };
      } else {
        return {
          clientes: [],
          error: "Error al buscar clientes",
        };
      }
    } catch (error) {
      console.error("Error searching customers:", error);
      return {
        clientes: [],
        error: "Error de conexión al buscar clientes",
      };
    }
  },
};
