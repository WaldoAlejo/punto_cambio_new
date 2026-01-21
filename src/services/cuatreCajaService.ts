// src/services/cuatreCajaService.ts
import axiosInstance from "@/services/axiosInstance";

//
// Tipos compartidos
//
export type UUID = string;

export interface MonedaInfo {
  id: UUID;
  codigo: string;
  nombre: string;
  simbolo: string;
}

export interface DetalleCuadreResumen {
  moneda_id: UUID;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre: number; // saldo teórico
  ingresos_periodo: number;
  egresos_periodo: number;
  movimientos_periodo?: number;
  desglose?: {
    cambios?: { ingresos: number; egresos: number; cantidad: number };
    transferencias?: {
      entrada: number;
      salida: number;
      cantidad_entrada: number;
      cantidad_salida: number;
    };
  };
}

export interface CuadreResponse {
  success: boolean;
  data: {
    detalles: DetalleCuadreResumen[];
    observaciones?: string | null;
    cuadre_id?: UUID;
    periodo_inicio?: string | Date;
    totales?: {
      cambios?: { cantidad: number; ingresos?: number; egresos?: number };
      transferencias_entrada?: { cantidad: number; monto?: number };
      transferencias_salida?: { cantidad: number; monto?: number };
    };
  };
}

export interface GuardarDetalleRequest {
  moneda_id: UUID;
  saldo_apertura: number;
  saldo_cierre: number; // saldo teórico
  conteo_fisico: number; // físico ingresado por el cajero
  billetes: number;
  monedas: number; // alias frontend para "monedas_fisicas"
  ingresos_periodo?: number;
  egresos_periodo?: number;
  movimientos_periodo?: number;
  observaciones_detalle?: string | null;
}

export interface GuardarCierreBody {
  detalles: GuardarDetalleRequest[];
  observaciones?: string;
  tipo_cierre?: "CERRADO" | "PARCIAL";
  allowMismatch?: boolean; // permite cerrar con diferencia fuera de la tolerancia
}

export interface GuardarCierreResponse {
  success: boolean;
  message?: string;
  cuadre_id: UUID;
}

export interface ParcialPendienteItem {
  id: UUID;
  puntoAtencion?: { id: UUID; nombre: string };
  usuario?: { id: UUID; nombre: string; username: string };
  fecha: string;
  fecha_cierre?: string | null;
  estado: "PARCIAL" | "ABIERTO" | "CERRADO";
  detalles: Array<{
    moneda_id: UUID;
    saldo_apertura: number;
    saldo_cierre: number;
    conteo_fisico: number;
    billetes: number;
    monedas_fisicas: number;
    diferencia: number;
    moneda?: MonedaInfo;
  }>;
}

export interface ParcialesPendientesResponse {
  success: boolean;
  data: ParcialPendienteItem[];
}

export interface ContabilidadDiariaResumenItem {
  moneda_id: UUID;
  ingresos: number;
  egresos: number;
  movimientos: number;
  moneda: MonedaInfo | null;
}

export interface ContabilidadDiariaResponse {
  success: boolean;
  fecha: string; // YYYY-MM-DD
  rango_utc: { gte: string; lt: string };
  pointId: UUID;
  resumen: ContabilidadDiariaResumenItem[];
}

