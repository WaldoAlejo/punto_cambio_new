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
        "/servientrega/agencias",
        {} // Enviar un objeto vacío como body para el POST
      );
      console.log(
        "📍 servientregaService.getAgencias: Respuesta recibida:",
        response
      );

      // Verificar si la respuesta tiene el formato esperado
      if (!response) {
        console.error("❌ getAgencias - Respuesta vacía");
        return {
          agencias: [],
          error: "Respuesta vacía del servidor",
        };
      }

      // Si la respuesta tiene success: false, usar el error de la respuesta
      if (response.success === false) {
        const errorMessage =
          response.error || "Error al obtener agencias de Servientrega";
        console.error("❌ getAgencias - Error en respuesta:", errorMessage);
        return {
          agencias: [],
          error: errorMessage,
        };
      }

      // Si la respuesta es exitosa, extraer las agencias
      const agencias = response.data || [];
      console.log(`✅ getAgencias: ${agencias.length} agencias obtenidas`);

      // Log de las primeras agencias para debugging
      if (agencias.length > 0) {
        console.log("📋 Primeras agencias:", agencias.slice(0, 3));
      }

      return { agencias, error: null };
    } catch (error) {
      console.error("❌ getAgencias ERROR:", error);

      // Proporcionar un mensaje de error más específico
      let errorMessage = "Error de conexión con el servidor";
      if (error instanceof Error) {
        if (error.message.includes("404")) {
          errorMessage = "Servicio de agencias no encontrado";
        } else if (error.message.includes("500")) {
          errorMessage = "Error interno del servidor de Servientrega";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Timeout al conectar con Servientrega";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      return { agencias: [], error: errorMessage };
    }
  },
};
