import { apiService } from "./apiService";
import {
  PuntoAtencion,
  CreatePointData,
  ApiResponse,
  ListResponse,
} from "../types";

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.warn(...args);
};

interface PointsResponse extends ListResponse<PuntoAtencion> {
  points: PuntoAtencion[];
}

interface PointResponse extends ApiResponse<PuntoAtencion> {
  point: PuntoAtencion;
}

type GetPointsResult = { points: PuntoAtencion[]; error: string | null };
type MutPointResult = { point: PuntoAtencion | null; error: string | null };
type SimpleResult = { success: boolean; error: string | null };

export const pointService = {
  /**
   * Obtiene puntos según rol del usuario autenticado:
   * - ADMINISTRATIVO/ADMIN/SUPER: TODOS (incluye principal, ocupados y libres)
   * - OPERADOR/CONCESION: SOLO libres (excluye principal para OPERADOR)
   */
  async getAllPoints(): Promise<GetPointsResult> {
    try {
      devLog("🔍 pointService.getAllPoints: solicitando /points …");
      const response = await apiService.get<PointsResponse>("/points");

      if (!response || !response.success) {
        const msg = response?.error || "Error al obtener puntos de atención";
        console.error("❌ getAllPoints:", msg);
        return { points: [], error: msg };
      }
      devLog(
        `✅ getAllPoints: ${response.points?.length || 0} puntos`,
        response.points?.map((p) => ({ id: p.id, nombre: p.nombre }))
      );
      return { points: response.points, error: null };
    } catch (error) {
      console.error("❌ getAllPoints ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  /**
   * Ruta auxiliar por si quieres forzar el endpoint /points/all.
   * OJO: ahora también permite ADMINISTRATIVO además de ADMIN/SUPER.
   */
  async getAllPointsForAdmin(): Promise<GetPointsResult> {
    try {
      const response = await apiService.get<PointsResponse>("/points/all");
      if (!response || !response.success) {
        const msg = response?.error || "Error al obtener todos los puntos";
        console.error("❌ getAllPointsForAdmin:", msg);
        return { points: [], error: msg };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("❌ getAllPointsForAdmin ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  /**
   * Alias de compatibilidad (antes listaba “activos/libres”).
   * El backend ya filtra por rol en /points.
   */
  async getActivePoints(): Promise<GetPointsResult> {
    try {
      const response = await apiService.get<PointsResponse>("/points");
      if (!response || !response.success) {
        const msg = response?.error || "Error al obtener puntos activos";
        console.error("❌ getActivePoints:", msg);
        return { points: [], error: msg };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("❌ getActivePoints ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  /** Puntos activos para transferencias (sin filtro de jornadas) */
  async getActivePointsForTransfers(): Promise<GetPointsResult> {
    try {
      const response = await apiService.get<PointsResponse>(
        "/points/active-for-transfers"
      );
      if (!response || !response.success) {
        const msg =
          response?.error || "Error al obtener puntos para transferencias";
        console.error("❌ getActivePointsForTransfers:", msg);
        return { points: [], error: msg };
      }
      return { points: response.points, error: null };
    } catch (error) {
      console.error("❌ getActivePointsForTransfers ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  /** Puntos para gestión de saldos (admin/super) */
  async getPointsForBalanceManagement(): Promise<GetPointsResult> {
    try {
      devLog(
        "🔍 pointService.getPointsForBalanceManagement: /points/for-balance-management …"
      );
      const response = await apiService.get<PointsResponse>(
        "/points/for-balance-management"
      );

      if (!response || !response.success) {
        const msg =
          response?.error || "Error al obtener puntos para gestión de saldos";
        console.error("❌ getPointsForBalanceManagement:", msg);
        return { points: [], error: msg };
      }

      devLog(
        `✅ getPointsForBalanceManagement: ${
          response.points?.length || 0
        } puntos`,
        response.points?.map((p) => ({ id: p.id, nombre: p.nombre }))
      );
      return { points: response.points, error: null };
    } catch (error) {
      console.error("❌ getPointsForBalanceManagement ERROR:", error);
      return { points: [], error: "Error de conexión con el servidor" };
    }
  },

  async createPoint(pointData: CreatePointData): Promise<MutPointResult> {
    try {
      const response = await apiService.post<PointResponse>(
        "/points",
        pointData
      );
      if (!response || !response.success) {
        const msg = response?.error || "Error al crear punto de atención";
        console.error("❌ createPoint:", msg);
        return { point: null, error: msg };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("❌ createPoint ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },

  async updatePoint(
    pointId: string,
    pointData: Partial<CreatePointData>
  ): Promise<MutPointResult> {
    try {
      const response = await apiService.put<PointResponse>(
        `/points/${pointId}`,
        pointData
      );
      if (!response || !response.success) {
        const msg = response?.error || "Error al actualizar punto de atención";
        console.error("❌ updatePoint:", msg);
        return { point: null, error: msg };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("❌ updatePoint ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },

  async deletePoint(pointId: string): Promise<SimpleResult> {
    try {
      const response = await apiService.delete<ApiResponse<null>>(
        `/points/${pointId}`
      );
      if (!response || !response.success) {
        const msg = response?.error || "Error al eliminar punto de atención";
        console.error("❌ deletePoint:", msg);
        return { success: false, error: msg };
      }
      return { success: true, error: null };
    } catch (error) {
      console.error("❌ deletePoint ERROR:", error);
      return { success: false, error: "Error de conexión con el servidor" };
    }
  },

  async togglePointStatus(pointId: string): Promise<MutPointResult> {
    try {
      const response = await apiService.patch<PointResponse>(
        `/points/${pointId}/toggle`
      );
      if (!response || !response.success) {
        const msg = response?.error || "Error al cambiar estado del punto";
        console.error("❌ togglePointStatus:", msg);
        return { point: null, error: msg };
      }
      return { point: response.point, error: null };
    } catch (error) {
      console.error("❌ togglePointStatus ERROR:", error);
      return { point: null, error: "Error de conexión con el servidor" };
    }
  },
};