export interface CerrarContabilidadResponse {
  success: boolean;
  info?: "ya_cerrado";
  cierre: {
    id: UUID;
    punto_atencion_id: UUID;
    fecha: string;
    estado: "CERRADO";
    fecha_cierre: string;
    cerrado_por: UUID;
    observaciones?: string | null;
    diferencias_reportadas?: string | null;
  };
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

function normalizeError(e: any): ApiError {
  const err: ApiError = new Error(
    e?.response?.data?.error ||
      e?.message ||
      "Error de red o del servidor desconocido"
  );
  err.status = e?.response?.status;
  err.data = e?.response?.data;
  return err;
}

//
// Endpoints: Cuadre de caja
//

/**
 * Obtiene el cuadre del día (o de la fecha indicada) para el punto del usuario.
 * @param fecha YYYY-MM-DD (opcional). Si se omite, usa hoy (zona GYE) en backend.
 * @param pointId (opcional) — el backend por seguridad ignorará si el usuario no es ADMIN.
 */
async function getCuadre(params?: {
  fecha?: string;
  pointId?: string;
}): Promise<CuadreResponse> {
  try {
    const res = await axiosInstance.get<CuadreResponse>("/cuadre-caja", {
      params,
    });
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

/**
 * Guarda cierre (PARCIAL o CERRADO).
 * - Si tipo_cierre = "PARCIAL", guarda como parcial.
 * - Si tipo_cierre = "CERRADO", cierre final.
 */
async function guardarCierre(
  body: GuardarCierreBody
): Promise<GuardarCierreResponse> {
  try {
    const res = await axiosInstance.post<GuardarCierreResponse>(
      "/guardar-cierre",
      body
    );
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

/**
 * Guarda un cierre PARCIAL explícito (usa el endpoint dedicado).
 * Recomendado si deseas mantener separado el flujo PARCIAL.
 */
async function guardarParcial(
  body: Omit<GuardarCierreBody, "tipo_cierre"> & { allowMismatch?: boolean }
): Promise<GuardarCierreResponse> {
  try {
    const res = await axiosInstance.post<GuardarCierreResponse>(
      "/cierre-parcial/parcial",
      body
    );
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

/**
 * Lista cierres parciales pendientes del día (del punto del usuario).
 */
async function getParcialesPendientes(): Promise<ParcialesPendientesResponse> {
  try {
    const res = await axiosInstance.get<ParcialesPendientesResponse>(
      "/cierre-parcial/pendientes"
    );
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

//
// Endpoints: Contabilidad diaria
//

/**
 * Obtiene el resumen contable diario por moneda.
 * @param pointId UUID del punto
 * @param fecha YYYY-MM-DD
 */
async function getContabilidadDiaria(
  pointId: string,
  fecha: string
): Promise<ContabilidadDiariaResponse> {
  try {
    const res = await axiosInstance.get<ContabilidadDiariaResponse>(
      `/contabilidad-diaria/${pointId}/${fecha}`
    );
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

/**
 * Marca como CERRADO el cierre contable del día (idempotente).
 * @param pointId UUID del punto
 * @param fecha YYYY-MM-DD
 * @param body { observaciones?, diferencias_reportadas? }
 */
async function cerrarContabilidadDiaria(
  pointId: string,
  fecha: string,
  body?: { observaciones?: string; diferencias_reportadas?: string }
): Promise<CerrarContabilidadResponse> {
  try {
    const res = await axiosInstance.post<CerrarContabilidadResponse>(
      `/contabilidad-diaria/${pointId}/${fecha}/cerrar`,
      body ?? {}
    );
    return res.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

//
// Helpers de composición (útiles para hooks)
//

/**
 * Flujo recomendado para pantalla:
 * - Trae Cuadre (detalles por moneda)
 * - Trae Contabilidad (para comparación independiente)
 */
async function getCuadreConContabilidad(params: {
  pointId: string;
  fecha: string;
}): Promise<{
  cuadre: CuadreResponse;
  contabilidad: ContabilidadDiariaResponse;
}> {
  const [cuadre, contabilidad] = await Promise.all([
    getCuadre({ fecha: params.fecha }),
    getContabilidadDiaria(params.pointId, params.fecha),
  ]);
  return { cuadre, contabilidad };
}

const cuatreCajaService = {
  // Cuadre
  getCuadre,
  guardarCierre,
  guardarParcial,
  getParcialesPendientes,

  // Contabilidad diaria
  getContabilidadDiaria,
  cerrarContabilidadDiaria,

  // Compuestos
  getCuadreConContabilidad,
};

export default cuatreCajaService;
