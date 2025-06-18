const API_BASE_URL = "http://localhost:3001/api";

export interface PuntoAtencion {
  id: string;
  nombre: string;
}

export interface Moneda {
  id: string;
  nombre: string;
  simbolo: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  username: string;
}

export interface Transfer {
  id: string;
  origen_id: string | null;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: string;
  estado: string;
  solicitado_por: string;
  aprobado_por: string | null;
  fecha: string;
  fecha_aprobacion: string | null;
  descripcion: string | null;
  numero_recibo: string | null;
  origen?: PuntoAtencion;
  destino?: PuntoAtencion;
  moneda?: Moneda;
  usuarioSolicitante?: Usuario;
  usuarioAprobador?: Usuario;
}

export const transferService = {
  async getAllTransfers(): Promise<{
    transfers: Transfer[];
    error: string | null;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/transfers`, {
        method: "GET",
        credentials: "include", // 👈 Importante para cookies
      });
      const data = await response.json();

      if (!response.ok) {
        return {
          transfers: [],
          error: data.error || "Error al obtener transferencias",
        };
      }

      return { transfers: data.transfers, error: null };
    } catch (error) {
      console.error("Error en getAllTransfers:", error);
      return { transfers: [], error: "Error de conexión con el servidor" };
    }
  },
};
