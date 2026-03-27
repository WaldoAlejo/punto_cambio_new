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
  DesgloseDenominacion,
} from "@/services/cuatreCajaService";
import saldoService from "@/services/saldoService";
import cierreReporteService, { ValidacionCierre } from "@/services/cierreReporteService";

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

// Denominaciones por defecto (fallback)
const DENOMINACIONES_DEFAULT = {
  billetes: [100, 50, 20, 10, 5, 1],
  monedas: [1, 0.5, 0.25, 0.1, 0.05, 0.01],
};

// Denominaciones específicas por código de moneda
const DENOMINACIONES_POR_MONEDA: Record<string, { billetes: number[]; monedas: number[] }> = {
  USD: {
    billetes: [100, 50, 20, 10, 5, 2, 1],
    monedas: [1, 0.5, 0.25, 0.1, 0.05, 0.01],
  },
  COP: {
    billetes: [100000, 50000, 20000, 10000, 5000, 2000, 1000],
    monedas: [1000, 500, 200, 100, 50],
  },
  EUR: {
    billetes: [500, 200, 100, 50, 20, 10, 5],
    monedas: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
  },
  PEN: {
    billetes: [200, 100, 50, 20, 10],
    monedas: [5, 2, 1, 0.5, 0.2, 0.1],
  },
  CLP: {
    billetes: [20000, 10000, 5000, 2000, 1000],
    monedas: [500, 100, 50, 10, 5, 1],
  },
  ARS: {
    billetes: [10000, 2000, 1000, 500, 200, 100, 50, 20, 10],
    monedas: [50, 10, 5, 2, 1, 0.5],
  },
  VES: {
    billetes: [100, 50, 20, 10, 5, 2, 1],
    monedas: [1, 0.5, 0.25, 0.1, 0.05],
  },
  CHF: {
    billetes: [1000, 200, 100, 50, 20, 10],
    monedas: [0.5, 0.2, 0.1, 0.05],
  },
};

export interface BilleteInput {
  denominacion: number;
  cantidad: number;
}

export interface MonedaInput {
  denominacion: number;
  cantidad: number;
}

export interface DesgloseDenominaciones {
  billetes: BilleteInput[];
  monedas: MonedaInput[];
}

