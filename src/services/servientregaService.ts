import { apiService } from "./apiService";
import { Agencia, ApiResponse } from "../types";

interface AgenciasResponse extends ApiResponse {
  data?: Agencia[];
}

export const servientregaService = {
  async getAgencias(): Promise<{ agencias: Agencia[]; error: string | null }> {
    try {
      const response = await apiService.post<AgenciasResponse>(
        "/servientrega/agencias",
        {} // Enviar un objeto vacío como body para el POST
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

      // Si la respuesta es exitosa, extraer y mapear las agencias
      const rawAgencias = response.data || [];

      // Mapear la estructura de datos del backend al tipo Agencia esperado
      const agencias: Agencia[] = rawAgencias.map((rawAgencia: any) => ({
        nombre: rawAgencia.agencia || rawAgencia.nombre || "",
        tipo_cs: rawAgencia.tipo_cs || "",
        direccion: rawAgencia.direccion || "",
        ciudad: rawAgencia.ciudad || "",
      }));

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
