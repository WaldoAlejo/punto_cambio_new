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
  error?: string;
}

interface ExchangesResponse {
  exchanges: CambioDivisa[];
  success: boolean;
  error?: string;
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
  error?: string;
}

// -------- Utils locales (sin cambiar el flujo existente) --------
const trim = (v?: string | null) => (v ?? "").trim();

const toISOIfDate = (v?: string | Date | null): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s ? new Date(s).toISOString() : null;
};

/**
 * Sanitiza el payload antes de enviarlo al backend para evitar rechazos por:
 * - strings vacíos en campos opcionales (se mandan como null)
 * - fechas tipo Date (se mandan en ISO string)
 * - espacios en blanco en campos de texto
 */
const sanitizeCreatePayload = (
  data: CreateExchangeData
): CreateExchangeData => {
  const isTransfer = data.metodo_entrega === "transferencia";

  // Documento cae por defecto a cédula si viene vacío (coincide con backend)
  const documento =
    trim(data.datos_cliente.documento) || trim(data.datos_cliente.cedula) || "";

  return {
    ...data,
    datos_cliente: {
      nombre: trim(data.datos_cliente.nombre),
      apellido: trim(data.datos_cliente.apellido),
      cedula: trim(data.datos_cliente.cedula),
      documento,
      telefono: trim(data.datos_cliente.telefono) || undefined,
    },
    observacion: trim(data.observacion) || undefined,

    // Solo si es transferencia dejamos los campos; si no, forzamos null
    transferencia_banco: isTransfer
      ? trim(data.transferencia_banco) || null
      : null,
    transferencia_numero: isTransfer
      ? trim(data.transferencia_numero) || null
      : null,
    transferencia_imagen_url: isTransfer
      ? trim(data.transferencia_imagen_url) || null
      : null,

    // Fechas en ISO o null
    abono_inicial_fecha:
      data.abono_inicial_fecha !== undefined
        ? toISOIfDate(data.abono_inicial_fecha)
        : null,

    // Normalizamos nulos para backend (evita undefined)
    abono_inicial_monto:
      data.abono_inicial_monto !== undefined ? data.abono_inicial_monto : null,
    abono_inicial_recibido_por:
      data.abono_inicial_recibido_por !== undefined
        ? data.abono_inicial_recibido_por
        : null,
    saldo_pendiente:
      data.saldo_pendiente !== undefined ? data.saldo_pendiente : null,
    referencia_cambio_principal: trim(data.referencia_cambio_principal) || null,
  };
};

