
import { apiService } from "./apiService";
import { PuntoAtencion, CreatePointData, ApiResponse, ListResponse } from "../types";

interface PointsResponse extends ListResponse<PuntoAtencion> {
  points: PuntoAtencion[];
}

interface PointResponse extends ApiResponse<PuntoAtencion> {
  point: PuntoAtencion;
}

interface ActivePointsResponse extends ListResponse<PuntoAtencion> {
  points: PuntoAtencion[];
}

export const pointService = {
  async getAllPoints(): Promise<{
    points: PuntoAtencion[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<PointsResponse>("/points");

      if (!response) {
        return {
          points: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          points: [],
          error: response.error || "Error al obtener puntos de atención",
        };
      }

      return { points: response.points || [], error: null };
    } catch (error) {
      console.error("Error en getAllPoints:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async getActivePoints(): Promise<{
    points: PuntoAtencion[];
    error: string | null;
  }> {
    try {
      const response = await apiService.get<ActivePointsResponse>("/active-points");

      if (!response) {
        return {
          points: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        return {
          points: [],
          error: response.error || "Error al obtener puntos activos",
        };
      }

      return { points: response.points || [], error: null };
    } catch (error) {
      console.error("Error en getActivePoints:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async createPoint(pointData: CreatePointData): Promise<{
    point: PuntoAtencion | null;
    error: string | null;
  }> {
    try {
      console.log('=== POINT SERVICE CREATE DEBUG ===');
      console.log('Point data being sent:', pointData);
      console.log('Point data JSON:', JSON.stringify(pointData, null, 2));

      const response = await apiService.post<PointResponse>("/points", pointData);

      console.log('Point service response received:', response);

      if (!response) {
        console.error('No response received from server');
        return {
          point: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('Point creation failed:', response.error);
        return {
          point: null,
          error: response.error || "Error al crear punto de atención",
        };
      }

      console.log('Point created successfully:', response.point);
      return { point: response.point, error: null };
    } catch (error) {
      console.error("=== POINT SERVICE ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack');
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },
};