export type ConteoEditable = {
  conteo_fisico: number;
  conteo_bancos: number;
  billetes: number; // total calculado
  monedas: number;  // total calculado
  desglose: DesgloseDenominaciones; // desglose por denominación
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

export type ReconciliacionResult = {
  punto_atencion_id: string;
  moneda_id: string;
  saldo_registrado: number;
  saldo_calculado: number;
  diferencia: number;
  ajustado: boolean;
};

export type UseCuadreCaja = {
  // estado
  loading: boolean;
  saving: boolean;
  reconciliando: boolean;
  validando: boolean;
  error?: string | null;

  // datos del cuadre
  cuadre?: CuadreResponse["data"];
  contabilidad?: ContabilidadDiariaResponse;
  parciales?: ParcialesPendientesResponse["data"];
  validacion?: ValidacionCierre;

  // estado editable (conteos y observaciones)
  estado: EstadoCuadre;
  setObservaciones: (v: string) => void;
  setFecha: (yyyyMMdd: string) => void;

  // edición por moneda - totales
  updateConteo: (
    moneda_id: string,
    patch: Partial<
      Pick<
        ConteoEditable,
        | "conteo_fisico"
        | "conteo_bancos"
        | "billetes"
        | "monedas"
        | "observaciones_detalle"
      >
    >
  ) => void;
  
  // edición por moneda - desglose por denominación
  updateDesgloseBillete: (moneda_id: string, denominacion: number, cantidad: number) => void;
  updateDesgloseMoneda: (moneda_id: string, denominacion: number, cantidad: number) => void;
  
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
  validacionesCompletas: boolean;

  // acciones
  refresh: () => Promise<void>;
  validarCierre: () => Promise<ValidacionCierre | null>;
  guardarParcial: (opts?: { allowMismatch?: boolean }) => Promise<GuardarCierreResponse | null>;
  guardarCerrado: (opts?: { allowMismatch?: boolean }) => Promise<GuardarCierreResponse | null>;
  
  // reconciliación
  reconciliarSaldo: (monedaId?: string) => Promise<ReconciliacionResult | null>;
  calcularSaldoReal: (monedaId?: string) => Promise<number | null>;

  // reporte
  getReporteParaImpresion: () => Array<{
    moneda_id: string;
    codigo: string;
    nombre: string;
    simbolo: string;
    saldo_apertura: number;
    ingresos_periodo: number;
    egresos_periodo: number;
    saldo_cierre: number;
    conteo_fisico: number;
    billetes: number;
    monedas: number;
    bancos_teorico?: number;
    conteo_bancos?: number;
    diferencia: number;
    diferencia_bancos?: number;
    movimientos_periodo: number;
    desglose_denominaciones?: DesgloseDenominacion[];
  }>;
};

/**
 * Hook principal para orquestar el flujo de Cuadre de Caja (front).
 */
export default function useCuadreCaja(options?: UseCuadreCajaOptions): UseCuadreCaja {
  const [fecha, setFecha] = useState<string>(options?.fecha || todayYYYYMMDD());
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [reconciliando, setReconciliando] = useState<boolean>(false);
  const [validando, setValidando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [cuadre, setCuadre] = useState<CuadreResponse["data"] | undefined>(undefined);
  const [contabilidad, setContabilidad] = useState<ContabilidadDiariaResponse | undefined>(
    undefined
  );
  const [parciales, setParciales] = useState<ParcialesPendientesResponse["data"] | undefined>(
    undefined
  );
  const [validacion, setValidacion] = useState<ValidacionCierre | undefined>(undefined);

  const [estado, setEstado] = useState<EstadoCuadre>({
    fecha,
    observaciones: "",
    detalles: [],
  });

  const withContabilidad = options?.withContabilidad !== false;

  // Helper para obtener denominaciones por moneda
  const getDenominacionesPorMoneda = useCallback((codigo: string): { billetes: number[]; monedas: number[] } => {
    return DENOMINACIONES_POR_MONEDA[codigo] || DENOMINACIONES_DEFAULT;
  }, []);

  // Helper para calcular totales desde el desglose
  const calcularTotalesDesdeDesglose = useCallback((desglose: DesgloseDenominaciones): { billetes: number; monedas: number; total: number } => {
    const totalBilletes = desglose.billetes.reduce((sum, b) => sum + b.denominacion * b.cantidad, 0);
    const totalMonedas = desglose.monedas.reduce((sum, m) => sum + m.denominacion * m.cantidad, 0);
    return {
      billetes: Math.round(totalBilletes * 100) / 100,
      monedas: Math.round(totalMonedas * 100) / 100,
      total: Math.round((totalBilletes + totalMonedas) * 100) / 100,
    };
  }, []);

  // ---------- Helpers internos ----------
  const hydrateEditable = useCallback((det: DetalleCuadreResumen[]): DetalleEditable[] => {
    return det.map((d) => {
      const denominaciones = getDenominacionesPorMoneda(d.codigo);
      
      // Si hay desglose guardado previamente, usarlo
      let desglose: DesgloseDenominaciones;
      if (d.desglose_denominaciones && d.desglose_denominaciones.length > 0) {
        desglose = {
          billetes: denominaciones.billetes.map(denom => ({
            denominacion: denom,
            cantidad: d.desglose_denominaciones?.find(dd => dd.denominacion === denom && dd.tipo === 'BILLETE')?.cantidad || 0,
          })),
          monedas: denominaciones.monedas.map(denom => ({
            denominacion: denom,
            cantidad: d.desglose_denominaciones?.find(dd => dd.denominacion === denom && dd.tipo === 'MONEDA')?.cantidad || 0,
          })),
        };
      } else {
        // Inicializar con cantidades en 0
        desglose = {
          billetes: denominaciones.billetes.map(denom => ({ denominacion: denom, cantidad: 0 })),
          monedas: denominaciones.monedas.map(denom => ({ denominacion: denom, cantidad: 0 })),
        };
      }

      const totales = calcularTotalesDesdeDesglose(desglose);
      
      return {
        ...d,
        conteo_fisico: d.saldo_cierre, // default: igual al teórico
        conteo_bancos: Number(d.conteo_bancos ?? d.bancos_teorico ?? 0),
        billetes: totales.billetes,
        monedas: totales.monedas,
        desglose,
        observaciones_detalle: null,
      };
    });
  }, [getDenominacionesPorMoneda, calcularTotalesDesdeDesglose]);

  const cargarParciales = useCallback(async () => {
    try {
      const resp = await cuatreCajaService.getParcialesPendientes();
      setParciales(resp.data);
    } catch (e: unknown) {
      // No detenemos flujo por error de parciales
      console.warn("getParcialesPendientes error:", e instanceof Error ? e.message : String(e));
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
        const cont = await cuatreCajaService.getContabilidadDiaria(options.pointId, fecha);
        setContabilidad(cont);
      } else {
        setContabilidad(undefined);
      }

      // Parciales del día
      cargarParciales();

      // Limpiar validación anterior
      setValidacion(undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el cuadre");
    } finally {
      setLoading(false);
    }
  }, [fecha, withContabilidad, options?.pointId, hydrateEditable, cargarParciales]);

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

  const updateConteo: UseCuadreCaja["updateConteo"] = useCallback((moneda_id, patch) => {
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
              conteo_bancos:
                patch.conteo_bancos !== undefined
                  ? numberOrZero(patch.conteo_bancos)
                  : d.conteo_bancos,
              billetes:
                patch.billetes !== undefined ? numberOrZero(patch.billetes) : d.billetes,
              monedas:
                patch.monedas !== undefined ? numberOrZero(patch.monedas) : d.monedas,
              observaciones_detalle:
                patch.observaciones_detalle !== undefined
                  ? patch.observaciones_detalle ?? null
                  : d.observaciones_detalle,
            }
          : d
      ),
    }));
  }, []);

  const updateDesgloseBillete: UseCuadreCaja["updateDesgloseBillete"] = useCallback((moneda_id, denominacion, cantidad) => {
    setEstado((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => {
        if (d.moneda_id !== moneda_id) return d;
        
        const nuevoDesglose = {
          ...d.desglose,
          billetes: d.desglose.billetes.map(b =>
            b.denominacion === denominacion ? { ...b, cantidad: Math.max(0, cantidad) } : b
          ),
        };
        
        const totales = calcularTotalesDesdeDesglose(nuevoDesglose);
        
        return {
          ...d,
          desglose: nuevoDesglose,
          billetes: totales.billetes,
          monedas: totales.monedas,
          conteo_fisico: totales.total,
        };
      }),
    }));
  }, [calcularTotalesDesdeDesglose]);

  const updateDesgloseMoneda: UseCuadreCaja["updateDesgloseMoneda"] = useCallback((moneda_id, denominacion, cantidad) => {
    setEstado((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => {
        if (d.moneda_id !== moneda_id) return d;
        
        const nuevoDesglose = {
          ...d.desglose,
          monedas: d.desglose.monedas.map(m =>
            m.denominacion === denominacion ? { ...m, cantidad: Math.max(0, cantidad) } : m
          ),
        };
        
        const totales = calcularTotalesDesdeDesglose(nuevoDesglose);
        
        return {
          ...d,
          desglose: nuevoDesglose,
          billetes: totales.billetes,
          monedas: totales.monedas,
          conteo_fisico: totales.total,
        };
      }),
    }));
  }, [calcularTotalesDesdeDesglose]);

  const resetConteos = useCallback(() => {
    setEstado((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => {
        const denominaciones = getDenominacionesPorMoneda(d.codigo);
        const desgloseVacio: DesgloseDenominaciones = {
          billetes: denominaciones.billetes.map(denom => ({ denominacion: denom, cantidad: 0 })),
          monedas: denominaciones.monedas.map(denom => ({ denominacion: denom, cantidad: 0 })),
        };
        
        return {
          ...d,
          conteo_fisico: d.saldo_cierre,
          conteo_bancos: Number(d.bancos_teorico ?? 0),
          billetes: 0,
          monedas: 0,
          desglose: desgloseVacio,
          observaciones_detalle: null,
        };
      }),
    }));
  }, [getDenominacionesPorMoneda]);

  // ---------- Derivados ----------
  const totales = useMemo(() => {
    const ingresos = estado.detalles.reduce((s, d) => s + (d.ingresos_periodo || 0), 0);
    const egresos = estado.detalles.reduce((s, d) => s + (d.egresos_periodo || 0), 0);
    const movimientos = estado.detalles.reduce((s, d) => s + (d.movimientos_periodo || 0), 0);
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

  const validacionesCompletas = useMemo(() => {
    // Verificar que todos los conteos estén completos
    if (estado.detalles.length === 0) return false;
    
    return estado.detalles.every((d) => {
      const tol = d.codigo === "USD" ? 1.0 : 0.01;
      const diffEfectivo = Math.abs((d.conteo_fisico || 0) - d.saldo_cierre);
      const diffBancos = Math.abs((d.conteo_bancos || 0) - (d.bancos_teorico || 0));
      const desgloseOk = Math.abs((d.billetes || 0) + (d.monedas || 0) - (d.conteo_fisico || 0)) <= 0.01;
      
      return diffEfectivo <= tol && diffBancos <= tol && desgloseOk;
    });
  }, [estado.detalles]);

  // ---------- Validación ----------
  const validarCierre = useCallback(async (): Promise<ValidacionCierre | null> => {
    if (!options?.pointId) {
      setError("Se requiere un punto de atención para validar");
      return null;
    }
    
    setValidando(true);
    setError(null);
    try {
      const result = await cierreReporteService.validarCierre(options.pointId, fecha);
      if (result.success && result.data) {
        setValidacion(result.data);
        return result.data;
      } else {
        setError(result.error || "Error al validar cierre");
        return null;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al validar cierre");
      return null;
    } finally {
      setValidando(false);
    }
  }, [options?.pointId, fecha]);

  // ---------- Persistencia ----------
  const buildGuardarBody = useCallback((): GuardarCierreBody => {
    const detalles: GuardarDetalleRequest[] = estado.detalles.map((d) => {
      // Convertir desglose al formato del backend
      const desglose_denominaciones: DesgloseDenominacion[] = [
        ...d.desglose.billetes
          .filter(b => b.cantidad > 0)
          .map(b => ({
            denominacion: b.denominacion,
            tipo: 'BILLETE' as const,
            cantidad: b.cantidad,
          })),
        ...d.desglose.monedas
          .filter(m => m.cantidad > 0)
          .map(m => ({
            denominacion: m.denominacion,
            tipo: 'MONEDA' as const,
            cantidad: m.cantidad,
          })),
      ];

      return {
        moneda_id: d.moneda_id,
        saldo_apertura: d.saldo_apertura,
        saldo_cierre: d.saldo_cierre,
        conteo_fisico: d.conteo_fisico,
        bancos_teorico: Number(d.bancos_teorico ?? 0),
        conteo_bancos: d.conteo_bancos,
        billetes: d.billetes,
        monedas: d.monedas,
        ingresos_periodo: d.ingresos_periodo,
        egresos_periodo: d.egresos_periodo,
        movimientos_periodo: d.movimientos_periodo,
        observaciones_detalle: d.observaciones_detalle ?? undefined,
        desglose_denominaciones: desglose_denominaciones.length > 0 ? desglose_denominaciones : undefined,
      };
    });

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
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el cierre parcial");
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
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el cierre");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildGuardarBody, refresh]
  );

  // ---------- Reporte para impresión ----------
  const getReporteParaImpresion = useCallback(() => {
    return estado.detalles.map((d) => {
      const desglose_denominaciones: DesgloseDenominacion[] = [
        ...d.desglose.billetes
          .filter(b => b.cantidad > 0)
          .map(b => ({
            denominacion: b.denominacion,
            tipo: 'BILLETE' as const,
            cantidad: b.cantidad,
          })),
        ...d.desglose.monedas
          .filter(m => m.cantidad > 0)
          .map(m => ({
            denominacion: m.denominacion,
            tipo: 'MONEDA' as const,
            cantidad: m.cantidad,
          })),
      ];

      return {
        moneda_id: d.moneda_id,
        codigo: d.codigo,
        nombre: d.nombre,
        simbolo: d.simbolo,
        saldo_apertura: d.saldo_apertura,
        ingresos_periodo: d.ingresos_periodo || 0,
        egresos_periodo: d.egresos_periodo || 0,
        saldo_cierre: d.saldo_cierre,
        conteo_fisico: d.conteo_fisico || 0,
        billetes: d.billetes || 0,
        monedas: d.monedas || 0,
        bancos_teorico: d.bancos_teorico,
        conteo_bancos: d.conteo_bancos,
        diferencia: round2((d.conteo_fisico || 0) - d.saldo_cierre),
        diferencia_bancos: round2((d.conteo_bancos || 0) - (d.bancos_teorico || 0)),
        movimientos_periodo: d.movimientos_periodo || 0,
        desglose_denominaciones: desglose_denominaciones.length > 0 ? desglose_denominaciones : undefined,
      };
    });
  }, [estado.detalles]);

  // ---------- Reconciliación ----------
  const reconciliarSaldo = useCallback(async (monedaId?: string): Promise<ReconciliacionResult | null> => {
    if (!options?.pointId) {
      setError("Se requiere un punto de atención para reconciliar");
      return null;
    }
    setReconciliando(true);
    setError(null);
    try {
      const result = await saldoService.reconciliarSaldo(options.pointId, monedaId);
      await refresh();
      return result;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al reconciliar saldo");
      return null;
    } finally {
      setReconciliando(false);
    }
  }, [options?.pointId, refresh]);

  const calcularSaldoReal = useCallback(async (monedaId?: string): Promise<number | null> => {
    if (!options?.pointId) {
      setError("Se requiere un punto de atención para calcular el saldo real");
      return null;
    }
    setReconciliando(true);
    setError(null);
    try {
      const result = await saldoService.calcularSaldoReal(options.pointId, monedaId);
      return result;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al calcular saldo real");
      return null;
    } finally {
      setReconciliando(false);
    }
  }, [options?.pointId]);

  return {
    loading,
    saving,
    reconciliando,
    validando,
    error,
    cuadre,
    contabilidad,
    parciales,
    validacion,

    estado,
    setObservaciones,
    setFecha,

    updateConteo,
    updateDesgloseBillete,
    updateDesgloseMoneda,
    resetConteos,

    totales,
    diferencias,
    puedeCerrar,
    validacionesCompletas,

    refresh,
    validarCierre,
    guardarParcial,
    guardarCerrado,
    getReporteParaImpresion,
    reconciliarSaldo,
    calcularSaldoReal,
  };
}

// ===== utilidades internas =====
function numberOrZero(v: unknown): number {
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
function mergeEditable(prev: DetalleEditable[], next: DetalleEditable[]): DetalleEditable[] {
  const prevById = new Map(prev.map((d) => [d.moneda_id, d]));
  return next.map((n) => {
    const p = prevById.get(n.moneda_id);
    if (!p) return n;
    return {
      ...n,
      conteo_fisico: p.conteo_fisico ?? n.conteo_fisico,
      conteo_bancos: p.conteo_bancos ?? n.conteo_bancos,
      billetes: p.billetes ?? n.billetes,
      monedas: p.monedas ?? n.monedas,
      desglose: p.desglose ?? n.desglose,
      observaciones_detalle: p.observaciones_detalle ?? n.observaciones_detalle,
    };
  });
}
