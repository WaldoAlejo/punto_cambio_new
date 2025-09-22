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

export async function listarMovimientosServiciosExternosAdmin(params: {
  pointId?: string; // 'ALL' para todos
  servicio?: ServicioExterno;
  tipo_movimiento?: TipoMovimiento;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  limit?: number;
}) {
  const { data } = await axiosInstance.get(
    `/servicios-externos/admin/movimientos`,
    {
      params,
    }
  );
  return data as { success: boolean; movimientos: any[] };
}

export async function eliminarMovimientoServicioExterno(id: string) {
  try {
    const { data } = await axiosInstance.delete(
      `/servicios-externos/movimientos/${id}`
    );
    return data;
  } catch (error: any) {
    // Mapear 400 a mensaje amigable específico
    if (error?.response?.status === 400) {
      const serverMsg = error?.response?.data?.error || error?.friendlyMessage;
      if (
        /Solo se pueden eliminar (cambios|movimientos) del día actual/i.test(
          serverMsg || ""
        )
      ) {
        throw Object.assign(
          new Error("Solo puedes eliminar registros del día de hoy"),
          {
            friendlyMessage: "Solo puedes eliminar registros del día de hoy",
          }
        );
      }
    }
    throw error;
  }
}
