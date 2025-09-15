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

function extractErrorMessage(e: unknown, fallback: string) {
  const err = e as any;
  const fromPayload =
    err?.payload?.error ||
    err?.payload?.message ||
    err?.payload?.details ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.response?.data?.details;
  const fromMessage = err?.message;
  return (fromPayload || fromMessage || fallback) as string;
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

      if ((response as any).success) {
        return { saldos: (response as any).saldos ?? [], error: null };
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

      if ((response as any).success) {
        const { saldo, updated } = response as any;
        return { saldo, error: null, updated };
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
      const err = e as ApiError | Error;
      const msg =
        (err as any)?.payload?.error ||
        (err as any)?.payload?.details ||
        (err as any)?.payload?.message ||
        err.message ||
        "Error de conexión al asignar saldo inicial";
      console.error("Error assigning initial balance:", err);
      return { saldo: null, error: msg };
    }
  },

  // Obtener vista consolidada de saldos por punto
  async getVistaSaldosPorPunto(): Promise<{
    saldos: VistaSaldosPorPunto[];
    error: string | null;
  }> {
    try {
      console.log(
        "🔍 saldoInicialService.getVistaSaldosPorPunto: Iniciando solicitud..."
      );
      const response = await apiService.get<
        ApiOk<{ saldos: VistaSaldosPorPunto[] }> | ApiFail
      >("/vista-saldos-puntos");
      console.log(
        "💰 saldoInicialService.getVistaSaldosPorPunto: Respuesta recibida:",
        response
      );

      if ((response as any).success) {
        const saldos = (response as any).saldos ?? [];
        console.log(
          `✅ getVistaSaldosPorPunto: ${saldos.length} saldos obtenidos`
        );
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

      if ((response as any).success) {
        return {
          movimientos: (response as any).movimientos ?? [],
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
