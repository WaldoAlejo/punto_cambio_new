import { apiService } from "./apiService";
import { Agencia, ApiResponse } from "../types";

interface AgenciasResponse extends ApiResponse {
  data?: Agencia[];
}

export const servientregaService = {
  async getAgencias(): Promise<{ agencias: Agencia[]; error: string | null }> {
    try {
      console.log("🔍 servientregaService.getAgencias: Iniciando solicitud...");
      const response = await apiService.post<AgenciasResponse>(
        "/servientrega/agencias"
      );
      console.log(
        "📍 servientregaService.getAgencias: Respuesta recibida:",
        response
      );

      if (!response || !response.success) {
        console.error("❌ getAgencias - Error:", response?.error);
        return {
          agencias: [],
          error: response?.error || "Error al obtener agencias de Servientrega",
        };
      }

      const agencias = response.data || [];
      console.log(`✅ getAgencias: ${agencias.length} agencias obtenidas`);
      return { agencias, error: null };
    } catch (error) {
      console.error("❌ getAgencias ERROR:", error);
      return { agencias: [], error: "Error de conexión con el servidor" };
    }
  },
};
