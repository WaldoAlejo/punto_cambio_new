
import { apiService } from "./apiService";
import { PuntoAtencion } from "../types";

export interface PointsResponse {
  points: PuntoAtencion[];
  success: boolean;
  error?: string;
}

export interface CreatePointData {
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal?: string;
  telefono?: string;
}

interface CreatePointResponse {
  point: PuntoAtencion;
  success: boolean;
  error?: string;
}

export const pointService = {
  async getAllPoints(): Promise<{
    points: PuntoAtencion[];
    error: string | null;
  }> {
    try {
      console.log('Fetching points from API...');
      const response = await apiService.get<PointsResponse>("/points");

      if (!response) {
        console.warn('No response received from points API');
        return {
          points: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Points API response:', response);

      if (response.error || !response.success) {
        console.warn('Points API returned error:', response.error);
        return {
          points: [],
          error: response.error || "Error al obtener puntos de atención",
        };
      }

      console.log('Points fetched successfully:', response.points?.length || 0);
      return { points: response.points || [], error: null };
    } catch (error) {
      console.error("Error getting points:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { points: [], error: errorMessage };
    }
  },

  async createPoint(
    pointData: CreatePointData
  ): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    try {
      console.log('Creating point via API...', pointData);
      const response = await apiService.post<CreatePointResponse>("/points", pointData);

      if (!response) {
        console.warn('No response received from create point API');
        return {
          point: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      console.log('Create point API response:', response);

      if (response.error || !response.success) {
        console.warn('Create point API returned error:', response.error);
        return { point: null, error: response.error || "Error al crear punto de atención" };
      }

      console.log('Point created successfully:', response.point);
      return { point: response.point || null, error: null };
    } catch (error) {
      console.error("Error creating point:", error);
      const errorMessage = error instanceof Error ? error.message : "Error de conexión con el servidor";
      return { point: null, error: errorMessage };
    }
  },
};