export const exchangeService = {
  async createExchange(
    data: CreateExchangeData
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      const payload = sanitizeCreatePayload(data);

      const response = await apiService.post<ExchangeResponse>(
        "/exchanges",
        payload
      );

      if (response?.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return {
          exchange: null,
          error: response?.error || "Error al crear el cambio de divisa",
        };
      }
    } catch (error: any) {
      console.error("Error creating exchange:", error);
      return {
        exchange: null,
        error:
          error?.message || "Error de conexión al crear el cambio de divisa",
      };
    }
  },

  async getAllExchanges(params?: {
    date?: string;
    from?: string;
    to?: string;
  }): Promise<{
    exchanges: CambioDivisa[];
    error: string | null;
  }> {
    try {
      const qs = new URLSearchParams();
      if (params?.date) qs.set("date", params.date);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      const url = qs.toString() ? `/exchanges?${qs}` : "/exchanges";
      const response = await apiService.get<ExchangesResponse>(url);

      if (response?.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: response?.error || "Error al obtener los cambios de divisa",
        };
      }
    } catch (error: any) {
      console.error("Error fetching exchanges:", error);
      return {
        exchanges: [],
        error: error?.message || "Error de conexión al obtener cambios",
      };
    }
  },

  async getExchangesByPoint(
    pointId: string,
    params?: { date?: string; from?: string; to?: string }
  ): Promise<{ exchanges: CambioDivisa[]; error: string | null }> {
    try {
      const qs = new URLSearchParams();
      qs.set("point_id", pointId);
      if (params?.date) qs.set("date", params.date);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      const response = await apiService.get<ExchangesResponse>(
        `/exchanges?${qs.toString()}`
      );

      if (response?.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: response?.error || "Error al obtener los cambios del punto",
        };
      }
    } catch (error: any) {
      console.error("Error fetching exchanges by point:", error);
      return {
        exchanges: [],
        error:
          error?.message || "Error de conexión al obtener cambios del punto",
      };
    }
  },

  async getPendingExchangesByPoint(
    pointId: string
  ): Promise<{ exchanges: CambioDivisa[]; error: string | null }> {
    try {
      const response = await apiService.get<ExchangesResponse>(
        `/exchanges/pending?pointId=${encodeURIComponent(pointId)}`
      );

      if (response?.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error:
            response?.error ||
            "Error al obtener los cambios pendientes del punto",
        };
      }
    } catch (error: any) {
      console.error("Error fetching pending exchanges by point:", error);
      return {
        exchanges: [],
        error:
          error?.message ||
          "Error de conexión al obtener cambios pendientes del punto",
      };
    }
  },

  async getPartialExchanges(
    pointId?: string
  ): Promise<{ exchanges: CambioDivisa[]; error: string | null }> {
    try {
      const response = await apiService.get<ExchangesResponse>(
        `/exchanges/partial?pointId=${encodeURIComponent(pointId || "ALL")}`
      );

      if (response?.success) {
        return { exchanges: response.exchanges, error: null };
      } else {
        return {
          exchanges: [],
          error: response?.error || "Error al obtener los cambios parciales",
        };
      }
    } catch (error: any) {
      console.error("Error fetching partial exchanges:", error);
      return {
        exchanges: [],
        error:
          error?.message ||
          "Error de conexión al obtener cambios parciales",
      };
    }
  },

  async closePendingExchange(
    exchangeId: string
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      const response = await apiService.patch<ExchangeResponse>(
        `/exchanges/${encodeURIComponent(exchangeId)}/cerrar`
      );

      if (response?.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return {
          exchange: null,
          error: response?.error || "Error al cerrar el cambio pendiente",
        };
      }
    } catch (error: any) {
      console.error("Error closing pending exchange:", error);
      return {
        exchange: null,
        error: error?.message || "Error de conexión al cerrar el cambio",
      };
    }
  },

  async completeExchange(
    exchangeId: string,
    deliveryDetails: {
      metodoEntrega: "efectivo" | "transferencia";
      transferenciaNumero?: string;
      transferenciaBanco?: string;
      transferenciaImagen?: File | null;
      divisasRecibidas?: {
        billetes?: number;
        monedas?: number;
        total?: number;
      };
    }
  ): Promise<{ exchange: CambioDivisa | null; error: string | null }> {
    try {
      const isTransfer = deliveryDetails.metodoEntrega === "transferencia";
      const body = {
        metodo_entrega: deliveryDetails.metodoEntrega,
        transferencia_numero: isTransfer
          ? trim(deliveryDetails.transferenciaNumero) || null
          : null,
        transferencia_banco: isTransfer
          ? trim(deliveryDetails.transferenciaBanco) || null
          : null,
        transferencia_imagen_url: isTransfer
          ? deliveryDetails.transferenciaImagen
            ? "uploaded"
            : null
          : null,
        divisas_recibidas_billetes:
          deliveryDetails.divisasRecibidas?.billetes ?? 0,
        divisas_recibidas_monedas:
          deliveryDetails.divisasRecibidas?.monedas ?? 0,
        divisas_recibidas_total: deliveryDetails.divisasRecibidas?.total ?? 0,
      };

      const response = await apiService.patch<ExchangeResponse>(
        `/exchanges/${encodeURIComponent(exchangeId)}/completar`,
        body
      );

      if (response?.success) {
        return { exchange: response.exchange, error: null };
      } else {
        return {
          exchange: null,
          error: response?.error || "Error al completar el cambio",
        };
      }
    } catch (error: any) {
      console.error("Error completing exchange:", error);
      return {
        exchange: null,
        error: error?.message || "Error de conexión al completar el cambio",
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

      if (response?.success) {
        return { clientes: response.clientes, error: null };
      } else {
        return {
          clientes: [],
          error: response?.error || "Error al buscar clientes",
        };
      }
    } catch (error: any) {
      console.error("Error searching customers:", error);
      return {
        clientes: [],
        error: error?.message || "Error de conexión al buscar clientes",
      };
    }
  },

  async deleteExchange(
    id: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const resp = await apiService.delete<{
        success: boolean;
        error?: string;
      }>(`/exchanges/${encodeURIComponent(id)}`);
      if (resp && (resp as any).success) {
        return { success: true, error: null };
      }
      return {
        success: false,
        error: (resp as any)?.error || "No se pudo eliminar",
      };
    } catch (error: any) {
      console.error("Error deleting exchange:", error);
      // Mapear 400 a mensaje amigable específico
      if (typeof error?.status === "number" && error.status === 400) {
        const serverMsg = error?.payload?.error || error?.message || "";
        if (
          /Solo se pueden eliminar (cambios|movimientos) del día actual/i.test(
            serverMsg
          )
        ) {
          return {
            success: false,
            error: "Solo puedes eliminar registros del día de hoy",
          };
        }
        return { success: false, error: serverMsg || "Solicitud inválida" };
      }
      return { success: false, error: error?.message || "Error de conexión" };
    }
  },
};
