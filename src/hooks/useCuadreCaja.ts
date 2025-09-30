// src/hooks/useCuadreCaja.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import cuatreCajaService, {
  CuadreResponse,
  DetalleCuadreResumen,
  GuardarCierreBody,
  GuardarDetalleRequest,
  GuardarCierreResponse,
  ParcialesPendientesResponse,
  ContabilidadDiariaResponse,
} from "@/services/cuatreCajaService";

/**
 * Utilidad: formatea hoy como YYYY-MM-DD en local (sin libs externas).
 */
function todayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ConteoEditable = {
  conteo_fisico: number;
  billetes: number;
  monedas: number; // alias de monedas_fisicas
  observaciones_detalle?: string | null;
};

export type DetalleEditable = DetalleCuadreResumen & ConteoEditable;

export type EstadoCuadre = {
  fecha: string; // YYYY-MM-DD (seleccionada)
  observaciones: string;
  detalles: DetalleEditable[];
};

export type UseCuadreCajaOptions = {
  /**
   * Fecha a consultar en formato YYYY-MM-DD.
   * Si no se provee, se usa hoy (zona de negocio se resuelve en backend).
   */
  fecha?: string;
  /**
   * pointId opcional para contabilidad (el backend puede restringir por rol).
   */
  pointId?: string;
  /**
   * Si deseas cargar también el resumen contable para cruzar vs. cuadre.
   * Por defecto: true
   */
  withContabilidad?: boolean;
};

export type UseCuadreCaja = {
  // estado
  loading: boolean;
  saving: boolean;
  error?: string | null;

  // datos del cuadre
  cuadre?: CuadreResponse["data"];
  contabilidad?: ContabilidadDiariaResponse;
  parciales?: ParcialesPendientesResponse["data"];

  // estado editable (conteos y observaciones)
  estado: EstadoCuadre;
  setObservaciones: (v: string) => void;
  setFecha: (yyyyMMdd: string) => void;

  // edición por moneda
  updateConteo: (
    moneda_id: string,
    patch: Partial<
      Pick<
        ConteoEditable,
        "conteo_fisico" | "billetes" | "monedas" | "observaciones_detalle"
      >
    >
  ) => void;
  resetConteos: () => void;

  // cálculos derivados
  totales: {
    ingresos: number;
    egresos: number;
    movimientos: number;
  };
  diferencias: Array<{
    moneda_id: string;
    codigo: string;
    nombre: string;
    teorico: number;
    fisico: number;
    diff: number;
    fueraDeTolerancia: boolean;
  }>;
  puedeCerrar: boolean;

  // acciones
  refresh: () => Promise<void>;
  guardarParcial: (opts?: {
    allowMismatch?: boolean;
  }) => Promise<GuardarCierreResponse | null>;
  guardarCerrado: (opts?: {
    allowMismatch?: boolean;
  }) => Promise<GuardarCierreResponse | null>;
};

/**
 * Hook principal para orquestar el flujo de Cuadre de Caja (front).
 */
