import { apiService } from "./apiService";
import { SaldoInicial, VistaSaldosPorPunto, MovimientoSaldo } from "../types";

export const saldoInicialService = {
  // Obtener saldos iniciales por punto
  async getSaldosInicialesByPoint(
    pointId: string
  ): Promise<{ saldos: SaldoInicial[]; error: string | null }> {
    try {
      const response = await apiService.get<{
        saldos: SaldoInicial[];
        success: boolean;
      }>(`/saldos-iniciales/${pointId}`);

      if (response.success) {
        return { saldos: response.saldos, error: null };
      } else {
        return { saldos: [], error: "Error al obtener los saldos iniciales" };
      }
    } catch (error) {
      console.error("Error fetching initial balances:", error);
      return {
        saldos: [],
        error: "Error de conexión al obtener saldos iniciales",
      };
    }
  },

  // Asignar saldo inicial a un punto de atención
  async asignarSaldoInicial(data: {
    punto_atencion_id: string;
    moneda_id: string;
    cantidad_inicial: number;
    billetes?: number;
    monedas_fisicas?: number;
    observaciones?: string;
  }): Promise<{ saldo: SaldoInicial | null; error: string | null }> {
    try {
      const response = await apiService.post<{
        saldo: SaldoInicial;
        success: boolean;
      }>("/saldos-iniciales", data);

      if (response.success) {
        return { saldo: response.saldo, error: null };
      } else {
        return { saldo: null, error: "Error al asignar el saldo inicial" };
      }
    } catch (error) {
      console.error("Error assigning initial balance:", error);
      return {
        saldo: null,
        error: "Error de conexión al asignar saldo inicial",
      };
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
      const response = await apiService.get<{
        saldos: VistaSaldosPorPunto[];
        success: boolean;
      }>("/vista-saldos-puntos");
      console.log(
        "💰 saldoInicialService.getVistaSaldosPorPunto: Respuesta recibida:",
        response
      );

      if (response.success) {
        console.log(
          `✅ getVistaSaldosPorPunto: ${
            response.saldos?.length || 0
          } saldos obtenidos:`,
          response.saldos
        );
        return { saldos: response.saldos, error: null };
      } else {
        console.error(
          "❌ getVistaSaldosPorPunto - Error en respuesta:",
          response
        );
        return { saldos: [], error: "Error al obtener la vista de saldos" };
      }
    } catch (error) {
      console.error("❌ Error fetching balance view:", error);
      return {
        saldos: [],
        error: "Error de conexión al obtener vista de saldos",
      };
    }
  },

  // Obtener movimientos de saldo por punto
  async getMovimientosSaldo(
    pointId: string,
    limit = 50
  ): Promise<{ movimientos: MovimientoSaldo[]; error: string | null }> {
    try {
      const response = await apiService.get<{
        movimientos: MovimientoSaldo[];
        success: boolean;
      }>(`/movimientos-saldo/${pointId}?limit=${limit}`);

      if (response.success) {
        return { movimientos: response.movimientos, error: null };
      } else {
        return {
          movimientos: [],
          error: "Error al obtener los movimientos de saldo",
        };
      }
    } catch (error) {
      console.error("Error fetching balance movements:", error);
      return {
        movimientos: [],
        error: "Error de conexión al obtener movimientos de saldo",
      };
    }
  },
};
