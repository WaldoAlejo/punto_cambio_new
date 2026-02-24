import axiosInstance from "@/services/axiosInstance";

export interface ReconciliacionResult {
  punto_atencion_id: string;
  moneda_id: string;
  saldo_registrado: number;
  saldo_calculado: number;
  diferencia: number;
  ajustado: boolean;
}

export interface SaldoRealResponse {
  punto_atencion_id: string;
  moneda_id?: string;
  saldo_calculado: number;
  basado_en: {
    saldo_inicial_id?: string;
    fecha_saldo_inicial?: string;
    movimientos_contados: number;
  };
}

/**
 * Servicio para operaciones relacionadas con saldos y reconciliación
 * Usa el endpoint /api/saldo-reconciliation/
 */
const saldoService = {
  /**
   * Calcula el saldo real basado en los movimientos históricos
   * desde el último saldo inicial registrado
   */
  async calcularSaldoReal(
    puntoAtencionId: string,
    monedaId?: string
  ): Promise<number> {
    const params = new URLSearchParams();
    params.append("puntoAtencionId", puntoAtencionId);
    if (monedaId) {
      params.append("monedaId", monedaId);
    }

    const response = await axiosInstance.get<{ success: boolean; data: SaldoRealResponse }>(
      `/api/saldo-reconciliation/calcular-real?${params.toString()}`
    );
    return response.data.data.saldo_calculado;
  },

  /**
   * Reconcilia el saldo registrado con el saldo calculado
   * Si hay diferencia, actualiza el saldo en la base de datos
   */
  async reconciliarSaldo(
    puntoAtencionId: string,
    monedaId?: string
  ): Promise<ReconciliacionResult> {
    const response = await axiosInstance.post<{ success: boolean; data: ReconciliacionResult }>(
      "/api/saldo-reconciliation/reconciliar",
      {
        puntoAtencionId,
        monedaId,
      }
    );
    return response.data.data;
  },

  /**
   * Obtiene el historial de movimientos de saldo para un punto y moneda
   * Usa el endpoint existente de movimientos-saldo
   */
  async getMovimientos(
    puntoAtencionId: string,
    monedaId: string,
    desde?: string,
    hasta?: string
  ) {
    const params = new URLSearchParams();
    params.append("puntoAtencionId", puntoAtencionId);
    params.append("monedaId", monedaId);
    if (desde) params.append("desde", desde);
    if (hasta) params.append("hasta", hasta);

    const response = await axiosInstance.get(
      `/api/movimientos-saldo?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Valida la consistencia de los saldos en todos los puntos de atención
   * Devuelve los puntos/monedas con inconsistencias
   */
  async validarConsistencia(): Promise<{
    valido: boolean;
    inconsistencias: Array<{
      punto_atencion_id: string;
      punto_nombre?: string;
      moneda_id: string;
      moneda_codigo?: string;
      saldo_registrado: number;
      saldo_calculado: number;
      diferencia: number;
    }>;
  }> {
    const response = await axiosInstance.get<{ success: boolean; data: { valido: boolean; inconsistencias: any[] } }>(
      "/api/saldo-reconciliation/validar-consistencia"
    );
    return response.data.data;
  },
};

export default saldoService;
