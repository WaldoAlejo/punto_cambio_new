import axiosInstance from "./axiosInstance";

export type ServicioExterno =
  | "YAGANASTE"
  | "BANCO_GUAYAQUIL"
  | "WESTERN"
  | "PRODUBANCO"
  | "BANCO_PACIFICO"
  // Nuevas categorías de egresos:
  | "INSUMOS_OFICINA"
  | "INSUMOS_LIMPIEZA"
  | "OTROS";

export type TipoMovimiento = "INGRESO" | "EGRESO";

export interface CrearMovimientoServicioExternoInput {
  punto_atencion_id?: string; // se forzará al punto del operador en backend
  servicio: ServicioExterno;
  tipo_movimiento: TipoMovimiento;
  monto: number;
  descripcion?: string;
  numero_referencia?: string;
  comprobante_url?: string;
}

export async function crearMovimientoServicioExterno(
  payload: CrearMovimientoServicioExternoInput
) {
  const { data } = await axiosInstance.post(
    "/servicios-externos/movimientos",
    payload
  );
  return data;
}

export interface ListarMovimientosQuery {
  servicio?: ServicioExterno;
  tipo_movimiento?: TipoMovimiento;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  limit?: number;
}

export async function listarMovimientosServiciosExternos(
  pointId: string,
  query: ListarMovimientosQuery = {}
) {
  const { data } = await axiosInstance.get(
    `/servicios-externos/movimientos/${pointId}`,
    { params: query }
  );
  return data;
}
