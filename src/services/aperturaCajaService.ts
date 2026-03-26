import { apiService, ApiError } from "./apiService";

export interface Billete {
  denominacion: number;
  cantidad: number;
}

export interface Moneda {
  denominacion: number;
  cantidad: number;
}

export interface ConteoMoneda {
  moneda_id: string;
  billetes: Billete[];
  monedas: Moneda[];
  total: number;
}

export interface DiferenciaMoneda {
  moneda_id: string;
  codigo: string;
  esperado: number;
  fisico: number;
  diferencia: number;
  fuera_tolerancia: boolean;
}

export interface SaldoEsperado {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  cantidad: number;
  billetes: number;
  monedas: number;
  denominaciones?: {
    billetes: number[];
    monedas: number[];
  };
}

export interface ConteoServicioExterno {
  servicio: string;
  servicio_nombre: string;
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_sistema: number;
  saldo_validado?: number;
  diferencia?: number;
  observaciones?: string;
}

export interface AperturaCaja {
  id: string;
  jornada_id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha: string;
  hora_inicio_conteo: string | null;
  hora_fin_conteo: string | null;
  hora_apertura: string | null;
  saldo_esperado: SaldoEsperado[];
  conteo_fisico: ConteoMoneda[];
  saldos_servicios_externos?: ConteoServicioExterno[];
  conteo_servicios_externos?: ConteoServicioExterno[];
  estado: "PENDIENTE" | "EN_CONTEO" | "CUADRADO" | "CON_DIFERENCIA" | "RESUELTO" | "ABIERTA" | "RECHAZADO";
  diferencias: DiferenciaMoneda[] | null;
  tolerancia_usd: string;
  tolerancia_otras: string;
  requiere_aprobacion: boolean;
  aprobado_por: string | null;
  hora_aprobacion: string | null;
  metodo_verificacion: string | null;
  link_videollamada: string | null;
  fotos_urls: string[] | null;
  observaciones_operador: string | null;
  observaciones_admin: string | null;
  created_at: string;
  updated_at: string;
  // Campos adicionales para arqueo
  tipo_arqueo?: "COMPLETO" | "PARCIAL";
  monedas_excluidas?: Array<{
    moneda_id: string;
    codigo: string;
    razon: string;
  }>;
  requiere_arqueo_completo?: boolean;
  usuario?: {
    id: string;
    nombre: string;
    username: string;
  };
  puntoAtencion?: {
    id: string;
    nombre: string;
    ciudad: string;
    direccion?: string;
  };
  aprobador?: {
    id: string;
    nombre: string;
    username: string;
  } | null;
}

type ApiOk<T> = { success: true } & T;
type ApiFail = {
  success: false;
  error?: string;
  message?: string;
  details?: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object";

const getMessageFromPayload = (payload: unknown): string => {
  if (!isRecord(payload)) return "";
  const error = payload.error;
  const message = payload.message;
  const details = payload.details;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof message === "string" && message.trim()) return message;
  if (typeof details === "string" && details.trim()) return details;
  return "";
};

function extractErrorMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) {
    return getMessageFromPayload(e.payload) || e.message || fallback;
  }

  if (e instanceof Error) {
    return e.message || fallback;
  }

  if (isRecord(e)) {
    const message = e.message;
    const payload = e.payload;
    if (typeof message === "string" && message.trim()) return message;
    return getMessageFromPayload(payload) || fallback;
  }

  return fallback;
}

