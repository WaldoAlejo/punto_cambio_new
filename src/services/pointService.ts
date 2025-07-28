import { apiService } from "./apiService";
import {
  PuntoAtencion,
  CreatePointData,
  ApiResponse,
  ListResponse,
} from "../types";

interface PointsResponse extends ListResponse<PuntoAtencion> {
  points: PuntoAtencion[];
}

interface PointResponse extends ApiResponse<PuntoAtencion> {
  point: PuntoAtencion;
}

export const pointService = {
  async getAllPoints() {
    try {
      const response = await apiService.get<PointsResponse>("/points");
      if (!response || !response.success) {
        console.error("getAllPoints - Error:", response?.error);
        return {
          points: [],
          error: response?.error || "Error al obtener puntos de atención",
        };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("getAllPoints ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async getAllPointsForAdmin() {
    try {
      const response = await apiService.get<PointsResponse>("/points/all");
      if (!response || !response.success) {
        console.error("getAllPointsForAdmin - Error:", response?.error);
        return {
          points: [],
          error: response?.error || "Error al obtener todos los puntos",
        };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("getAllPointsForAdmin ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async getActivePoints() {
    try {
      const response = await apiService.get<PointsResponse>("/points");
      if (!response || !response.success) {
        console.error("getActivePoints - Error:", response?.error);
        return {
          points: [],
          error: response?.error || "Error al obtener puntos activos",
        };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("getActivePoints ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async getActivePointsForTransfers() {
    try {
      const response = await apiService.get<PointsResponse>(
        "/points/active-for-transfers"
      );
      if (!response || !response.success) {
        console.error("getActivePointsForTransfers - Error:", response?.error);
        return {
          points: [],
          error:
            response?.error || "Error al obtener puntos para transferencias",
        };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("getActivePointsForTransfers ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async createPoint(pointData: CreatePointData) {
    try {
      const response = await apiService.post<PointResponse>(
        "/points",
        pointData
      );
      if (!response || !response.success) {
        console.error("createPoint - Error:", response?.error);
        return {
          point: null,
          error: response?.error || "Error al crear punto de atención",
        };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("createPoint ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },

  async updatePoint(pointId: string, pointData: Partial<CreatePointData>) {
    try {
      const response = await apiService.put<PointResponse>(
        `/points/${pointId}`,
        pointData
      );
      if (!response || !response.success) {
        console.error("updatePoint - Error:", response?.error);
        return {
          point: null,
          error: response?.error || "Error al actualizar punto de atención",
        };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("updatePoint ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },

  async deletePoint(pointId: string) {
    try {
      const response = await apiService.delete<ApiResponse<null>>(
        `/points/${pointId}`
      );
      if (!response || !response.success) {
        console.error("deletePoint - Error:", response?.error);
        return {
          success: false,
          error: response?.error || "Error al eliminar punto de atención",
        };
      }
      return { success: true, error: null };
    } catch (error) {
      console.error("deletePoint ERROR:", error);
      return { success: false, error: "Error de conexión con el servidor" };
    }
  },

  async togglePointStatus(pointId: string) {
    try {
      const response = await apiService.patch<PointResponse>(
        `/points/${pointId}/toggle`
      );
      if (!response || !response.success) {
        console.error("togglePointStatus - Error:", response?.error);
        return {
          point: null,
          error: response?.error || "Error al cambiar estado del punto",
        };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("togglePointStatus ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },
};
