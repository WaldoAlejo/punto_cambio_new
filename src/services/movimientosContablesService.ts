import axiosInstance from "./axiosInstance";
import {
  MovimientoSaldo,
  CambioDivisa,
  MovimientoContableData,
  ResultadoMovimientoContable,
} from "../types";

/** Extrae mensaje legible si no viene de friendlyMessage */
function extractMsg(err: any): string {
  if (!err) return "Error desconocido";
  if (err.friendlyMessage) return err.friendlyMessage;

  const payload = err?.response?.data;
  if (!payload) return err.message || "Error de red";

  if (typeof payload === "string") return payload;
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

/** Reintento exponencial simple para lecturas GET/POST livianas */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  baseDelayMs = 400
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      // No reintentar en 4xx (salvo 408) ni en errores de validación
      const retriable =
        !status ||
        status >= 500 ||
        status === 408 ||
        e?.code === "ECONNABORTED";
      if (!retriable || i === attempts) break;
      await new Promise((r) => r(baseDelayMs * Math.pow(2, i))); // 400ms, 800ms, 1600ms
    }
  }
  throw lastErr;
}

export const movimientosContablesService = {
  /**
   * Procesa los movimientos contables para un cambio de divisas
   * - EGRESO: moneda que entregamos al cliente
   * - INGRESO: moneda que recibimos del cliente
   */
  async procesarMovimientosCambio(
    cambio: CambioDivisa,
    usuario_id: string
  ): Promise<{
    result: ResultadoMovimientoContable | null;
    error: string | null;
  }> {
    try {
      const movimientos: MovimientoContableData[] = [];

      // 1) EGRESO: moneda entregada
      movimientos.push({
        punto_atencion_id: cambio.punto_atencion_id,
        moneda_id: cambio.moneda_destino_id,
        tipo_movimiento: "EGRESO",
        monto: cambio.monto_destino,
        usuario_id,
        referencia_id: cambio.id,
        tipo_referencia: "CAMBIO_DIVISA",
        descripcion: `Cambio de divisas - Entrega de ${
          cambio.monedaDestino?.codigo || "moneda"
        } al cliente`,
      });

      // 2) INGRESO: moneda recibida
      movimientos.push({
        punto_atencion_id: cambio.punto_atencion_id,
        moneda_id: cambio.moneda_origen_id,
        tipo_movimiento: "INGRESO",
        monto: cambio.monto_origen,
        usuario_id,
        referencia_id: cambio.id,
        tipo_referencia: "CAMBIO_DIVISA",
        descripcion: `Cambio de divisas - Recepción de ${
          cambio.monedaOrigen?.codigo || "moneda"
        } del cliente`,
      });

      const response = await axiosInstance.post<ResultadoMovimientoContable>(
        "/movimientos-contables/procesar-cambio",
        { cambio_id: cambio.id, movimientos },
        { timeout: 12000 }
      );

      return { result: response.data, error: null };
    } catch (error: any) {
      console.error("Error al procesar movimientos contables:", error);
      return {
        result: null,
        error: extractMsg(error) || "Error al procesar movimientos contables",
      };
    }
  },

  /**
   * Obtiene el saldo actual de una moneda en un punto específico
   */
  async getSaldoActual(
    punto_atencion_id: string,
    moneda_id: string
  ): Promise<{ saldo: number | null; error: string | null }> {
    try {
      const response = await withRetry(
        () =>
          axiosInstance.get<{ saldo: number }>(
            `/saldos-actuales/${punto_atencion_id}/${moneda_id}`,
            { timeout: 10000 }
          ),
        2
      );
      return { saldo: response.data.saldo, error: null };
    } catch (error: any) {
      console.error("Error al obtener saldo actual:", error);
      return {
        saldo: null,
        error: extractMsg(error) || "Error al obtener saldo actual",
      };
    }
  },

  /**
   * Obtiene todos los saldos actuales de un punto de atención.
   * - Usa endpoint principal /saldos-actuales/:punto (timeout 15s)
   * - Si falla/timeout, Fallback a /vista-saldos-puntos/:punto (timeout 8s)
   */
  async getSaldosActualesPorPunto(punto_atencion_id: string): Promise<{
    saldos: Array<{
      moneda_id: string;
      moneda_codigo: string;
      saldo: number;
    }> | null;
    error: string | null;
  }> {
    try {
      // 1) Intento principal (con reintento)
      const main = await withRetry(
        () =>
          axiosInstance.get<{
            saldos: Array<{
              moneda_id: string;
              moneda_codigo: string;
              saldo: number;
            }>;
          }>(`/saldos-actuales/${punto_atencion_id}`, { timeout: 15000 }),
        1
      );
      return { saldos: main.data.saldos, error: null };
    } catch (errorMain: any) {
      console.warn(
        "getSaldosActualesPorPunto: endpoint principal falló, probando fallback...",
        errorMain?.message || errorMain
      );

      // 2) Fallback rápido
      try {
        const fallback = await axiosInstance.get<{
          saldos: Array<{
            moneda_id: string;
            moneda_codigo: string;
            saldo: number;
          }>;
        }>(`/vista-saldos-puntos/${punto_atencion_id}`, { timeout: 8000 });

        return { saldos: fallback.data.saldos, error: null };
      } catch (errorFallback: any) {
        console.error("Error al obtener saldos (principal y fallback):", {
          principal: extractMsg(errorMain),
          fallback: extractMsg(errorFallback),
        });
        return {
          saldos: null,
          error:
            extractMsg(errorFallback) ||
            extractMsg(errorMain) ||
            "Error al obtener saldos actuales",
        };
      }
    }
  },

  /**
   * Valida si hay suficiente saldo para realizar un cambio
   */
  async validarSaldoParaCambio(
    punto_atencion_id: string,
    moneda_destino_id: string,
    monto_destino: number
  ): Promise<{ valido: boolean; saldo_actual: number; error: string | null }> {
    try {
      const response = await axiosInstance.post<{
        valido: boolean;
        saldo_actual: number;
        mensaje: string;
      }>(
        "/movimientos-contables/validar-saldo",
        {
          punto_atencion_id,
          moneda_id: moneda_destino_id,
          monto_requerido: monto_destino,
        },
        { timeout: 12000 }
      );

      return {
        valido: response.data.valido,
        saldo_actual: response.data.saldo_actual,
        error: response.data.valido ? null : response.data.mensaje,
      };
    } catch (error: any) {
      console.error("Error al validar saldo:", error);
      return {
        valido: false,
        saldo_actual: 0,
        error: extractMsg(error) || "Error al validar saldo",
      };
    }
  },

  /**
   * Obtiene el historial de movimientos de una moneda específica
   */
  async getHistorialMovimientos(
    punto_atencion_id: string,
    moneda_id?: string,
    limit = 50
  ): Promise<{ movimientos: MovimientoSaldo[] | null; error: string | null }> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (moneda_id) params.append("moneda_id", moneda_id);

      const response = await withRetry(
        () =>
          axiosInstance.get<{ movimientos: MovimientoSaldo[] }>(
            `/movimientos-contables/${punto_atencion_id}?${params.toString()}`,
            { timeout: 12000 }
          ),
        1
      );

      return { movimientos: response.data.movimientos, error: null };
    } catch (error: any) {
      console.error("Error al obtener historial de movimientos:", error);
      return {
        movimientos: null,
        error: extractMsg(error) || "Error al obtener historial",
      };
    }
  },
};

export default movimientosContablesService;
