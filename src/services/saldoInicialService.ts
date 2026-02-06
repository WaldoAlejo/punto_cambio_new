import { apiService, ApiError } from "./apiService";
import { SaldoInicial, VistaSaldosPorPunto, MovimientoSaldo } from "../types";

type ApiOk<T> = { success: true } & T;
type ApiFail = {
  success: false;
  error?: string;
  message?: string;
  details?: string;
  code?: string;
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

export const saldoInicialService = {
  // Obtener saldos iniciales por punto
  async getSaldosInicialesByPoint(
    pointId: string
  ): Promise<{ saldos: SaldoInicial[]; error: string | null }> {
    try {
      const response = await apiService.get<
        ApiOk<{ saldos: SaldoInicial[] }> | ApiFail
      >(`/saldos-iniciales/${pointId}`);

      if (response.success) {
        return { saldos: response.saldos ?? [], error: null };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error ||
          r.message ||
          r.details ||
          "Error al obtener los saldos iniciales";
        return { saldos: [], error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(
        e,
        "Error de conexión al obtener saldos iniciales"
      );
      console.error("Error fetching initial balances:", e);
      return { saldos: [], error: msg };
    }
  },

  // Asignar saldo inicial (incremental) a un punto de atención
  async asignarSaldoInicial(data: {
    punto_atencion_id: string;
    moneda_id: string;
    cantidad_inicial: number;
    billetes?: number;
    monedas_fisicas?: number;
    observaciones?: string;
  }): Promise<{
    saldo: SaldoInicial | null;
    error: string | null;
    updated?: boolean;
  }> {
    try {
      const response = await apiService.post<
        ApiOk<{ saldo: SaldoInicial; updated?: boolean }> | ApiFail
      >("/saldos-iniciales", data);

      if (response.success) {
        return { saldo: response.saldo, error: null, updated: response.updated };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error ||
          r.message ||
          r.details ||
          "Error al asignar el saldo inicial";
        return { saldo: null, error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(e, "Error de conexión al asignar saldo inicial");
      console.error("Error assigning initial balance:", e);
      return { saldo: null, error: msg };
    }
  },

  // Obtener vista consolidada de saldos por punto
  async getVistaSaldosPorPunto(opts?: {
    pointId?: string;
    reconciliar?: boolean;
  }): Promise<{
    saldos: VistaSaldosPorPunto[];
    error: string | null;
  }> {
    try {
      if (import.meta.env.DEV) {
        console.warn(
          "🔍 saldoInicialService.getVistaSaldosPorPunto: Iniciando solicitud..."
        );
      }

      const params = new URLSearchParams();
      if (opts?.pointId) params.set("pointId", opts.pointId);
      if (opts?.reconciliar) params.set("reconciliar", "true");
      const qs = params.toString();
      const url = qs ? `/vista-saldos-puntos?${qs}` : "/vista-saldos-puntos";

      const response = await apiService.get<
        ApiOk<{ saldos: VistaSaldosPorPunto[] }> | ApiFail
      >(url);
      if (import.meta.env.DEV) {
        console.warn(
          "💰 saldoInicialService.getVistaSaldosPorPunto: Respuesta recibida:",
          response
        );
      }

      if (response.success) {
        const saldos = response.saldos ?? [];
        if (import.meta.env.DEV) {
          console.warn(
            `✅ getVistaSaldosPorPunto: ${saldos.length} saldos obtenidos`
          );
        }
        return { saldos, error: null };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error ||
          r.message ||
          r.details ||
          "Error al obtener la vista de saldos";
        console.error(
          "❌ getVistaSaldosPorPunto - Error en respuesta:",
          response
        );
        return { saldos: [], error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(
        e,
        "Error de conexión al obtener vista de saldos"
      );
      console.error("❌ Error fetching balance view:", e);
      return { saldos: [], error: msg };
    }
  },

  // Obtener movimientos de saldo por punto
  async getMovimientosSaldo(
    pointId: string,
    limit = 50
  ): Promise<{ movimientos: MovimientoSaldo[]; error: string | null }> {
    try {
      const response = await apiService.get<
        ApiOk<{ movimientos: MovimientoSaldo[] }> | ApiFail
      >(`/movimientos-saldo/${pointId}?limit=${limit}`);

      if (response.success) {
        return {
          movimientos: response.movimientos ?? [],
          error: null,
        };
      } else {
        const r = response as ApiFail;
        const msg =
          r.error ||
          r.message ||
          r.details ||
          "Error al obtener los movimientos de saldo";
        return { movimientos: [], error: msg };
      }
    } catch (e) {
      const msg = extractErrorMessage(
        e,
        "Error de conexión al obtener movimientos de saldo"
      );
      console.error("Error fetching balance movements:", e);
      return { movimientos: [], error: msg };
    }
  },
};