export const aperturaCajaService = {
  // Iniciar proceso de apertura de caja
  async iniciarApertura(jornada_id: string): Promise<{
    apertura: AperturaCaja | null;
    error: string | null;
    message?: string;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{ apertura: AperturaCaja; message?: string }> | ApiFail
      >("/apertura-caja/iniciar", { jornada_id });

      if (response.success) {
        return {
          apertura: response.apertura,
          error: null,
          message: response.message,
        };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error || r.message || r.details || "Error al iniciar apertura";
        return { apertura: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión al iniciar apertura");
      console.error("Error iniciando apertura:", e);
      return { apertura: null, error: msg };
    }
  },

  // Guardar conteo físico
  async guardarConteo(
    apertura_id: string,
    conteos: ConteoMoneda[],
    fotos_urls?: string[],
    observaciones?: string,
    servicios_externos?: ConteoServicioExterno[]
  ): Promise<{
    apertura: AperturaCaja | null;
    diferencias: DiferenciaMoneda[] | null;
    cuadrado: boolean;
    puede_abrir: boolean;
    error: string | null;
    message?: string;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{
          apertura: AperturaCaja;
          diferencias: DiferenciaMoneda[];
          cuadrado: boolean;
          puede_abrir: boolean;
          message?: string;
        }> | ApiFail
      >("/apertura-caja/conteo", {
        apertura_id,
        conteos,
        fotos_urls,
        observaciones,
        servicios_externos,
      });

      if (response.success) {
        return {
          apertura: response.apertura,
          diferencias: response.diferencias || null,
          cuadrado: response.cuadrado,
          puede_abrir: response.puede_abrir,
          error: null,
          message: response.message,
        };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error || r.message || r.details || "Error al guardar conteo";
        return {
          apertura: null,
          diferencias: null,
          cuadrado: false,
          puede_abrir: false,
          error: msg,
        };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión al guardar conteo");
      console.error("Error guardando conteo:", e);
      return {
        apertura: null,
        diferencias: null,
        cuadrado: false,
        puede_abrir: false,
        error: msg,
      };
    }
  },

  // Confirmar apertura (cuando cuadra)
  async confirmarApertura(apertura_id: string): Promise<{
    apertura: AperturaCaja | null;
    error: string | null;
    message?: string;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{ apertura: AperturaCaja; message?: string }> | ApiFail
      >("/apertura-caja/confirmar", { apertura_id });

      if (response.success) {
        return {
          apertura: response.apertura,
          error: null,
          message: response.message,
        };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error || r.message || r.details || "Error al confirmar apertura";
        return { apertura: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión al confirmar");
      console.error("Error confirmando apertura:", e);
      return { apertura: null, error: msg };
    }
  },

  // Obtener apertura por ID
  async getApertura(id: string): Promise<{
    apertura: AperturaCaja | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.get<
        ApiOk<{ apertura: AperturaCaja }> | ApiFail
      >(`/apertura-caja/${id}`);

      if (response.success) {
        return { apertura: response.apertura, error: null };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al obtener apertura";
        return { apertura: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error obteniendo apertura:", e);
      return { apertura: null, error: msg };
    }
  },

  // Listar mis aperturas (operador)
  async getMisAperturas(params?: {
    estado?: string;
    fecha?: string;
  }): Promise<{
    aperturas: AperturaCaja[];
    error: string | null;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.estado) queryParams.append("estado", params.estado);
      if (params?.fecha) queryParams.append("fecha", params.fecha);

      const url = `/apertura-caja/mis-aperturas/lista${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const response = await apiService.get<ApiOk<{ aperturas: AperturaCaja[] }> | ApiFail>(url);

      if (response.success) {
        return { aperturas: response.aperturas || [], error: null };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al listar aperturas";
        return { aperturas: [], error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error listando aperturas:", e);
      return { aperturas: [], error: msg };
    }
  },

  // ============ ADMIN ============

  // Listar aperturas pendientes (admin)
  async getAperturasPendientes(params?: {
    punto_atencion_id?: string;
    fecha?: string;
  }): Promise<{
    aperturas: AperturaCaja[];
    count: number;
    error: string | null;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.punto_atencion_id)
        queryParams.append("punto_atencion_id", params.punto_atencion_id);
      if (params?.fecha) queryParams.append("fecha", params.fecha);

      const url = `/apertura-caja/pendientes/admin${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const response = await apiService.get<
        ApiOk<{ aperturas: AperturaCaja[]; count: number }> | ApiFail
      >(url);

      if (response.success) {
        return {
          aperturas: response.aperturas || [],
          count: response.count || 0,
          error: null,
        };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error || r.message || r.details || "Error al listar aperturas pendientes";
        return { aperturas: [], count: 0, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error listando aperturas pendientes:", e);
      return { aperturas: [], count: 0, error: msg };
    }
  },

  // Aprobar apertura con diferencia
  async aprobarApertura(
    id: string,
    data: {
      observaciones?: string;
      ajustar_saldos?: boolean;
    }
  ): Promise<{
    apertura: AperturaCaja | null;
    error: string | null;
    message?: string;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{ apertura: AperturaCaja; message?: string }> | ApiFail
      >(`/apertura-caja/${id}/aprobar`, data);

      if (response.success) {
        return {
          apertura: response.apertura,
          error: null,
          message: response.message,
        };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al aprobar";
        return { apertura: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error aprobando apertura:", e);
      return { apertura: null, error: msg };
    }
  },

  // Rechazar apertura
  async rechazarApertura(
    id: string,
    observaciones?: string
  ): Promise<{
    apertura: AperturaCaja | null;
    error: string | null;
    message?: string;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{ apertura: AperturaCaja; message?: string }> | ApiFail
      >(`/apertura-caja/${id}/rechazar`, { observaciones });

      if (response.success) {
        return {
          apertura: response.apertura,
          error: null,
          message: response.message,
        };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al rechazar";
        return { apertura: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error rechazando apertura:", e);
      return { apertura: null, error: msg };
    }
  },

  // ============ HISTORIAL DE ARQUEOS ============

  // Obtener historial de arqueos
  async getHistorialArqueos(params?: {
    punto_atencion_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo_arqueo?: string;
  }): Promise<{
    arqueos: Array<{
      id: string;
      apertura_id: string;
      punto_atencion_id: string;
      usuario_id: string;
      fecha: string;
      tipo_arqueo: "COMPLETO" | "PARCIAL";
      monedas_arqueadas: Array<{
        moneda_id: string;
        codigo: string;
        nombre: string;
        cantidad: number;
      }>;
      monedas_excluidas?: Array<{
        moneda_id: string;
        codigo: string;
        razon: string;
      }>;
      conteo_fisico: ConteoMoneda[];
      diferencias: DiferenciaMoneda[] | null;
      observaciones: string | null;
      created_at: string;
      puntoAtencion?: {
        id: string;
        nombre: string;
        ciudad: string;
      };
      usuario?: {
        id: string;
        nombre: string;
        username: string;
      };
      apertura?: {
        id: string;
        estado: string;
        hora_apertura: string | null;
      };
    }>;
    stats: {
      total_arqueos: number;
      arqueos_completos: number;
      arqueos_parciales: number;
    };
    error: string | null;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.punto_atencion_id) queryParams.append("punto_atencion_id", params.punto_atencion_id);
      if (params?.fecha_desde) queryParams.append("fecha_desde", params.fecha_desde);
      if (params?.fecha_hasta) queryParams.append("fecha_hasta", params.fecha_hasta);
      if (params?.tipo_arqueo) queryParams.append("tipo_arqueo", params.tipo_arqueo);

      const url = `/apertura-caja/arqueos/historial${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`;

      const response = await apiService.get<
        ApiOk<{
          arqueos: Array<{
            id: string;
            apertura_id: string;
            punto_atencion_id: string;
            usuario_id: string;
            fecha: string;
            tipo_arqueo: "COMPLETO" | "PARCIAL";
            monedas_arqueadas: Array<{
              moneda_id: string;
              codigo: string;
              nombre: string;
              cantidad: number;
            }>;
            monedas_excluidas?: Array<{
              moneda_id: string;
              codigo: string;
              razon: string;
            }>;
            conteo_fisico: ConteoMoneda[];
            diferencias: DiferenciaMoneda[] | null;
            observaciones: string | null;
            created_at: string;
            puntoAtencion?: {
              id: string;
              nombre: string;
              ciudad: string;
            };
            usuario?: {
              id: string;
              nombre: string;
              username: string;
            };
            apertura?: {
              id: string;
              estado: string;
              hora_apertura: string | null;
            };
          }>;
          stats: {
            total_arqueos: number;
            arqueos_completos: number;
            arqueos_parciales: number;
          };
        }> | ApiFail
      >(url);

      if (response.success) {
        return {
          arqueos: response.arqueos || [],
          stats: response.stats || { total_arqueos: 0, arqueos_completos: 0, arqueos_parciales: 0 },
          error: null,
        };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al obtener historial de arqueos";
        return { arqueos: [], stats: { total_arqueos: 0, arqueos_completos: 0, arqueos_parciales: 0 }, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error obteniendo historial de arqueos:", e);
      return { arqueos: [], stats: { total_arqueos: 0, arqueos_completos: 0, arqueos_parciales: 0 }, error: msg };
    }
  },

  // Obtener detalle de un arqueo específico
  async getArqueoDetalle(id: string): Promise<{
    arqueo: {
      id: string;
      apertura_id: string;
      punto_atencion_id: string;
      usuario_id: string;
      fecha: string;
      tipo_arqueo: "COMPLETO" | "PARCIAL";
      monedas_arqueadas: Array<{
        moneda_id: string;
        codigo: string;
        nombre: string;
        cantidad: number;
      }>;
      monedas_excluidas?: Array<{
        moneda_id: string;
        codigo: string;
        razon: string;
      }>;
      conteo_fisico: ConteoMoneda[];
      diferencias: DiferenciaMoneda[] | null;
      observaciones: string | null;
      created_at: string;
      puntoAtencion?: {
        id: string;
        nombre: string;
        ciudad: string;
      };
      usuario?: {
        id: string;
        nombre: string;
        username: string;
      };
      apertura?: {
        id: string;
        estado: string;
        hora_apertura: string | null;
        jornada?: {
          id: string;
          fecha_inicio: string;
          fecha_salida: string | null;
        };
      };
    } | null;
    error: string | null;
  }> {
    try {
      const response = await apiService.get<
        ApiOk<{
          arqueo: {
            id: string;
            apertura_id: string;
            punto_atencion_id: string;
            usuario_id: string;
            fecha: string;
            tipo_arqueo: "COMPLETO" | "PARCIAL";
            monedas_arqueadas: Array<{
              moneda_id: string;
              codigo: string;
              nombre: string;
              cantidad: number;
            }>;
            monedas_excluidas?: Array<{
              moneda_id: string;
              codigo: string;
              razon: string;
            }>;
            conteo_fisico: ConteoMoneda[];
            diferencias: DiferenciaMoneda[] | null;
            observaciones: string | null;
            created_at: string;
            puntoAtencion?: {
              id: string;
              nombre: string;
              ciudad: string;
            };
            usuario?: {
              id: string;
              nombre: string;
              username: string;
            };
            apertura?: {
              id: string;
              estado: string;
              hora_apertura: string | null;
              jornada?: {
                id: string;
                fecha_inicio: string;
                fecha_salida: string | null;
              };
            };
          };
        }> | ApiFail
      >(`/apertura-caja/arqueos/${id}`);

      if (response.success) {
        return { arqueo: response.arqueo, error: null };
      } else {
        const r = response as ApiFail;
        const msg = r.error || r.message || r.details || "Error al obtener detalle del arqueo";
        return { arqueo: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión");
      console.error("Error obteniendo detalle del arqueo:", e);
      return { arqueo: null, error: msg };
    }
  },
};

export default aperturaCajaService;
