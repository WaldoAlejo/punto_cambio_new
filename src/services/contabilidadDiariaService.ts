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
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
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
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
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

  // Obtener resumen de saldos antes de cerrar
  async getResumenCierre(
    puntoId: string,
    fecha: string
  ): Promise<{
    success: boolean;
    resumen?: {
      fecha: string;
      punto_atencion_id: string;
      saldos_principales: Array<{
        moneda_codigo: string;
        moneda_nombre: string;
        moneda_simbolo: string;
        saldo_final: number;
        tuvo_movimientos: boolean;
      }>;
      servicios_externos: Array<{
        servicio_nombre: string;
        servicio_tipo: string;
        saldos: Array<{
          moneda_codigo: string;
          moneda_simbolo: string;
          saldo: number;
        }>;
      }>;
      total_transacciones: number;

      // Listado para auditoría previa al cierre
      transacciones?: {
        cambios_divisas: Array<{
          id: string;
          fecha: string | Date;
          numero_recibo: string | null;
          tipo_operacion: string;
          estado: string;
          moneda_origen?:
            | { codigo: string; nombre: string; simbolo: string }
            | null;
          moneda_destino?:
            | { codigo: string; nombre: string; simbolo: string }
            | null;
          monto_origen: number;
          monto_destino: number;
          tasa_cambio_billetes: number;
          tasa_cambio_monedas: number;
          metodo_entrega: string;
          metodo_pago_origen: string;
          transferencia_banco?: string | null;
          transferencia_numero?: string | null;
          observacion?: string | null;
          usuario?: { id: string; nombre: string; username: string };
        }>;
        servicios_externos: Array<{
          id: string;
          fecha: string | Date;
          servicio: string;
          tipo_movimiento: string;
          moneda?: string;
          monto: number;
          metodo_ingreso: string;
          numero_referencia?: string | null;
          descripcion?: string | null;
          comprobante_url?: string | null;
          billetes?: number | null;
          monedas_fisicas?: number | null;
          bancos?: number | null;
          usuario?: { id: string; nombre: string; username: string };
        }>;
        limit?: number;
      };

      // Balance (ingresos/egresos) del día por tipo
      balance?: {
        cambios_divisas?: {
          por_moneda: Array<{
            moneda: { codigo: string; nombre?: string; simbolo?: string };
            ingresos: number;
            egresos: number;
            neto: number;
          }>;
        };
        servicios_externos?: {
          por_moneda: Array<{
            moneda: { codigo: string; nombre?: string; simbolo?: string };
            ingresos: number;
            egresos: number;
            neto: number;
          }>;
        };
      };
    };
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/${puntoId}/${fecha}/resumen-cierre`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
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
      console.error("Error fetching close summary:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error de conexión con el servidor",
      };
    }
  },

  // Validar qué cierres son necesarios antes del cierre diario
  async validarCierresRequeridos(
    puntoId: string,
    fecha: string
  ): Promise<{
    success: boolean;
    cierres_requeridos?: {
      servicios_externos: boolean;
      cambios_divisas: boolean;
      cierre_diario: boolean;
    };
    estado_cierres?: {
      servicios_externos: boolean;
      cambios_divisas: boolean;
      cierre_diario: boolean;
    };
    cierres_completos?: boolean;
    conteos?: {
      cambios_divisas: number;
      servicios_externos: number;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/validar-cierres/${puntoId}/${fecha}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
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
          cierres_requeridos: data.cierres_requeridos,
          estado_cierres: data.estado_cierres,
          cierres_completos: data.cierres_completos,
          conteos: data.conteos,
        };
      } else {
        return {
          success: false,
          error: data.error || "Error desconocido",
        };
      }
    } catch (error) {
      console.error("Error validating required closures:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error de conexión con el servidor",
      };
    }
  },

  // Realizar cierre diario con validación automática y finalización de jornada
  async realizarCierreDiario(
    puntoId: string,
    fecha: string,
    observaciones?: string,
    diferencias_reportadas?: unknown
  ): Promise<{
    success: boolean;
    cierre?: unknown;
    jornada_finalizada?: boolean;
    mensaje?: string;
    error?: string;
    codigo?: string;
    detalles?: unknown;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/contabilidad-diaria/${puntoId}/${fecha}/cerrar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            observaciones,
            diferencias_reportadas,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          cierre: data.cierre,
          jornada_finalizada: data.jornada_finalizada,
          mensaje: data.mensaje,
        };
      } else {
        return {
          success: false,
          error: data.error || "Error desconocido",
          codigo: data.codigo,
          detalles: data.detalles,
        };
      }
    } catch (error) {
      console.error("Error performing daily close:", error);
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
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
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
