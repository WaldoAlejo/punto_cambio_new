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

// =============== CIERRES (USD, tolerancia ±1.00) ===============
export async function abrirCierreServiciosExternos(params?: {
  pointId?: string;
}) {
  const { data } = await axiosInstance.post(
    `/servicios-externos/cierre/abrir`,
    params || {}
  );
  return data as { success: boolean; cierre: any };
}

export async function statusCierreServiciosExternos(params?: {
  pointId?: string;
  fecha?: string; // YYYY-MM-DD
}) {
  const { data } = await axiosInstance.get(
    `/servicios-externos/cierre/status`,
    {
      params,
    }
  );
  return data as {
    success: boolean;
    cierre: any | null;
    detalles: Array<{
      servicio: string;
      moneda_id: string;
      monto_movimientos: number;
      monto_validado: number;
      diferencia: number;
      observaciones?: string;
    }>;
    resumen_movimientos: Array<{ servicio: string; neto: number }>;
  };
}

export async function cerrarCierreServiciosExternos(payload: {
  pointId?: string;
  detalles: Array<{
    servicio: ServicioExterno;
    monto_validado: number;
    observaciones?: string;
  }>;
  observaciones?: string;
}) {
  const { data } = await axiosInstance.post(
    `/servicios-externos/cierre/cerrar`,
    payload
  );
  return data as { success: boolean; cierre_id: string };
}

export interface SaldoAsignado {
  servicio: ServicioExterno;
  saldo_asignado: number;
  actualizado_en: string;
}

export async function obtenerSaldosAsignados(params?: {
  pointId?: string;
}): Promise<{
  success: boolean;
  punto_nombre: string;
  saldos_asignados: SaldoAsignado[];
}> {
  const { data } = await axiosInstance.get(
    `/servicios-externos/saldos-asignados`,
    { params }
  );
  return data;
}
