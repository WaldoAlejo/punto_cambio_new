import { ResumenDiario, CierreDiario } from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const contabilidadDiariaService = {
  // Obtener resumen de contabilidad diaria
  async getResumenDiario(
    puntoId: string,
    fecha: string
  ): Promise<{
    success: boolean;
    resumen?: ResumenDiario[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/${puntoId}/${fecha}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          resumen: data.resumen,
        };
      } else {
        return {
          success: false,
          error: data.error || "Error desconocido",
        };
      }
    } catch (error) {
      console.error("Error fetching daily accounting:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error de conexión con el servidor",
      };
    }
  },

  // Verificar si existe cierre para una fecha
  async getCierreDiario(
    puntoId: string,
    fecha: string
  ): Promise<{
    success: boolean;
    cierre?: CierreDiario | null;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/cierre/${puntoId}/${fecha}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          cierre: data.cierre,
        };
      } else {
        return {
          success: false,
          error: data.error || "Error desconocido",
        };
      }
    } catch (error) {
      console.error("Error checking daily close:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error de conexión con el servidor",
      };
    }
  },

  // Realizar cierre diario
  async realizarCierre(data: {
    punto_atencion_id: string;
    fecha: string;
    observaciones?: string;
    diferencias_reportadas?: {
      moneda_id: string;
      diferencia_sistema: number;
      diferencia_fisica: number;
      justificacion?: string;
    }[];
  }): Promise<{
    success: boolean;
    cierre?: CierreDiario;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/cierre`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        return {
          success: true,
          cierre: responseData.cierre,
        };
      } else {
        return {
          success: false,
          error: responseData.error || "Error desconocido",
        };
      }
    } catch (error) {
      console.error("Error creating daily close:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error de conexión con el servidor",
      };
    }
  },
};
