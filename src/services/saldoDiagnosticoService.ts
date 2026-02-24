import axiosInstance from "./axiosInstance";

export interface DiagnosticoSaldoResponse {
  success: boolean;
  diagnostico?: {
    punto: {
      id: string;
      nombre: string;
    };
    moneda: {
      id: string;
      codigo: string;
      nombre: string;
      simbolo: string;
    };
    fecha_consulta: string;
    saldos: {
      apertura: number;
      teorico: number;
      fisico: number;
      diferencia: number;
      tolerancia: number;
      cuadrado: boolean;
    };
    desglose_fisico: {
      cantidad: number;
      billetes: number;
      monedas_fisicas: number;
      bancos: number;
      suma_billetes_monedas: number;
      consistente: boolean;
    } | null;
    movimientos_hoy: {
      total: number;
      ingresos: number;
      egresos: number;
      detalle: Array<{
        id: string;
        fecha: string;
        tipo: string;
        monto: number;
        descripcion: string | null;
      }>;
    };
    validacion: {
      consistente: boolean;
      errores: string[];
    };
    ultimos_movimientos: Array<{
      id: string;
      fecha: string;
      tipo: string;
      monto: number;
      saldo_anterior: number;
      saldo_nuevo: number;
      descripcion: string | null;
    }>;
  };
  error?: string;
}

export interface DiagnosticoPuntoResponse {
  success: boolean;
  diagnostico?: {
    punto: {
      id: string;
      nombre: string;
    };
    fecha_consulta: string;
    resumen: {
      total_monedas: number;
      cuadradas: number;
      con_diferencias: number;
    };
    resultados: Array<{
      moneda_id: string;
      codigo: string;
      nombre: string;
      saldo_apertura: number;
      ingresos: number;
      egresos: number;
      saldo_teorico: number;
      saldo_fisico: number;
      diferencia: number;
      cuadrado: boolean;
      desglose_consistente: boolean;
      movimientos_count: number;
    }>;
    inconsistencias: Array<{
      moneda_id: string;
      codigo: string;
      nombre: string;
      saldo_apertura: number;
      ingresos: number;
      egresos: number;
      saldo_teorico: number;
      saldo_fisico: number;
      diferencia: number;
      cuadrado: boolean;
      desglose_consistente: boolean;
      movimientos_count: number;
      problema: string;
    }>;
  };
  error?: string;
}

export async function getDiagnosticoSaldo(
  puntoId: string,
  monedaId: string,
  fecha?: string
): Promise<DiagnosticoSaldoResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";
  const { data } = await axiosInstance.get(
    `/saldo-diagnostico/${puntoId}/${monedaId}${params}`
  );
  return data;
}

export async function getDiagnosticoPunto(
  puntoId: string,
  fecha?: string
): Promise<DiagnosticoPuntoResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";
  const { data } = await axiosInstance.get(
    `/saldo-diagnostico/punto/${puntoId}${params}`
  );
  return data;
}

export async function corregirDesglose(
  puntoId: string,
  monedaId: string
): Promise<{
  success: boolean;
  message?: string;
  antes?: {
    cantidad: number;
    billetes: number;
    monedas: number;
    suma: number;
  };
  despues?: {
    cantidad: number;
    billetes: number;
    monedas: number;
    suma: number;
  };
  error?: string;
}> {
  const { data } = await axiosInstance.post("/saldo-diagnostico/corregir-desglose", {
    punto_id: puntoId,
    moneda_id: monedaId,
  });
  return data;
}

export default {
  getDiagnosticoSaldo,
  getDiagnosticoPunto,
  corregirDesglose,
};
