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
  async getAllPoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    console.log('=== POINT SERVICE - getAllPoints START ===');
    try {
      console.log('Calling apiService.get("/points")...');
      const response = await apiService.get<PointsResponse>("/points");
      console.log('getAllPoints - Raw response:', response);

      if (!response) {
        console.error('getAllPoints - No response received');
        return {
          points: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('getAllPoints - Response error:', response.error);
        return {
          points: [],
          error: response.error || "Error al obtener puntos de atención",
        };
      }

      console.log('getAllPoints - Success, points count:', response.points?.length || 0);
      console.log('getAllPoints - Points data:', response.points);
      return { points: response.points || [], error: null };
    } catch (error) {
      console.error("=== getAllPoints ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack');
      return { points: [], error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== POINT SERVICE - getAllPoints END ===');
    }
  },

  async getActivePoints(): Promise<{ points: PuntoAtencion[]; error: string | null }> {
    console.log('=== POINT SERVICE - getActivePoints START ===');
    try {
      console.log('Calling apiService.get("/active-points")...');
      const response = await apiService.get<ActivePointsResponse>("/active-points");
      console.log('getActivePoints - Raw response:', response);

      if (!response) {
        console.error('getActivePoints - No response received');
        return {
          points: [],
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('getActivePoints - Response error:', response.error);
        return {
          points: [],
          error: response.error || "Error al obtener puntos activos",
        };
      }

      console.log('getActivePoints - Success, points count:', response.points?.length || 0);
      return { points: response.points || [], error: null };
    } catch (error) {
      console.error("=== getActivePoints ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack');
      return { points: [], error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== POINT SERVICE - getActivePoints END ===');
    }
  },

  async createPoint(pointData: CreatePointData): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    console.log('=== POINT SERVICE - createPoint START ===');
    console.log('Input data:', pointData);
    console.log('Input data JSON:', JSON.stringify(pointData, null, 2));

    try {
      console.log('Calling apiService.post("/points", pointData)...');
      const response = await apiService.post<PointResponse>("/points", pointData);
      console.log('createPoint - Raw response:', response);

      if (!response) {
        console.error('createPoint - No response received from server');
        return {
          point: null,
          error: "No se pudo obtener la respuesta del servidor",
        };
      }

      if (response.error || !response.success) {
        console.error('createPoint - Response indicates failure:', response.error);
        return {
          point: null,
          error: response.error || "Error al crear punto de atención",
        };
      }

      console.log('createPoint - Success! Created point:', response.point);
      return { point: response.point, error: null };
    } catch (error) {
      console.error("=== createPoint ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack');
      return { point: null, error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== POINT SERVICE - createPoint END ===');
    }
  },

  async updatePoint(pointId: string, pointData: Partial<CreatePointData>): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    console.log('=== POINT SERVICE - updatePoint START ===');
    console.log('Point ID:', pointId);
    console.log('Update data:', pointData);

    try {
      console.log('Calling apiService.put("/points/:id", pointData)...');
      const response = await apiService.put<PointResponse>(`/points/${pointId}`, pointData);
      console.log('updatePoint - Raw response:', response);

      if (!response) {
        console.error('updatePoint - No response received from server');
        return { point: null, error: "No se pudo obtener la respuesta del servidor" };
      }

      if (response.error || !response.success) {
        console.error('updatePoint - Response indicates failure:', response.error);
        return { point: null, error: response.error || "Error al actualizar punto de atención" };
      }

      console.log('updatePoint - Success! Updated point:', response.point);
      return { point: response.point, error: null };
    } catch (error) {
      console.error("=== updatePoint ERROR ===");
      console.error("Error details:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== POINT SERVICE - updatePoint END ===');
    }
  },

  async togglePointStatus(pointId: string): Promise<{ point: PuntoAtencion | null; error: string | null }> {
    console.log('=== POINT SERVICE - togglePointStatus START ===');
    console.log('Point ID:', pointId);

    try {
      console.log('Calling apiService.patch for point toggle...');
      const response = await apiService.patch<PointResponse>(`/points/${pointId}/toggle`);
      console.log('togglePointStatus - Raw response:', response);

      if (!response) {
        console.error('togglePointStatus - No response received from server');
        return { point: null, error: "No se pudo obtener la respuesta del servidor" };
      }

      if (response.error || !response.success) {
        console.error('togglePointStatus - Response indicates failure:', response.error);
        return { point: null, error: response.error || "Error al cambiar estado del punto" };
      }

      console.log('togglePointStatus - Success! Updated point:', response.point);
      return { point: response.point, error: null };
    } catch (error) {
      console.error("=== togglePointStatus ERROR ===");
      console.error("Error details:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    } finally {
      console.log('=== POINT SERVICE - togglePointStatus END ===');
    }
  }
};