export default function useCuadreCaja(
  options?: UseCuadreCajaOptions
): UseCuadreCaja {
  const [fecha, setFecha] = useState<string>(options?.fecha || todayYYYYMMDD());
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [cuadre, setCuadre] = useState<CuadreResponse["data"] | undefined>(
    undefined
  );
  const [contabilidad, setContabilidad] = useState<
    ContabilidadDiariaResponse | undefined
  >(undefined);
  const [parciales, setParciales] = useState<
    ParcialesPendientesResponse["data"] | undefined
  >(undefined);

  const [estado, setEstado] = useState<EstadoCuadre>({
    fecha,
    observaciones: "",
    detalles: [],
  });

  const withContabilidad = options?.withContabilidad !== false;

  // ---------- Helpers internos ----------
  const hydrateEditable = useCallback(
    (det: DetalleCuadreResumen[]): DetalleEditable[] => {
      return det.map((d) => ({
        ...d,
        conteo_fisico: d.saldo_cierre, // default: igual al teórico
        billetes: 0,
        monedas: 0,
        observaciones_detalle: null,
      }));
    },
    []
  );

  const cargarParciales = useCallback(async () => {
    try {
      const resp = await cuatreCajaService.getParcialesPendientes();
      setParciales(resp.data);
    } catch (e: any) {
      // No detenemos flujo por error de parciales
      console.warn("getParcialesPendientes error:", e?.message || e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Traer cuadre del día/fecha
      const c = await cuatreCajaService.getCuadre({ fecha });
      setCuadre(c.data);

      // Sincronizar estado editable si cambió el universo de monedas
      const nuevos = hydrateEditable(c.data.detalles || []);
      setEstado((prev) => ({
        fecha,
        observaciones: c.data.observaciones || prev.observaciones || "",
        detalles: mergeEditable(prev.detalles, nuevos),
      }));

      // Contabilidad (cruce)
      if (withContabilidad && options?.pointId) {
        const cont = await cuatreCajaService.getContabilidadDiaria(
          options.pointId,
          fecha
        );
        setContabilidad(cont);
      } else {
        setContabilidad(undefined);
      }

      // Parciales del día
      cargarParciales();
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el cuadre");
    } finally {
      setLoading(false);
    }
  }, [
    fecha,
    withContabilidad,
    options?.pointId,
    hydrateEditable,
    cargarParciales,
  ]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, withContabilidad, options?.pointId]);

  // Si cambia la fecha, sincronizamos en el estado editable
  useEffect(() => {
    setEstado((prev) => ({ ...prev, fecha }));
  }, [fecha]);

  // ---------- Edición ----------
  const setObservaciones = useCallback((v: string) => {
    setEstado((prev) => ({ ...prev, observaciones: v }));
  }, []);

  const updateConteo: UseCuadreCaja["updateConteo"] = useCallback(
    (moneda_id, patch) => {
      setEstado((prev) => ({
        ...prev,
        detalles: prev.detalles.map((d) =>
          d.moneda_id === moneda_id
            ? {
                ...d,
                conteo_fisico:
                  patch.conteo_fisico !== undefined
                    ? numberOrZero(patch.conteo_fisico)
                    : d.conteo_fisico,
                billetes:
                  patch.billetes !== undefined
                    ? numberOrZero(patch.billetes)
                    : d.billetes,
                monedas:
                  patch.monedas !== undefined
                    ? numberOrZero(patch.monedas)
                    : d.monedas,
                observaciones_detalle:
                  patch.observaciones_detalle !== undefined
                    ? patch.observaciones_detalle ?? null
                    : d.observaciones_detalle,
              }
            : d
        ),
      }));
    },
    []
  );

  const resetConteos = useCallback(() => {
    setEstado((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => ({
        ...d,
        conteo_fisico: d.saldo_cierre,
        billetes: 0,
        monedas: 0,
        observaciones_detalle: null,
      })),
    }));
  }, []);

  // ---------- Derivados ----------
  const totales = useMemo(() => {
    const ingresos = estado.detalles.reduce(
      (s, d) => s + (d.ingresos_periodo || 0),
      0
    );
    const egresos = estado.detalles.reduce(
      (s, d) => s + (d.egresos_periodo || 0),
      0
    );
    const movimientos = estado.detalles.reduce(
      (s, d) => s + (d.movimientos_periodo || 0),
      0
    );
    return { ingresos, egresos, movimientos };
  }, [estado.detalles]);

  const diferencias = useMemo(() => {
    return estado.detalles.map((d) => {
      const teorico = round2(d.saldo_cierre || 0);
      const fisico = round2(d.conteo_fisico || 0);
      const diff = round2(fisico - teorico);
      const fueraDeTolerancia = isFueraDeTolerancia(d.codigo, diff);
      return {
        moneda_id: d.moneda_id,
        codigo: d.codigo,
        nombre: d.nombre,
        teorico,
        fisico,
        diff,
        fueraDeTolerancia,
      };
    });
  }, [estado.detalles]);

  const puedeCerrar = useMemo(() => {
    // Puede cerrar si todas las monedas tienen conteo y ninguna está fuera de tolerancia.
    // (El backend permite forzar con allowMismatch)
    if (!estado.detalles.length) return true; // si no hay monedas, permitir
    return diferencias.every((d) => !Number.isNaN(d.fisico));
  }, [estado.detalles, diferencias]);

  // ---------- Persistencia ----------
  const buildGuardarBody = useCallback((): GuardarCierreBody => {
    const detalles: GuardarDetalleRequest[] = estado.detalles.map((d) => ({
      moneda_id: d.moneda_id,
      saldo_apertura: d.saldo_apertura,
      saldo_cierre: d.saldo_cierre,
      conteo_fisico: d.conteo_fisico,
      billetes: d.billetes,
      monedas: d.monedas,
      ingresos_periodo: d.ingresos_periodo,
      egresos_periodo: d.egresos_periodo,
      movimientos_periodo: d.movimientos_periodo,
      observaciones_detalle: d.observaciones_detalle ?? undefined,
    }));

    return {
      detalles,
      observaciones: estado.observaciones || undefined,
    };
  }, [estado.detalles, estado.observaciones]);

  const guardarParcial: UseCuadreCaja["guardarParcial"] = useCallback(
    async (opts) => {
      setSaving(true);
      setError(null);
      try {
        const body = buildGuardarBody();
        const resp = await cuatreCajaService.guardarParcial({
          ...body,
          allowMismatch: opts?.allowMismatch ?? false,
        });
        await refresh();
        return resp;
      } catch (e: any) {
        setError(e?.message || "No se pudo guardar el cierre parcial");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildGuardarBody, refresh]
  );

  const guardarCerrado: UseCuadreCaja["guardarCerrado"] = useCallback(
    async (opts) => {
      setSaving(true);
      setError(null);
      try {
        const body = buildGuardarBody();
        const resp = await cuatreCajaService.guardarCierre({
          ...body,
          tipo_cierre: "CERRADO",
          allowMismatch: opts?.allowMismatch ?? false,
        });
        await refresh();
        return resp;
      } catch (e: any) {
        setError(e?.message || "No se pudo guardar el cierre");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildGuardarBody, refresh]
  );

  return {
    loading,
    saving,
    error,
    cuadre,
    contabilidad,
    parciales,

    estado,
    setObservaciones,
    setFecha,

    updateConteo,
    resetConteos,

    totales,
    diferencias,
    puedeCerrar,

    refresh,
    guardarParcial,
    guardarCerrado,
  };
}

// ===== utilidades internas =====
function numberOrZero(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isFueraDeTolerancia(codigo: string, diff: number): boolean {
  const tol = codigo?.toUpperCase() === "USD" ? 1.0 : 0.01;
  return Math.abs(diff) > tol + 1e-9;
}

/**
 * Mezcla estado editable anterior con nuevos detalles (por si cambian monedas).
 * Mantiene conteos ya escritos por el usuario cuando coincide moneda_id.
 */
function mergeEditable(
  prev: DetalleEditable[],
  next: DetalleEditable[]
): DetalleEditable[] {
  const prevById = new Map(prev.map((d) => [d.moneda_id, d]));
  return next.map((n) => {
    const p = prevById.get(n.moneda_id);
    if (!p) return n;
    return {
      ...n,
      conteo_fisico: p.conteo_fisico ?? n.conteo_fisico,
      billetes: p.billetes ?? n.billetes,
      monedas: p.monedas ?? n.monedas,
      observaciones_detalle: p.observaciones_detalle ?? n.observaciones_detalle,
    };
  });
}
