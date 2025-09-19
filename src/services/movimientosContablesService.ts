import axiosInstance from "./axiosInstance";
import {
  MovimientoSaldo,
  CambioDivisa,
  MovimientoContableData,
  SaldoActualizado,
  ResultadoMovimientoContable,
} from "../types";

export const movimientosContablesService = {
  /**
   * Procesa los movimientos contables para un cambio de divisas
   * - Resta la moneda entregada al cliente (EGRESO)
   * - Suma la moneda recibida del cliente (INGRESO)
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

      // 1. EGRESO: Moneda que entregamos al cliente (la que sale de nuestro saldo)
      movimientos.push({
        punto_atencion_id: cambio.punto_atencion_id,
        moneda_id: cambio.moneda_destino_id, // La moneda que entregamos
        tipo_movimiento: "EGRESO",
        monto: cambio.monto_destino, // Monto que entregamos
        usuario_id,
        referencia_id: cambio.id,
        tipo_referencia: "CAMBIO_DIVISA",
        descripcion: `Cambio de divisas - Entrega de ${
          cambio.monedaDestino?.codigo || "moneda"
        } al cliente`,
      });

      // 2. INGRESO: Moneda que recibimos del cliente (la que entra a nuestro saldo)
      movimientos.push({
        punto_atencion_id: cambio.punto_atencion_id,
        moneda_id: cambio.moneda_origen_id, // La moneda que recibimos
        tipo_movimiento: "INGRESO",
        monto: cambio.monto_origen, // Monto que recibimos
        usuario_id,
        referencia_id: cambio.id,
        tipo_referencia: "CAMBIO_DIVISA",
        descripcion: `Cambio de divisas - Recepción de ${
          cambio.monedaOrigen?.codigo || "moneda"
        } del cliente`,
      });

      const response = await axiosInstance.post<ResultadoMovimientoContable>(
        "/movimientos-contables/procesar-cambio",
        {
          cambio_id: cambio.id,
          movimientos,
        }
      );

      return { result: response.data, error: null };
    } catch (error: any) {
      console.error("Error al procesar movimientos contables:", error);
      return {
        result: null,
        error:
          error.response?.data?.message ||
          "Error al procesar movimientos contables",
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
      const response = await axiosInstance.get<{ saldo: number }>(
        `/saldos-actuales/${punto_atencion_id}/${moneda_id}`
      );

      return { saldo: response.data.saldo, error: null };
    } catch (error: any) {
      console.error("Error al obtener saldo actual:", error);
      return {
        saldo: null,
        error: error.response?.data?.message || "Error al obtener saldo actual",
      };
    }
  },

  /**
   * Obtiene todos los saldos actuales de un punto de atención
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
      const response = await axiosInstance.get<{
        saldos: Array<{
          moneda_id: string;
          moneda_codigo: string;
          saldo: number;
        }>;
      }>(`/saldos-actuales/${punto_atencion_id}`);

      return { saldos: response.data.saldos, error: null };
    } catch (error: any) {
      console.error("Error al obtener saldos actuales:", error);
      return {
        saldos: null,
        error:
          error.response?.data?.message || "Error al obtener saldos actuales",
      };
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
      }>("/movimientos-contables/validar-saldo", {
        punto_atencion_id,
        moneda_id: moneda_destino_id,
        monto_requerido: monto_destino,
      });

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
        error: error.response?.data?.message || "Error al validar saldo",
      };
    }
  },

  /**
   * Obtiene el historial de movimientos de una moneda específica
   */
  async getHistorialMovimientos(
    punto_atencion_id: string,
    moneda_id?: string,
    limit = 50,
    opts?: { date?: string; from?: string; to?: string }
  ): Promise<{ movimientos: MovimientoSaldo[] | null; error: string | null }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });

      if (moneda_id) {
        params.append("moneda_id", moneda_id);
      }
      if (opts?.date) params.append("date", opts.date);
      if (opts?.from) params.append("from", opts.from);
      if (opts?.to) params.append("to", opts.to);

      const response = await axiosInstance.get<{
        movimientos: MovimientoSaldo[];
      }>(`/movimientos-contables/${punto_atencion_id}?${params}`);

      return { movimientos: response.data.movimientos, error: null };
    } catch (error: any) {
      console.error("Error al obtener historial de movimientos:", error);
      return {
        movimientos: null,
        error: error.response?.data?.message || "Error al obtener historial",
      };
    }
  },
};

export default movimientosContablesService;
