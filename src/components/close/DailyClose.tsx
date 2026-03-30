import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { scheduleService } from "@/services/scheduleService";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { User, PuntoAtencion, CuadreCaja } from "../../types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle,
  Coins,
  MapPin,
  RefreshCw,
} from "lucide-react";
// import ExternalServicesClose from "./ExternalServicesClose"; // Ya no se requiere cierre separado
import { contabilidadDiariaService } from "../../services/contabilidadDiariaService";
import cuatreCajaService from "@/services/cuatreCajaService";
import { todayGyeDateOnly } from "@/utils/timezone";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCantidad(val: unknown): number {
  if (typeof val === "number") return val;
  if (isRecord(val) && typeof val.cantidad === "number") return val.cantidad;
  return 0;
}

function toNumber(val: unknown, fallback = 0): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringSafe(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

const DENOMINACIONES_DEFAULT = {
  billetes: [100, 50, 20, 10, 5, 1],
  monedas: [1, 0.5, 0.25, 0.1, 0.05, 0.01],
};

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
    billetes: [20000, 10000, 5000, 1000],
    monedas: [500, 100, 50, 10],
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
  MXN: {
    billetes: [1000, 500, 200, 100, 50, 20],
    monedas: [10, 5, 2, 1, 0.5],
  },
};

interface DenominacionInput {
  denominacion: number;
  cantidad: number;
}

interface DesgloseDenominacion {
  denominacion: number;
  tipo: "BILLETE" | "MONEDA";
  cantidad: number;
}

interface DenominationAdjustment {
  bills: DenominacionInput[];
  coins: DenominacionInput[];
}

function getDenominacionesPorMoneda(codigo: string): {
  billetes: number[];
  monedas: number[];
} {
  return DENOMINACIONES_POR_MONEDA[codigo] || DENOMINACIONES_DEFAULT;
}

function hydrateDesgloseDenominaciones(
  codigo: string,
  desgloseGuardado?: DesgloseDenominacion[]
): DenominationAdjustment {
  const denominaciones = getDenominacionesPorMoneda(codigo);

  return {
    bills: denominaciones.billetes.map((denominacion) => ({
      denominacion,
      cantidad:
        desgloseGuardado?.find(
          (item) => item.denominacion === denominacion && item.tipo === "BILLETE"
        )?.cantidad || 0,
    })),
    coins: denominaciones.monedas.map((denominacion) => ({
      denominacion,
      cantidad:
        desgloseGuardado?.find(
          (item) => item.denominacion === denominacion && item.tipo === "MONEDA"
        )?.cantidad || 0,
    })),
  };
}

function calcularTotalesDenominaciones(desglose: DenominationAdjustment): {
  bills: number;
  coins: number;
  total: number;
} {
  const bills = desglose.bills.reduce(
    (sum, item) => sum + item.denominacion * item.cantidad,
    0
  );
  const coins = desglose.coins.reduce(
    (sum, item) => sum + item.denominacion * item.cantidad,
    0
  );

  return {
    bills: Math.round(bills * 100) / 100,
    coins: Math.round(coins * 100) / 100,
    total: Math.round((bills + coins) * 100) / 100,
  };
}

function normalizeResumenCierre(raw: unknown): ResumenCierre | null {
  if (!isRecord(raw)) return null;

  const saldos_principales: ResumenSaldoPrincipal[] = Array.isArray(raw.saldos_principales)
    ? raw.saldos_principales
        .filter(isRecord)
        .map((s) => ({
          moneda_codigo: toStringSafe(s.moneda_codigo, ""),
          moneda_nombre: toStringSafe(s.moneda_nombre, ""),
          moneda_simbolo: toStringSafe(s.moneda_simbolo, ""),
          tuvo_movimientos: typeof s.tuvo_movimientos === "boolean" ? s.tuvo_movimientos : false,
          saldo_final: toNumber(s.saldo_final, 0),
        }))
    : [];

  const servicios_externos: ResumenServicioExterno[] = Array.isArray(raw.servicios_externos)
    ? raw.servicios_externos
        .filter(isRecord)
        .map((se) => ({
          servicio_nombre: toStringSafe(se.servicio_nombre, ""),
          servicio_tipo: toStringSafe(se.servicio_tipo, ""),
          saldos: Array.isArray(se.saldos)
            ? se.saldos
                .filter(isRecord)
                .map((ss) => ({
                  moneda_codigo: toStringSafe(ss.moneda_codigo, ""),
                  moneda_simbolo: toStringSafe(ss.moneda_simbolo, ""),
                  saldo: toNumber(ss.saldo, 0),
                }))
            : [],
        }))
    : [];

  // Helper para normalizar montos que pueden venir como string (Decimal) o number
  const normalizeMonto = (val: unknown): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (val == null) return 0;
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const transaccionesRaw = isRecord(raw.transacciones) ? raw.transacciones : null;
  const transacciones: ResumenCierre["transacciones"] = transaccionesRaw
    ? {
        cambios_divisas: Array.isArray(transaccionesRaw.cambios_divisas)
          ? transaccionesRaw.cambios_divisas.filter(isRecord).map((c) => ({
              id: String(c.id || ""),
              fecha: String(c.fecha || ""),
              numero_recibo: c.numero_recibo ? String(c.numero_recibo) : undefined,
              tipo_operacion: c.tipo_operacion ? String(c.tipo_operacion) : undefined,
              usuario: isRecord(c.usuario) ? {
                nombre: c.usuario.nombre ? String(c.usuario.nombre) : undefined,
                username: c.usuario.username ? String(c.usuario.username) : undefined,
              } : undefined,
              moneda_origen: isRecord(c.moneda_origen) ? {
                codigo: c.moneda_origen.codigo ? String(c.moneda_origen.codigo) : undefined,
                nombre: c.moneda_origen.nombre ? String(c.moneda_origen.nombre) : undefined,
                simbolo: c.moneda_origen.simbolo ? String(c.moneda_origen.simbolo) : undefined,
              } : undefined,
              moneda_destino: isRecord(c.moneda_destino) ? {
                codigo: c.moneda_destino.codigo ? String(c.moneda_destino.codigo) : undefined,
                nombre: c.moneda_destino.nombre ? String(c.moneda_destino.nombre) : undefined,
                simbolo: c.moneda_destino.simbolo ? String(c.moneda_destino.simbolo) : undefined,
              } : undefined,
              monto_origen: normalizeMonto(c.monto_origen),
              monto_destino: normalizeMonto(c.monto_destino),
              tasa_cambio_billetes: normalizeMonto(c.tasa_cambio_billetes),
              tasa_cambio_monedas: normalizeMonto(c.tasa_cambio_monedas),
            }))
          : [],
        servicios_externos: Array.isArray(transaccionesRaw.servicios_externos)
          ? transaccionesRaw.servicios_externos.filter(isRecord).map((s) => ({
              id: String(s.id || ""),
              fecha: String(s.fecha || ""),
              servicio: s.servicio ? String(s.servicio) : undefined,
              tipo_movimiento: s.tipo_movimiento ? String(s.tipo_movimiento) : undefined,
              usuario: isRecord(s.usuario) ? {
                nombre: s.usuario.nombre ? String(s.usuario.nombre) : undefined,
                username: s.usuario.username ? String(s.usuario.username) : undefined,
              } : undefined,
              moneda: s.moneda ? String(s.moneda) : undefined,
              monto: normalizeMonto(s.monto),
              numero_referencia: s.numero_referencia ? String(s.numero_referencia) : undefined,
            }))
          : [],
      }
    : undefined;

  const balanceRaw = isRecord(raw.balance) ? raw.balance : null;
  const balanceCambiosRaw = balanceRaw && isRecord(balanceRaw.cambios_divisas) ? balanceRaw.cambios_divisas : null;
  const balanceServiciosRaw = balanceRaw && isRecord(balanceRaw.servicios_externos) ? balanceRaw.servicios_externos : null;

  const normalizeBalanceRow = (r: unknown): ResumenBalancePorMonedaRow | null => {
    if (!isRecord(r)) return null;
    return {
      moneda: isRecord(r.moneda) ? {
        codigo: r.moneda.codigo ? String(r.moneda.codigo) : undefined,
        nombre: r.moneda.nombre ? String(r.moneda.nombre) : undefined,
        simbolo: r.moneda.simbolo ? String(r.moneda.simbolo) : undefined,
      } : undefined,
      ingresos: normalizeMonto(r.ingresos),
      egresos: normalizeMonto(r.egresos),
      neto: normalizeMonto(r.neto),
    };
  };

  const balance: ResumenCierre["balance"] =
    balanceRaw
      ? {
          cambios_divisas: {
            por_moneda: Array.isArray(balanceCambiosRaw?.por_moneda)
              ? balanceCambiosRaw.por_moneda.map(normalizeBalanceRow).filter((r): r is ResumenBalancePorMonedaRow => r !== null)
              : [],
          },
          servicios_externos: {
            por_moneda: Array.isArray(balanceServiciosRaw?.por_moneda)
              ? balanceServiciosRaw.por_moneda.map(normalizeBalanceRow).filter((r): r is ResumenBalancePorMonedaRow => r !== null)
              : [],
          },
        }
      : undefined;

  return {
    fecha: typeof raw.fecha === "string" ? raw.fecha : undefined,
    punto_atencion_id:
      typeof raw.punto_atencion_id === "string" ? raw.punto_atencion_id : undefined,
    total_transacciones: toNumber(raw.total_transacciones, 0),
    saldos_principales,
    servicios_externos,
    transacciones,
    balance,
  };
}

interface ResumenUsuarioRef {
  nombre?: string;
  username?: string;
}

interface ResumenMonedaRef {
  codigo?: string;
  nombre?: string;
}

interface ResumenSaldoPrincipal {
  moneda_codigo: string;
  moneda_nombre: string;
  moneda_simbolo: string;
  tuvo_movimientos: boolean;
  saldo_final: number;
}

interface ResumenServicioExternoSaldo {
  moneda_codigo: string;
  moneda_simbolo: string;
  saldo: number;
}

interface ResumenServicioExterno {
  servicio_nombre: string;
  servicio_tipo: string;
  saldos: ResumenServicioExternoSaldo[];
}

interface ResumenCambioDivisaTx {
  id: string;
  fecha: string;
  numero_recibo?: string;
  tipo_operacion?: string;
  usuario?: ResumenUsuarioRef;
  moneda_origen?: ResumenMonedaRef;
  moneda_destino?: ResumenMonedaRef;
  monto_origen?: number;
  monto_destino?: number;
  tasa_cambio_billetes?: number;
  tasa_cambio_monedas?: number;
}

interface ResumenServicioExternoTx {
  id: string;
  fecha: string;
  servicio?: string;
  tipo_movimiento?: string;
  usuario?: ResumenUsuarioRef;
  moneda?: string;
  monto?: number;
  numero_referencia?: string;
}

interface ResumenBalancePorMonedaRow {
  moneda?: ResumenMonedaRef;
  ingresos?: number;
  egresos?: number;
  neto?: number;
}

interface ResumenCierre {
  fecha?: string;
  punto_atencion_id?: string;
  total_transacciones: number;
  saldos_principales: ResumenSaldoPrincipal[];
  servicios_externos: ResumenServicioExterno[];
  transacciones?: {
    cambios_divisas?: ResumenCambioDivisaTx[];
    servicios_externos?: ResumenServicioExternoTx[];
  };
  balance?: {
    cambios_divisas?: { por_moneda?: ResumenBalancePorMonedaRow[] };
    servicios_externos?: { por_moneda?: ResumenBalancePorMonedaRow[] };
  };
}

interface DailyCloseProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface CuadreDetalle {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre: number;
  bancos_teorico?: number;
  conteo_bancos?: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number;
  ingresos_periodo: number;
  egresos_periodo: number;
  movimientos_periodo: number;
  desglose_denominaciones?: DesgloseDenominacion[];
}

const DailyClose = ({ user, selectedPoint }: DailyCloseProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [cuadreData, setCuadreData] = useState<{
    detalles: CuadreDetalle[];
    observaciones: string;
    cuadre_id?: string;
    periodo_inicio?: string;
    totales?: {
      cambios: number | { cantidad: number };
      servicios_externos?: number | { cantidad: number };
      transferencias_entrada: number | { cantidad: number };
      transferencias_salida: number | { cantidad: number };
    };
  } | null>(null);
  const [userAdjustments, setUserAdjustments] = useState<{
    [key: string]: { bills: string; coins: string; banks: string; note?: string };
  }>({});
  const [denominationAdjustments, setDenominationAdjustments] = useState<
    Record<string, DenominationAdjustment>
  >({});
  const [todayClose, setTodayClose] = useState<CuadreCaja | null>(null);
  const [hasActiveJornada, setHasActiveJornada] = useState<boolean | null>(
    null
  );
  const [jornadaFinalizada, setJornadaFinalizada] = useState(false);
  const [loading, setLoading] = useState(false); // carga de cuadre
  const [closing, setClosing] = useState(false); // estado de cierre en progreso
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { ConfirmationDialog } = useConfirmationDialog();
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [resumenCierre, setResumenCierre] = useState<ResumenCierre | null>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [validacionCierres, setValidacionCierres] = useState<
    | {
        cierres_requeridos: {
          servicios_externos: boolean;
          cambios_divisas: boolean;
          cierre_diario: boolean;
        };
        estado_cierres: {
          servicios_externos: boolean;
          cambios_divisas: boolean;
          cierre_diario: boolean;
        };
        cierres_completos: boolean;
        conteos?: {
          cambios_divisas: number;
          servicios_externos: number;
        };
      }
    | null
  >(null);

  // Verificar jornada activa
  useEffect(() => {
    const checkActiveJornada = async (): Promise<void> => {
      try {
        if (!localStorage.getItem("authToken")) {
          setHasActiveJornada(false);
          return;
        }

        const data = await scheduleService.getActiveSchedule();
        const hasJornada =
          !!data.schedule &&
          (data.schedule.estado === "ACTIVO" || data.schedule.estado === "ALMUERZO");
        setHasActiveJornada(hasJornada);
      } catch (error) {
        console.error("💥 Error checking active jornada:", error);
        setHasActiveJornada(false);
      }
    };

    if (user.rol === "OPERADOR") {
      checkActiveJornada();
      const interval = setInterval(checkActiveJornada, 30000);
      return () => clearInterval(interval);
    } else {
      setHasActiveJornada(true);
    }
    // Ensure all code paths return void
    return;
  }, [user]);

  // Obtener datos de cuadre automático
  // Nota: el fetch de cuadre se maneja por `fetchCuadreData` (useCallback) para soportar retry y fallback.

  const handleUserAdjustment = (
    monedaId: string,
    type: "bills" | "coins" | "banks" | "note",
    value: string
  ) => {
    if (type === "bills" || type === "coins") {
      return;
    }

    if (type === "note") {
      setUserAdjustments((prev) => ({
        ...prev,
        [monedaId]: {
          ...prev[monedaId],
          note: value,
        },
      }));
      return;
    }

    // No permitir valores negativos
    const numValue = parseFloat(value);
    if (numValue < 0) return;

    setUserAdjustments((prev) => ({
      ...prev,
      [monedaId]: {
        ...prev[monedaId],
        [type]: value,
      },
    }));
  };

  const calculateBreakdownTotals = useCallback((monedaId: string) => {
    const desglose = denominationAdjustments[monedaId];
    if (!desglose) {
      return { bills: 0, coins: 0, total: 0 };
    }
    return calcularTotalesDenominaciones(desglose);
  }, [denominationAdjustments]);

  const calculateUserTotal = (monedaId: string) => {
    return calculateBreakdownTotals(monedaId).total;
  };

  const calculateUserBanks = (monedaId: string) => {
    const banks = parseFloat(userAdjustments[monedaId]?.banks || "0");
    return banks;
  };

  // ✅ NUEVA FUNCIÓN: Validar que el desglose cuadre con el conteo total
  const validateBreakdown = (monedaId: string): { valid: boolean; breakdownTotal: number; difference: number } => {
    const { total: breakdownTotal } = calculateBreakdownTotals(monedaId);
    
    // El conteo físico es lo que el operador declara tener
    // Se compara contra el saldo_cierre teórico
    const detalle = cuadreData?.detalles?.find(d => d.moneda_id === monedaId);
    if (!detalle) return { valid: true, breakdownTotal, difference: 0 };
    
    // Permitir pequeña diferencia por redondeo
    const difference = Math.abs(breakdownTotal - detalle.saldo_cierre);
    const tolerance = detalle.codigo === "USD" ? 1.0 : 0.01;
    
    return { 
      valid: difference <= tolerance, 
      breakdownTotal, 
      difference 
    };
  };

  // ✅ NUEVA FUNCIÓN: Verificar si el desglose interno es consistente
  const isBreakdownConsistent = (monedaId: string): boolean => {
    const desglose = denominationAdjustments[monedaId];
    if (!desglose) return true;
    const items = [...desglose.bills, ...desglose.coins];
    
    if (items.every((item) => item.cantidad === 0)) return true;
    
    return items.every((item) => Number.isFinite(item.cantidad) && item.cantidad >= 0);
  };

  const updateDenominationCount = useCallback(
    (
      monedaId: string,
      type: "bills" | "coins",
      denominacion: number,
      value: string
    ) => {
      const cantidad = Math.max(0, parseInt(value || "0", 10) || 0);

      setDenominationAdjustments((prev) => {
        const current = prev[monedaId] || { bills: [], coins: [] };
        const nextSection = current[type].map((item) =>
          item.denominacion === denominacion ? { ...item, cantidad } : item
        );
        const next = {
          ...current,
          [type]: nextSection,
        };
        const totals = calcularTotalesDenominaciones(next);

        setUserAdjustments((prevAdjustments) => ({
          ...prevAdjustments,
          [monedaId]: {
            ...prevAdjustments[monedaId],
            bills: totals.bills.toFixed(2),
            coins: totals.coins.toFixed(2),
            banks: prevAdjustments[monedaId]?.banks ?? "0.00",
            note: prevAdjustments[monedaId]?.note || "",
          },
        }));

        return {
          ...prev,
          [monedaId]: next,
        };
      });
    },
    []
  );

  // Permitir hasta ±1.00 USD de ajuste; otras divisas deben cuadrar (±0.01)
  const getTolerance = (detalle: CuadreDetalle) =>
    detalle.codigo === "USD" ? 1.0 : 0.01;

  const validateBalance = (detalle: CuadreDetalle, userTotal: number) => {
    const difference = Math.abs(userTotal - detalle.saldo_cierre);
    const tolerance = getTolerance(detalle);
    const okFisico = difference <= tolerance;

    const esperadoBancos = Number(detalle.bancos_teorico ?? 0);
    const userBancos = calculateUserBanks(detalle.moneda_id);
    const diffBancos = Math.abs(userBancos - esperadoBancos);
    const okBancos = diffBancos <= tolerance;

    return okFisico && okBancos;
  };

  // Validar cierres requeridos
  const validarCierresRequeridos = useCallback(async () => {
    if (!selectedPoint) return;

    try {
      const fechaHoy = todayGyeDateOnly(); // YYYY-MM-DD (GYE)
      const validacion =
        await contabilidadDiariaService.validarCierresRequeridos(
          selectedPoint.id,
          fechaHoy
        );

      if (validacion.success && validacion.cierres_requeridos && validacion.estado_cierres) {
        setValidacionCierres(validacion as NonNullable<typeof validacionCierres>);
      } else {
        console.error("Error validando cierres:", validacion.error);
      }
    } catch (error) {
      console.error("Error validando cierres:", error);
    }
  }, [selectedPoint]);

  // Cargar validación de cierres cuando cambie el punto seleccionado
  useEffect(() => {
    if (selectedPoint) {
      validarCierresRequeridos();
    }
  }, [selectedPoint, validarCierresRequeridos]);

  // Obtener datos de cuadre automático (reusable + retry)
  const fetchCuadreData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      console.log("[DailyClose] Iniciando fetchCuadreData...");

      const fechaHoy = todayGyeDateOnly();
      console.log("[DailyClose] Solicitando cuadre con fecha y punto:", {
        fecha: fechaHoy,
        pointId: selectedPoint?.id,
      });

      const data = await cuatreCajaService.getCuadre({
        fecha: fechaHoy,
        pointId: selectedPoint?.id,
      });
      console.log("[DailyClose] Respuesta cuadre-caja data:", data);

      if (data.success && data.data) {
        console.log(`[DailyClose] Cuadre recibido con ${data.data.detalles?.length || 0} detalles`);
        setCuadreData(data.data);

        // Inicializar ajustes del usuario con valores esperados (saldo de cierre)
        const initialAdjustments: {
          [key: string]: { bills: string; coins: string; banks: string; note?: string };
        } = {};
        const initialDenominations: Record<string, DenominationAdjustment> = {};
        if (data.data.detalles && data.data.detalles.length > 0) {
          data.data.detalles.forEach((detalle: CuadreDetalle) => {
            const desglose = hydrateDesgloseDenominaciones(
              detalle.codigo,
              detalle.desglose_denominaciones
            );
            const totals = calcularTotalesDenominaciones(desglose);
            initialDenominations[detalle.moneda_id] = desglose;
            initialAdjustments[detalle.moneda_id] = {
              bills: totals.bills.toFixed(2),
              coins: totals.coins.toFixed(2),
              banks: Number(detalle.bancos_teorico ?? 0).toFixed(2),
              note: "",
            };
          });
        }
        setUserAdjustments(initialAdjustments);
        setDenominationAdjustments(initialDenominations);
        setFetchError(null);
      } else if ((data.data as { mensaje?: string } | undefined)?.mensaje) {
        console.log(
          "[DailyClose] No hay movimientos:",
          (data.data as { mensaje?: string }).mensaje
        );
        setCuadreData({ detalles: [], observaciones: "" });
        setUserAdjustments({});
        setDenominationAdjustments({});
        setFetchError(null);
      } else {
        console.warn("[DailyClose] Respuesta inesperada:", data);
      }
    } catch (error) {
      console.error("[DailyClose] ❌ Error al obtener datos de cuadre:", error);
      const msg = error instanceof Error ? error.message : "No se pudo cargar los datos de cuadre automático.";
      setFetchError(msg);

      // Fallback: si el backend de cuadre falla, intentar detectar "sin movimientos"
      try {
        if (selectedPoint) {
          const fechaHoy = todayGyeDateOnly();
          const valid = await contabilidadDiariaService.validarCierresRequeridos(
            selectedPoint.id,
            fechaHoy
          );
          if (
            valid?.success &&
            typeof valid.conteos?.cambios_divisas === "number" &&
            valid.conteos.cambios_divisas === 0
          ) {
            // Proceder como "sin movimientos de divisas": permitir cierre
            setCuadreData({ detalles: [], observaciones: "" });
            setUserAdjustments({});
            setDenominationAdjustments({});
            setFetchError(null);
            toast({
              title: "Sin movimientos de divisas",
              description:
                "No se pudo obtener el cuadre automático, pero se detecta 0 cambios. Puede realizar el cierre diario sin conteo.",
            });
          }
        }
      } catch (fbErr) {
        console.warn("[DailyClose] Fallback sin movimientos no disponible:", fbErr);
      }
    } finally {
      console.log("[DailyClose] fetchCuadreData finalizado");
      setLoading(false);
    }
  }, [selectedPoint]);

  useEffect(() => {
    if (selectedPoint) {
      fetchCuadreData();
      setTodayClose(null);
    }
  }, [selectedPoint, fetchCuadreData]);

  // Construir y mostrar tarjeta de "Cierre Completado" a partir del cuadre/totales
  const fetchTodayClose = useCallback(async () => {
    try {
      const fechaHoy = todayGyeDateOnly();
      const resp = await cuatreCajaService.getCuadre({
        fecha: fechaHoy,
        pointId: selectedPoint?.id,
      });
      if (resp?.success && resp.data) {
        const tot = isRecord(resp.data.totales) ? resp.data.totales : {};
        const observaciones =
          typeof resp.data.observaciones === "string" ? resp.data.observaciones : null;
        const cierre: CuadreCaja = {
          id: resp.data.cuadre_id || "cuadre-hoy",
          usuario_id: user.id,
          punto_atencion_id: selectedPoint?.id || "",
          fecha: fechaHoy,
          estado: "CERRADO",
          total_cambios: (tot.cambios as CuadreCaja["total_cambios"]) ?? 0,
          total_transferencias_entrada:
            (tot.transferencias_entrada as CuadreCaja["total_transferencias_entrada"]) ?? 0,
          total_transferencias_salida:
            (tot.transferencias_salida as CuadreCaja["total_transferencias_salida"]) ?? 0,
          fecha_cierre: new Date().toISOString(),
          observaciones,
        };
        setTodayClose(cierre);
      } else {
        setTodayClose(null);
      }
    } catch (e) {
      console.warn("No se pudo obtener cierre de hoy:", e);
      setTodayClose(null);
    }
  }, [selectedPoint?.id, user.id]);

  // Si ya existe un cierre para hoy, mostrar tarjeta de "Cierre Completado"
  useEffect(() => {
    const checkTodayClose = async () => {
      if (!selectedPoint) {
        console.log("[DailyClose] No hay punto seleccionado");
        return;
      }
      try {
        const fechaHoy = todayGyeDateOnly();
        console.log(`[DailyClose] Verificando cierre existente para punto ${selectedPoint.id}, fecha ${fechaHoy}`);
        const res = await contabilidadDiariaService.getCierreDiario(
          selectedPoint.id,
          fechaHoy
        );
        console.log("[DailyClose] Respuesta getCierreDiario:", res);
        if (res.success && res.cierre) {
          console.log("[DailyClose] Cierre existente encontrado:", res.cierre);
          await fetchTodayClose();
        } else {
          console.log("[DailyClose] No hay cierre existente para hoy");
          setTodayClose(null);
        }
      } catch (e) {
        // Si falla, no bloquear la vista principal
        console.warn("[DailyClose] Error verificando cierre del día:", e);
        setTodayClose(null);
      }
    };

    checkTodayClose();
  }, [selectedPoint, fetchTodayClose]);

  const performDailyClose = async () => {
    setClosing(true);

    if (!selectedPoint) {
      console.error("❌ Missing selectedPoint for closing");
      toast({ title: "Error", description: "Debe seleccionar un punto de atención", variant: "destructive" });
      setClosing(false);
      return;
    }

    try {
      // 1. Validar saldos solo si hay detalles de divisas
      const tieneDetalles = (cuadreData?.detalles?.length ?? 0) > 0;
      if (tieneDetalles) {
        const incompleteBalances = cuadreData?.detalles?.some(
          (detalle) =>
            userAdjustments[detalle.moneda_id]?.bills === undefined ||
            userAdjustments[detalle.moneda_id]?.bills === "" ||
            userAdjustments[detalle.moneda_id]?.coins === undefined ||
            userAdjustments[detalle.moneda_id]?.coins === "" ||
            userAdjustments[detalle.moneda_id]?.banks === undefined ||
            userAdjustments[detalle.moneda_id]?.banks === ""
        );
        if (incompleteBalances) {
          console.error("❌ Incomplete balances found");
          toast({
            title: "Error",
            description: "Debe completar todos los saldos antes del cierre",
            variant: "destructive",
          });
          setClosing(false);
          return;
        }

        // Validación estricta con tolerancia
        const invalidBalances = cuadreData?.detalles?.filter((detalle) => {
          const { total } = calculateBreakdownTotals(detalle.moneda_id);
          const diff = Math.abs(total - detalle.saldo_cierre);
          const tol = detalle.codigo === "USD" ? 1.0 : 0.01;
          const banks = parseFloat(userAdjustments[detalle.moneda_id]?.banks || "0");
          const banksExpected = Number(detalle.bancos_teorico ?? 0);
          const diffBanks = Math.abs(banks - banksExpected);
          return diff > tol || diffBanks > tol;
        });
        if (invalidBalances.length > 0) {
          const msg = `Los siguientes saldos no cuadran con los movimientos del día:\n\n${invalidBalances
            .map((d) => {
              const { total } = calculateBreakdownTotals(d.moneda_id);
              const banks = parseFloat(userAdjustments[d.moneda_id]?.banks || "0");
              const banksExpected = Number(d.bancos_teorico ?? 0);
              const tolerance = (d.codigo === "USD" ? 1.0 : 0.01).toFixed(2);
              return `${d.codigo}: Físico esperado ${d.saldo_cierre.toFixed(2)}, físico ingresado ${total.toFixed(2)}; Bancos esperado ${banksExpected.toFixed(2)}, bancos ingresado ${banks.toFixed(2)} (tolerancia ±${tolerance})`;
            })
            .join("\n")}\n\n⚠️ Revise el Resumen de Cierre para ver el listado de transacciones del día (cambios y servicios externos) y validar qué ocurrió.`;
          toast({ title: "No cuadra", description: msg, variant: "destructive" });
          setClosing(false);
          return;
        }
      }

      // 2. Preparar detalles para enviar
      const detalles = (cuadreData?.detalles || []).map((detalle) => {
        const totals = calculateBreakdownTotals(detalle.moneda_id);
        const banks = parseFloat(userAdjustments[detalle.moneda_id]?.banks || "0");
        const conteo = totals.total;
        return {
          moneda_id: detalle.moneda_id,
          saldo_apertura: detalle.saldo_apertura,
          saldo_cierre: detalle.saldo_cierre,
          conteo_fisico: conteo,
          bancos_teorico: Number(detalle.bancos_teorico ?? 0),
          conteo_bancos: banks,
          billetes: totals.bills,
          monedas: totals.coins,
          monedas_fisicas: totals.coins,
          ingresos_periodo: detalle.ingresos_periodo || 0,
          egresos_periodo: detalle.egresos_periodo || 0,
          movimientos_periodo: detalle.movimientos_periodo || 0,
          observaciones_detalle: userAdjustments[detalle.moneda_id]?.note || "",
          desglose_denominaciones: [
            ...(denominationAdjustments[detalle.moneda_id]?.bills || []).map((item) => ({
              denominacion: item.denominacion,
              tipo: "BILLETE" as const,
              cantidad: item.cantidad,
            })),
            ...(denominationAdjustments[detalle.moneda_id]?.coins || []).map((item) => ({
              denominacion: item.denominacion,
              tipo: "MONEDA" as const,
              cantidad: item.cantidad,
            })),
          ],
        };
      });

      // 3. Ejecutar cierre
      const token = localStorage.getItem("authToken");
      const fechaHoy = todayGyeDateOnly();
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const endpoint = `${apiUrl}/contabilidad-diaria/${selectedPoint.id}/${fechaHoy}/cerrar`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      let resultado: unknown;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ detalles, observaciones: cuadreData?.observaciones || "" }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        resultado = await response.json();
        const resultRecord = isRecord(resultado) ? resultado : {};
        if (!response.ok || resultRecord.success !== true) {
          const errorText =
            typeof resultRecord.error === "string"
              ? resultRecord.error
              : "Error al realizar el cierre diario";
          throw new Error(errorText);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }

      const resultRecord = isRecord(resultado) ? resultado : {};
      const jornadaFinalizadaResp = resultRecord.jornada_finalizada === true;
      const mensaje = jornadaFinalizadaResp
        ? "✅ El cierre diario se ha completado correctamente y su jornada fue finalizada automáticamente."
        : "✅ El cierre diario se ha completado correctamente.";
      toast({ title: "Cierre realizado", description: mensaje });
      // Marcar flags locales
      if (jornadaFinalizadaResp) {
        setJornadaFinalizada(true);
        setHasActiveJornada(false);
      }
      // Requerimiento: tras cerrar, cerrar sesión y salir a Login
      // Evita llamadas posteriores (como GET /cuadre-caja?fecha) en esta vista
      handleLogout();
      return;
    } catch (error) {
      console.error("💥 Error en performDailyClose:", error);
      const errorMessage = error instanceof Error ? error.message : "Error inesperado";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
      setClosing(false);
    }
  };

  // Confirmación antes de cerrar - primero muestra resumen
  const confirmDailyClose = async () => {
    if (!selectedPoint) return;

    setLoadingResumen(true);
    try {
      const fechaHoy = todayGyeDateOnly();
      const resultado = await contabilidadDiariaService.getResumenCierre(
        selectedPoint.id,
        fechaHoy
      );

      if (resultado.success && resultado.resumen) {
        // Log de diagnóstico para verificar datos recibidos
        console.log("[DailyClose] Resumen recibido:", resultado.resumen);
        console.log("[DailyClose] Primer cambio:", resultado.resumen.transacciones?.cambios_divisas?.[0]);
        console.log("[DailyClose] Balance cambios:", resultado.resumen.balance?.cambios_divisas?.por_moneda);
        
        const normalized = normalizeResumenCierre(resultado.resumen);
        if (!normalized) {
          toast({
            title: "Error",
            description:
              "El servidor devolvió un resumen de cierre inválido. Intente nuevamente.",
            variant: "destructive",
          });
          return;
        }
        setResumenCierre(normalized);
        setShowResumenModal(true);
      } else {
        toast({
          title: "Error",
          description: resultado.error || "No se pudo obtener el resumen de cierre",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error obteniendo resumen:", error);
      toast({
        title: "Error",
        description: "Error al obtener resumen de saldos",
        variant: "destructive",
      });
    } finally {
      setLoadingResumen(false);
    }
  };

  // Proceder con el cierre después de confirmar resumen
  const proceedWithClose = () => {
    setShowResumenModal(false);
    performDailyClose();
  };

  const fmt2 = (n: unknown) => Number(n ?? 0).toFixed(2);

  const printBalance = () => {
    if (!resumenCierre) {
      toast({
        title: "No hay datos",
        description: "No hay datos de resumen para imprimir.",
        variant: "destructive",
      });
      return;
    }

    try {
      const cambios = resumenCierre?.transacciones?.cambios_divisas || [];
      const servicios = resumenCierre?.transacciones?.servicios_externos || [];
      const balanceCambios = resumenCierre.balance?.cambios_divisas?.por_moneda || [];
      const balanceServicios = resumenCierre.balance?.servicios_externos?.por_moneda || [];

      const fmt = (n: unknown) => Number(n ?? 0).toFixed(2);
      const fmtRate = (n: unknown) => Number(n ?? 0).toFixed(3);
      const safe = (s: unknown) => {
        if (s == null) return "";
        const str = String(s);
        // Escapar caracteres HTML para prevenir XSS y problemas de renderizado
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const rowsCambios = cambios
        .map((c) => {
          let hora = "";
          try {
            const fecha = new Date(c.fecha);
            hora = isNaN(fecha.getTime()) ? safe(c.fecha) : fecha.toLocaleTimeString();
          } catch {
            hora = safe(c.fecha);
          }
          const mo = c.moneda_origen;
          const md = c.moneda_destino;
          const tasaB = Number(c.tasa_cambio_billetes || 0) > 0 ? `B ${fmtRate(c.tasa_cambio_billetes)}` : "";
          const tasaM = Number(c.tasa_cambio_monedas || 0) > 0 ? `M ${fmtRate(c.tasa_cambio_monedas)}` : "";
          const tasa = [tasaB, tasaM].filter(Boolean).join(" | ");

          return `<tr>
            <td>${hora}</td>
            <td>${safe(c.numero_recibo) || "—"}</td>
            <td>${safe(c.tipo_operacion)}</td>
            <td>${safe(c.usuario?.nombre || c.usuario?.username) || "—"}</td>
            <td>${safe(mo?.codigo) || "—"} ${safe(mo?.nombre) ? `(${safe(mo?.nombre)})` : ""}</td>
            <td style="text-align:right">${fmt(c.monto_origen)}</td>
            <td>${safe(md?.codigo) || "—"} ${safe(md?.nombre) ? `(${safe(md?.nombre)})` : ""}</td>
            <td style="text-align:right">${fmt(c.monto_destino)}</td>
            <td>${tasa || "—"}</td>
          </tr>`;
        })
        .join("");

      const rowsServicios = servicios
        .map((m) => {
          let hora = "";
          try {
            const fecha = new Date(m.fecha);
            hora = isNaN(fecha.getTime()) ? safe(m.fecha) : fecha.toLocaleTimeString();
          } catch {
            hora = safe(m.fecha);
          }
          return `<tr>
            <td>${hora}</td>
            <td>${safe(m.servicio)}</td>
            <td>${safe(m.tipo_movimiento)}</td>
            <td>${safe(m.usuario?.nombre || m.usuario?.username) || "—"}</td>
            <td>${safe(m.moneda) || "—"}</td>
            <td style="text-align:right">${fmt(m.monto)}</td>
            <td>${safe(m.numero_referencia) || "—"}</td>
          </tr>`;
        })
        .join("");

      const rowsBalanceCambios = balanceCambios
        .map((r) => {
          return `<tr>
            <td>${safe(r.moneda?.codigo) || "—"}</td>
            <td>${safe(r.moneda?.nombre) || ""}</td>
            <td style="text-align:right">${fmt(r.ingresos)}</td>
            <td style="text-align:right">${fmt(r.egresos)}</td>
            <td style="text-align:right;font-weight:bold">${fmt(r.neto)}</td>
          </tr>`;
        })
        .join("");

      const rowsBalanceServicios = balanceServicios
        .map((r) => {
          return `<tr>
            <td>${safe(r.moneda?.codigo) || "—"}</td>
            <td>${safe(r.moneda?.nombre) || ""}</td>
            <td style="text-align:right">${fmt(r.ingresos)}</td>
            <td style="text-align:right">${fmt(r.egresos)}</td>
            <td style="text-align:right;font-weight:bold">${fmt(r.neto)}</td>
          </tr>`;
        })
        .join("");

      const fechaStr = safe(resumenCierre.fecha);
      const puntoStr = safe(resumenCierre.punto_atencion_id);

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Balance diario - ${fechaStr}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; margin: 0; }
    h1, h2 { margin: 0 0 8px 0; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; }
    .muted { color: #555; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fafafa; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .section { margin-top: 18px; }
    .text-right { text-align: right; }
    .no-print { 
      margin-bottom: 12px; 
      padding: 12px; 
      background: #f0f0f0; 
      border-radius: 4px;
    }
    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close {
      background: #6b7280;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-left: 8px;
    }
    @media print { 
      .no-print { display: none !important; } 
      body { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print(); setTimeout(()=>window.close(),500)">🖨️ Imimir / Guardar PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
    <span style="margin-left: 12px; color: #666; font-size: 12px;">
      Si no se abre el diálogo de impresión, use Ctrl+P
    </span>
  </div>

  <h1>Balance diario</h1>
  <div class="muted">Fecha: ${fechaStr} | Punto: ${puntoStr}</div>

  <div class="grid">
    <div class="card">
      <h2>Cambios de divisas</h2>
      <div class="muted">Cantidad: ${cambios.length}</div>
    </div>
    <div class="card">
      <h2>Servicios externos</h2>
      <div class="muted">Cantidad: ${servicios.length}</div>
    </div>
  </div>

  <div class="section">
    <h2>Balance por moneda (Cambios)</h2>
    <table>
      <thead>
        <tr>
          <th>Moneda</th>
          <th>Nombre</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Egresos</th>
          <th style="text-align:right">Neto</th>
        </tr>
      </thead>
      <tbody>
        ${rowsBalanceCambios || "<tr><td colspan='5' style='text-align:center;color:#666'>Sin datos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Balance por moneda (Servicios externos)</h2>
    <table>
      <thead>
        <tr>
          <th>Moneda</th>
          <th>Nombre</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Egresos</th>
          <th style="text-align:right">Neto</th>
        </tr>
      </thead>
      <tbody>
        ${rowsBalanceServicios || "<tr><td colspan='5' style='text-align:center;color:#666'>Sin datos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Cambios (cliente entrega / cliente recibe)</h2>
    <table>
      <thead>
        <tr>
          <th>Hora</th>
          <th>Recibo</th>
          <th>Operación</th>
          <th>Operador</th>
          <th>Moneda entrega</th>
          <th style="text-align:right">Monto</th>
          <th>Moneda recibe</th>
          <th style="text-align:right">Monto</th>
          <th>Tasa</th>
        </tr>
      </thead>
      <tbody>
        ${rowsCambios || "<tr><td colspan='9' style='text-align:center;color:#666'>Sin cambios</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Servicios externos</h2>
    <table>
      <thead>
        <tr>
          <th>Hora</th>
          <th>Servicio</th>
          <th>Tipo</th>
          <th>Operador</th>
          <th>Moneda</th>
          <th style="text-align:right">Monto</th>
          <th>Ref</th>
        </tr>
      </thead>
      <tbody>
        ${rowsServicios || "<tr><td colspan='7' style='text-align:center;color:#666'>Sin movimientos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section muted" style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd;">
    Generado desde el módulo de cierre diario | ${new Date().toLocaleString()}
  </div>

  <script>
    // Auto-focus para permitir Ctrl+P inmediatamente
    window.onload = function() {
      document.body.focus();
    };
    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') window.close();
    });
  </script>
</body>
</html>`;

      // Método 1: Intentar abrir ventana emergente
      const win = window.open("about:blank", "print_balance", "width=1024,height=768,scrollbars=yes,resizable=yes");
      
      if (!win || win.closed || typeof win.closed === 'undefined') {
        // El popup fue bloqueado, usar método alternativo (iframe)
        console.log("[printBalance] Ventana bloqueada, usando iframe");
        
        // Crear iframe oculto para imprimir
        let iframe = document.getElementById("print-iframe") as HTMLIFrameElement | null;
        if (!iframe) {
          iframe = document.createElement("iframe");
          iframe.id = "print-iframe";
          iframe.style.position = "fixed";
          iframe.style.right = "0";
          iframe.style.bottom = "0";
          iframe.style.width = "0";
          iframe.style.height = "0";
          iframe.style.border = "0";
          iframe.style.visibility = "hidden";
          document.body.appendChild(iframe);
        }
        
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(html);
          iframeDoc.close();
          
          // Esperar a que cargue y luego imprimir
          setTimeout(() => {
            try {
              iframe?.contentWindow?.print();
            } catch (e) {
              console.error("Error al imprimir desde iframe:", e);
              toast({
                title: "Error al imprimir",
                description: "No se pudo abrir el diálogo de impresión. Intente nuevamente.",
                variant: "destructive",
              });
            }
          }, 500);
          
          toast({
            title: "Abriendo impresión",
            description: "Si no se abre el diálogo, presione Ctrl+P",
          });
        }
        return;
      }

      // Método 2: Usar ventana emergente (funcionó)
      win.document.open();
      win.document.write(html);
      win.document.close();
      
      // Esperar un momento para que el contenido se renderice
      setTimeout(() => {
        try {
          win.focus();
        } catch (e) {
          console.log("No se pudo hacer focus en la ventana:", e);
        }
      }, 100);

    } catch (error) {
      console.error("[printBalance] Error:", error);
      toast({
        title: "Error al generar impresión",
        description: error instanceof Error ? error.message : "Error inesperado",
        variant: "destructive",
      });
    }
  };

  const generateCloseReport = () => {
    if (!todayClose) return;

    toast({
      title: "Reporte generado",
      description: "El reporte de cierre diario se ha generado",
    });
  };

  const handleLogout = () => {
    // Limpiar datos de autenticación
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    // Limpiar selección y vista activa para forzar selección de punto al reingresar
    localStorage.removeItem("puntoAtencionSeleccionado");
    localStorage.removeItem("pc_selected_point_id");
    localStorage.removeItem("pc_active_view");
    // Forzar selección de punto en el próximo login (solo efecto inmediato)
    try {
      sessionStorage.setItem("pc_force_point_select", "1");
    } catch {
      // noop: sessionStorage may be unavailable
    }
    
    toast({
      title: "Sesión cerrada",
      description: "Ha cerrado sesión exitosamente",
    });

    // Redirigir al login
    try {
      logout();
    } catch {
      // noop: logout errors are non-fatal here
    }
    navigate("/login", { replace: true });
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para realizar el cierre
          </p>
        </div>
      </div>
    );
  }

  if (user.rol !== "OPERADOR") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Solo operadores pueden realizar cierres diarios
          </p>
        </div>
      </div>
    );
  }

  if (hasActiveJornada === false) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Debe tener una jornada activa para realizar el cierre diario
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Inicie su jornada desde "Gestión de Horarios" para continuar
          </p>
        </div>
      </div>
    );
  }

  if (hasActiveJornada === null) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando jornada activa...</p>
        </div>
      </div>
    );
  }

  const cantidadCambiosDetectados =
    validacionCierres?.conteos?.cambios_divisas ??
    getCantidad(cuadreData?.totales?.cambios);
  const cantidadServiciosDetectados =
    validacionCierres?.conteos?.servicios_externos ??
    getCantidad(cuadreData?.totales?.servicios_externos);
  const cantidadTransferenciasEntrada = getCantidad(
    cuadreData?.totales?.transferencias_entrada
  );
  const cantidadTransferenciasSalida = getCantidad(
    cuadreData?.totales?.transferencias_salida
  );
  const movimientosDetectados = [
    cantidadCambiosDetectados > 0
      ? `${cantidadCambiosDetectados} cambio(s) de divisas`
      : null,
    cantidadServiciosDetectados > 0
      ? `${cantidadServiciosDetectados} movimiento(s) de servicios externos`
      : null,
    cantidadTransferenciasEntrada > 0
      ? `${cantidadTransferenciasEntrada} transferencia(s) de entrada`
      : null,
    cantidadTransferenciasSalida > 0
      ? `${cantidadTransferenciasSalida} transferencia(s) de salida`
      : null,
  ].filter(Boolean) as string[];
  const cierreSinDetallePeroConMovimientos =
    (cuadreData?.detalles?.length ?? 0) === 0 && movimientosDetectados.length > 0;
  const resumenMovimientosDetectados = movimientosDetectados.join(", ");
  const textoSinDetalle = cierreSinDetallePeroConMovimientos
    ? `Se detectaron movimientos del día (${resumenMovimientosDetectados}), pero el cuadre automático no devolvió el detalle esperado.`
    : "No se han registrado movimientos hoy";
  const detallesCount = cuadreData?.detalles?.length ?? 0;
  const estadoFormulario = todayClose
    ? "COMPLETADO"
    : loading || loadingResumen || closing
      ? "PROCESANDO"
      : detallesCount > 0
        ? "EN_CONTEO"
        : cierreSinDetallePeroConMovimientos
          ? "CON_ALERTA"
          : "PENDIENTE";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Cierre Diario</h1>
        </div>
        <Badge
          variant={
            estadoFormulario === "COMPLETADO"
              ? "default"
              : estadoFormulario === "CON_ALERTA"
                ? "destructive"
                : "secondary"
          }
        >
          {estadoFormulario === "PENDIENTE" && "Pendiente"}
          {estadoFormulario === "EN_CONTEO" && "En conteo"}
          {estadoFormulario === "PROCESANDO" && "Procesando"}
          {estadoFormulario === "CON_ALERTA" && "Con alerta"}
          {estadoFormulario === "COMPLETADO" && "Completado"}
        </Badge>
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {!todayClose && detallesCount > 0 && (
        <Alert className="bg-blue-50 border-blue-300">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Cuadre listo para revisión</AlertTitle>
          <AlertDescription className="text-blue-700">
            Revise los conteos físicos y bancarios de cada divisa antes de confirmar el cierre.
          </AlertDescription>
        </Alert>
      )}

      {!todayClose && cierreSinDetallePeroConMovimientos && (
        <Alert className="bg-amber-50 border-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Movimientos detectados sin desglose</AlertTitle>
          <AlertDescription className="text-amber-700">
            Hay {resumenMovimientosDetectados} registrados para {selectedPoint?.nombre || "el punto seleccionado"}, pero el cuadre automático no cargó el detalle esperado.
          </AlertDescription>
        </Alert>
      )}

      {!todayClose && detallesCount === 0 && !cierreSinDetallePeroConMovimientos && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sin movimientos del día</AlertTitle>
          <AlertDescription className="text-green-700">
            No se registraron movimientos hoy. Puede proceder con el cierre diario.
          </AlertDescription>
        </Alert>
      )}

      {selectedPoint && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-blue-800">
              <MapPin className="h-5 w-5" />
              <span className="font-medium">Punto de Atención:</span>
              <span>{selectedPoint.nombre}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!todayClose && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Instrucciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>Revise el saldo actual esperado por el sistema para cada divisa.</li>
              <li>Ingrese el conteo físico real en billetes, monedas y bancos.</li>
              <li>Verifique que la diferencia quede dentro de tolerancia antes de cerrar.</li>
              <li>Si detecta faltantes o sobrantes, déjelos registrados en observaciones.</li>
              <li>Confirme el cierre únicamente cuando todo el formulario esté revisado.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* NOTA: El cierre de servicios externos ya NO es necesario como paso separado.
          Los movimientos de servicios externos se incluyen automáticamente en el cierre diario. */}

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Cargando datos de cuadre automático...
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !todayClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuadre de Caja</CardTitle>
            <CardDescription>
              {detallesCount === 0
                ? textoSinDetalle
                : "Revise y ajuste los conteos físicos. Los valores toman como referencia el saldo actual de caja y los movimientos del día."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mostrar totales del día */}
            {cuadreData?.totales && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {getCantidad(cuadreData.totales.cambios)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-purple-700">
                    Servicios Externos
                  </h4>
                  <p className="text-2xl font-bold text-purple-600">
                    {getCantidad(cuadreData.totales.servicios_externos)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {getCantidad(cuadreData.totales.transferencias_entrada)}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {getCantidad(cuadreData.totales.transferencias_salida)}
                  </p>
                </div>
              </div>
            )}

            {detallesCount === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div
                    className={
                      cierreSinDetallePeroConMovimientos
                        ? "bg-amber-50 border border-amber-200 rounded-lg p-6"
                        : "bg-blue-50 border border-blue-200 rounded-lg p-6"
                    }
                  >
                    <h3
                      className={`text-lg font-semibold mb-2 ${
                        cierreSinDetallePeroConMovimientos
                          ? "text-amber-800"
                          : "text-blue-800"
                      }`}
                    >
                      {cierreSinDetallePeroConMovimientos
                        ? "Se detectaron movimientos sin detalle de cuadre"
                        : "✅ Cierre sin Movimientos del Día"}
                    </h3>
                    <p
                      className={`mb-4 ${
                        cierreSinDetallePeroConMovimientos
                          ? "text-amber-700"
                          : "text-blue-700"
                      }`}
                    >
                      {cierreSinDetallePeroConMovimientos
                        ? `Hay ${resumenMovimientosDetectados} registrados para ${selectedPoint?.nombre || "el punto seleccionado"}, pero el cuadre automático no cargó el desglose.`
                        : "No se registraron movimientos hoy, pero puede proceder con el cierre."}
                    </p>
                    <p
                      className={`text-sm ${
                        cierreSinDetallePeroConMovimientos
                          ? "text-amber-600"
                          : "text-blue-600"
                      }`}
                    >
                      {cierreSinDetallePeroConMovimientos
                        ? "Actualice la vista. Si el problema persiste, revise el resumen previo al cierre para confirmar los movimientos del día."
                        : "El cierre incluirá todos los movimientos del día (servicios externos, transferencias, etc.)."}
                    </p>
                  </div>
                </div>

                {/* Botón de cierre para días sin movimientos */}
                <div className="flex flex-wrap gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={fetchCuadreData}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Actualizar
                  </Button>
                  <Button
                    onClick={confirmDailyClose}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                    disabled={loading || closing || !cuadreData}
                  >
                    {closing ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                        Cerrando...
                      </span>
                    ) : (
                      "Realizar Cierre Diario"
                    )}
                  </Button>
                </div>

                <div className="mt-3 text-xs text-gray-600 text-center">
                  {cierreSinDetallePeroConMovimientos
                    ? "El cierre se realizará sin detalles de cuadre de caja aunque sí se detectaron movimientos del día. Revise el resumen antes de confirmar."
                    : "El cierre se realizará sin detalles de cuadre de caja porque no se detectaron movimientos del día."}
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                {(cuadreData?.detalles ?? []).map((detalle) => {
                  const userTotal = calculateUserTotal(detalle.moneda_id);
                  const userBanks = calculateUserBanks(detalle.moneda_id);
                  const isValid = validateBalance(detalle, userTotal);

                  return (
                    <Card
                      key={detalle.moneda_id}
                      className={`${
                        !isValid
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200"
                      }`}
                    >
                      <CardHeader className="bg-gray-50 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-blue-600" />
                            <CardTitle>
                              {detalle.codigo} - {detalle.nombre}
                            </CardTitle>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Saldo esperado</div>
                            <div className="text-xl font-bold">
                              {detalle.simbolo} {detalle.saldo_cierre.toFixed(2)}
                            </div>
                          </div>
                          {!isValid && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ No cuadra
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        {/* Resumen de movimientos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-3">
                              <div className="text-blue-700 font-medium text-xs">
                                Saldo Apertura
                              </div>
                              <div className="text-blue-800 font-bold text-lg">
                                {detalle.simbolo}
                                {detalle.saldo_apertura.toFixed(2)}
                              </div>
                              <div className="text-xs text-blue-600">
                                Dinero al inicio
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-3">
                              <div className="text-green-700 font-medium text-xs">
                                Ingresos (+)
                              </div>
                              <div className="text-green-800 font-bold text-lg">
                                +{detalle.simbolo}
                                {detalle.ingresos_periodo.toFixed(2)}
                              </div>
                              <div className="text-xs text-green-600">
                                Divisas recibidas
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-red-50 border-red-200">
                            <CardContent className="p-3">
                              <div className="text-red-700 font-medium text-xs">
                                Egresos (-)
                              </div>
                              <div className="text-red-800 font-bold text-lg">
                                -{detalle.simbolo}
                                {detalle.egresos_periodo.toFixed(2)}
                              </div>
                              <div className="text-xs text-red-600">
                                Divisas entregadas
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-purple-50 border-purple-200">
                            <CardContent className="p-3">
                              <div className="text-purple-700 font-medium text-xs">
                                Saldo Esperado
                              </div>
                              <div className="text-purple-800 font-bold text-lg">
                                {detalle.simbolo}
                                {detalle.saldo_cierre.toFixed(2)}
                              </div>
                              <div className="text-xs text-purple-600">
                                Lo que debe quedar
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Instrucciones claras */}
                        <Card className="bg-yellow-50 border-yellow-200">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-2">
                              <Banknote className="h-5 w-5 text-yellow-600 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-yellow-800 mb-1">
                                  Instrucciones de Conteo
                                </h4>
                                <p className="text-sm text-yellow-700">
                                  Cuente físicamente el dinero que tiene en caja
                                  y registre los valores. La suma de billetes + monedas 
                                  debe ser exactamente{" "}
                                  <strong>
                                    {detalle.simbolo}
                                    {detalle.saldo_cierre.toFixed(2)}
                                  </strong>.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* ✅ Alerta de validación de desglose */}
                        {(() => {
                          const breakdown = validateBreakdown(detalle.moneda_id);
                          const consistent = isBreakdownConsistent(detalle.moneda_id);
                          
                          if (!consistent) {
                            return (
                              <Alert variant="destructive" className="bg-red-50 border-red-300">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle className="text-red-800">Valores inválidos</AlertTitle>
                                <AlertDescription className="text-red-700">
                                  Los valores de billetes y monedas deben ser números positivos.
                                </AlertDescription>
                              </Alert>
                            );
                          }
                          
                          if (!breakdown.valid && breakdown.difference > 0.01) {
                            return (
                              <Alert className="bg-amber-50 border-amber-300">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Desglose inconsistente</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                  Billetes + Monedas = {detalle.simbolo}{breakdown.breakdownTotal.toFixed(2)}, 
                                  pero el saldo esperado es {detalle.simbolo}{detalle.saldo_cierre.toFixed(2)}. 
                                  Diferencia: {detalle.simbolo}{breakdown.difference.toFixed(2)}.
                                  Ajuste los valores para que cuadren.
                                </AlertDescription>
                              </Alert>
                            );
                          }
                          
                          if (breakdown.valid && breakdown.breakdownTotal > 0) {
                            return (
                              <Alert className="bg-green-50 border-green-300">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800">Desglose correcto</AlertTitle>
                                <AlertDescription className="text-green-700">
                                  Billetes + Monedas = {detalle.simbolo}{breakdown.breakdownTotal.toFixed(2)} ✓
                                </AlertDescription>
                              </Alert>
                            );
                          }
                          
                          return null;
                        })()}

                        {/* Conteo físico del usuario */}
                        <Card className="border-gray-300 overflow-hidden">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Banknote className="h-5 w-5 text-blue-600" />
                              Conteo Físico
                            </CardTitle>
                            <CardDescription>
                              Registre el dinero que tiene físicamente en caja
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-6">
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Banknote className="h-4 w-4" />
                                Billetes
                                <span className="text-sm font-normal text-gray-500">
                                  (Total: {detalle.simbolo} {calculateBreakdownTotals(detalle.moneda_id).bills.toFixed(2)})
                                </span>
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {(denominationAdjustments[detalle.moneda_id]?.bills || []).map((billete) => (
                                  <div key={billete.denominacion} className="space-y-1">
                                    <Label className="text-xs text-gray-500">
                                      {detalle.simbolo}{billete.denominacion}
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="1"
                                      value={billete.cantidad || ""}
                                      onChange={(e) =>
                                        updateDenominationCount(
                                          detalle.moneda_id,
                                          "bills",
                                          billete.denominacion,
                                          e.target.value
                                        )
                                      }
                                      className="text-center"
                                      placeholder="0"
                                    />
                                    <div className="text-xs text-right text-gray-500">
                                      = {detalle.simbolo}
                                      {(billete.denominacion * billete.cantidad).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Coins className="h-4 w-4" />
                                Monedas
                                <span className="text-sm font-normal text-gray-500">
                                  (Total: {detalle.simbolo} {calculateBreakdownTotals(detalle.moneda_id).coins.toFixed(2)})
                                </span>
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {(denominationAdjustments[detalle.moneda_id]?.coins || []).map((moneda) => (
                                  <div key={moneda.denominacion} className="space-y-1">
                                    <Label className="text-xs text-gray-500">
                                      {moneda.denominacion >= 1
                                        ? `${detalle.simbolo}${moneda.denominacion}`
                                        : `${(moneda.denominacion * 100).toFixed(0)}¢`}
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="1"
                                      value={moneda.cantidad || ""}
                                      onChange={(e) =>
                                        updateDenominationCount(
                                          detalle.moneda_id,
                                          "coins",
                                          moneda.denominacion,
                                          e.target.value
                                        )
                                      }
                                      className="text-center"
                                      placeholder="0"
                                    />
                                    <div className="text-xs text-right text-gray-500">
                                      = {detalle.simbolo}
                                      {(moneda.denominacion * moneda.cantidad).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div
                              className={`p-4 rounded-lg ${
                                !isValid
                                  ? "bg-red-50 border border-red-200"
                                  : userTotal === detalle.saldo_cierre
                                    ? "bg-green-50 border border-green-200"
                                    : "bg-gray-50 border"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-sm text-gray-600">Tu conteo total</div>
                                  <div className="text-2xl font-bold">
                                    {detalle.simbolo} {userTotal.toFixed(2)}
                                  </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-gray-400" />
                                <div className="text-right">
                                  <div className="text-sm text-gray-600">Diferencia</div>
                                  <div
                                    className={`text-2xl font-bold ${
                                      userTotal - detalle.saldo_cierre > 0
                                        ? "text-green-600"
                                        : userTotal - detalle.saldo_cierre < 0
                                          ? "text-red-600"
                                          : "text-gray-600"
                                    }`}
                                  >
                                    {userTotal - detalle.saldo_cierre > 0 ? "+" : ""}
                                    {(userTotal - detalle.saldo_cierre).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Observaciones */}
                            <div className="mt-4 space-y-2">
                              <Label className="text-sm font-medium">
                                📝 Observaciones (opcional)
                              </Label>
                              <Textarea
                                rows={2}
                                placeholder="Ej: Diferencia por redondeo, conteo manual, etc."
                                value={
                                  userAdjustments[detalle.moneda_id]?.note || ""
                                }
                                onChange={(e) =>
                                  handleUserAdjustment(
                                    detalle.moneda_id,
                                    "note",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Conteo bancos */}
                        <Card className="border-gray-300 overflow-hidden">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ArrowRight className="h-5 w-5 text-purple-600" />
                              Bancos
                            </CardTitle>
                            <CardDescription>
                              Registre el saldo bancario (transferencias) por moneda
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  🏦 Saldo Bancos Esperado
                                </Label>
                                <div className="h-10 px-3 py-2 border rounded-md flex items-center font-bold text-lg bg-purple-50 border-purple-200 text-purple-800">
                                  {detalle.simbolo}
                                  {Number(detalle.bancos_teorico ?? 0).toFixed(2)}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1">
                                  🏦 Bancos (Ingresado)
                                  <span className="text-xs text-gray-500">
                                    ({detalle.simbolo})
                                  </span>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={
                                    userAdjustments[detalle.moneda_id]?.banks ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleUserAdjustment(
                                      detalle.moneda_id,
                                      "banks",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={!isValid ? "border-red-300" : ""}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  📊 Diff Bancos
                                </Label>
                                <div className="flex items-center gap-2">
                                  <div className="h-10 px-3 py-2 border rounded-md flex items-center font-bold text-lg bg-gray-50 border-gray-200 text-gray-800">
                                    {detalle.simbolo}
                                    {userBanks.toFixed(2)}
                                  </div>
                                  {(() => {
                                    const esperado = Number(detalle.bancos_teorico ?? 0);
                                    const diff = parseFloat((userBanks - esperado).toFixed(2));
                                    const abs = Math.abs(diff);
                                    const tol = getTolerance(detalle);
                                    const within = abs <= tol;
                                    const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
                                    const color = within
                                      ? diff === 0
                                        ? "bg-gray-200 text-gray-800 border-gray-300"
                                        : "bg-green-100 text-green-800 border-green-300"
                                      : "bg-red-100 text-red-800 border-red-300";
                                    const label = `${sign}${abs.toFixed(2)}`;
                                    return (
                                      <Badge
                                        className={`border ${color} whitespace-nowrap`}
                                        variant={within ? "secondary" : "destructive"}
                                        title={`Diferencia bancos vs esperado (tolerancia ±${tol.toFixed(2)})`}
                                      >
                                        Diff: {label}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Sección de validación de cierres */}
                {validacionCierres && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-blue-800">
                        📋 Validación de Cierres Requeridos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2">
                        {/* Servicios Externos */}
                        {validacionCierres.cierres_requeridos
                          .servicios_externos && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm font-medium">
                              Cierre de Servicios Externos
                              <span className="text-xs text-gray-500 ml-1">
                                (
                                {validacionCierres.conteos
                                  ?.servicios_externos || 0}{" "}
                                movimientos)
                              </span>
                            </span>
                            <Badge
                              variant={
                                validacionCierres.estado_cierres
                                  .servicios_externos
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {validacionCierres.estado_cierres
                                .servicios_externos
                                ? "✅ Completado"
                                : "⏳ Pendiente"}
                            </Badge>
                          </div>
                        )}

                        {/* Cambios de Divisas */}
                        {validacionCierres.cierres_requeridos
                          .cambios_divisas && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm font-medium">
                              Cambios de Divisas
                              <span className="text-xs text-gray-500 ml-1">
                                (
                                {validacionCierres.conteos?.cambios_divisas ||
                                  0}{" "}
                                movimientos)
                              </span>
                            </span>
                            <Badge
                              variant={
                                validacionCierres.estado_cierres.cambios_divisas
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {validacionCierres.estado_cierres.cambios_divisas
                                ? "✅ Incluido en cierre diario"
                                : "⏳ Pendiente"}
                            </Badge>
                          </div>
                        )}

                        {/* Cierre Diario */}
                        <div className="flex items-center justify-between p-2 bg-white rounded border">
                          <span className="text-sm font-medium">
                            Cierre Diario
                          </span>
                          <Badge
                            variant={
                              validacionCierres.estado_cierres.cierre_diario
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {validacionCierres.estado_cierres.cierre_diario
                              ? "✅ Completado"
                              : "📝 Por realizar"}
                          </Badge>
                        </div>
                      </div>

                      {/* Estado general */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">
                            Estado General:
                          </span>
                          <Badge
                            variant={
                              validacionCierres.cierres_completos
                                ? "default"
                                : "secondary"
                            }
                          >
                            {validacionCierres.cierres_completos
                              ? "✅ Todos los cierres completos"
                              : "⏳ Cierres pendientes"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={fetchCuadreData}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Actualizar Datos
                  </Button>
                  <Button
                    onClick={confirmDailyClose}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                    disabled={loading || closing || loadingResumen || !cuadreData}
                  >
                    {loadingResumen ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                        Cargando resumen...
                      </span>
                    ) : closing ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                        Cerrando...
                      </span>
                    ) : (
                      "Realizar Cierre Diario"
                    )}
                  </Button>
                </div>

                {/* Sugerencia: accesos rápidos para cuadrar */}
                <div className="mt-3 text-xs text-gray-600 text-center">
                  Si no cuadra, registre un movimiento en Servicios Externos
                  (USD) o agregue el Cambio de Divisa faltante.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cierre Completado</CardTitle>
            <CardDescription>
              Cierre diario realizado el{" "}
              {todayClose.fecha_cierre &&
                new Date(todayClose.fecha_cierre).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Panel de Diagnóstico - Solo visible si hay inconsistencias */}
            {cuadreData && cuadreData.detalles && cuadreData.detalles.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  ⚠️ Atención: Hay datos de cuadre pendientes
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Se detectó que existen {cuadreData.detalles.length} moneda(s) con movimientos 
                  que requieren cuadre, pero el sistema muestra el cierre como completado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("[DailyClose] Forzando reset de todayClose");
                    setTodayClose(null);
                    fetchCuadreData();
                  }}
                >
                  🔄 Recargar Formulario de Cuadre
                </Button>
              </div>
            )}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {getCantidad(todayClose.total_cambios)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {getCantidad(todayClose.total_transferencias_entrada)}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {getCantidad(todayClose.total_transferencias_salida)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <Button
                  onClick={generateCloseReport}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Generar Reporte
                </Button>
                
                {jornadaFinalizada && (
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-orange-600 font-medium">
                      ⚠️ Su jornada ha sido finalizada
                    </p>
                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Cerrar Sesión
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Resumen de Cierre */}
      <Dialog open={showResumenModal} onOpenChange={setShowResumenModal}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              📊 Resumen de Saldos - Cierre Diario
            </DialogTitle>
            <DialogDescription>
              Verifique los saldos antes de confirmar el cierre
            </DialogDescription>
          </DialogHeader>

          {resumenCierre && (
            <div className="space-y-6 py-4">
              {/* Total de Transacciones */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">
                  Total de Transacciones del Día
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {resumenCierre.total_transacciones}
                </p>
              </div>

              {/* Saldos Principales */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
                  💰 Saldos Principales
                </h3>
                <div className="grid gap-3">
                  {resumenCierre.saldos_principales.map((saldo) => (
                    <div
                      key={saldo.moneda_codigo}
                      className={`p-4 rounded-lg border-2 ${
                        saldo.moneda_codigo === "USD"
                          ? "bg-green-50 border-green-300"
                          : saldo.tuvo_movimientos
                          ? "bg-blue-50 border-blue-300"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">
                              {saldo.moneda_codigo}
                            </span>
                            <span className="text-sm text-gray-600">
                              {saldo.moneda_nombre}
                            </span>
                            {saldo.tuvo_movimientos && (
                              <Badge variant="secondary" className="text-xs">
                                Con movimientos
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {saldo.moneda_simbolo}{" "}
                            {saldo.saldo_final.toLocaleString("es-EC", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Servicios Externos */}
              {resumenCierre.servicios_externos.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
                    🏦 Saldos en Servicios Externos
                  </h3>
                  <div className="grid gap-3">
                      {resumenCierre.servicios_externos.map((servicio, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border-2 bg-purple-50 border-purple-300"
                      >
                        <div className="space-y-2">
                          <div className="font-bold text-purple-800">
                            {servicio.servicio_nombre}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {servicio.servicio_tipo}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {servicio.saldos.map((saldo, sidx: number) => (
                              <div
                                key={sidx}
                                className="bg-white p-2 rounded border"
                              >
                                <div className="text-xs text-gray-600">
                                  {saldo.moneda_codigo}
                                </div>
                                <div className="font-semibold">
                                  {saldo.moneda_simbolo}{" "}
                                  {saldo.saldo.toLocaleString("es-EC", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Listado de transacciones del día */}
              {((resumenCierre.transacciones?.cambios_divisas?.length ?? 0) > 0 ||
                (resumenCierre.transacciones?.servicios_externos?.length ?? 0) > 0) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
                    📋 Transacciones del Día (auditoría)
                  </h3>

                  {/* Mini balance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border-2 bg-gray-50 border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Cambios de divisas</div>
                          <div className="text-xs text-gray-600">
                            Cantidad: {resumenCierre.transacciones?.cambios_divisas?.length || 0}
                          </div>
                        </div>
                        <Badge variant="secondary">Cambios</Badge>
                      </div>
                      {(resumenCierre.balance?.cambios_divisas?.por_moneda?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-gray-700 mb-1">
                            Ingresos/Egresos por moneda
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {(resumenCierre.balance?.cambios_divisas?.por_moneda || []).map(
                              (r) => (
                                <div
                                  key={r.moneda?.codigo}
                                  className="flex items-center justify-between text-xs bg-white border rounded px-2 py-1"
                                >
                                  <div className="text-gray-700">
                                    {r.moneda?.codigo}
                                    {r.moneda?.nombre ? ` (${r.moneda.nombre})` : ""}
                                  </div>
                                  <div className="text-gray-800 tabular-nums">
                                    +{fmt2(r.ingresos)} / -{fmt2(r.egresos)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-gray-600 mt-2">
                        Recomendación: revise la columna “Cliente recibe (sale)” para validar el egreso.
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border-2 bg-gray-50 border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Servicios externos</div>
                          <div className="text-xs text-gray-600">
                            Cantidad: {resumenCierre.transacciones?.servicios_externos?.length || 0}
                          </div>
                        </div>
                        <Badge variant="secondary">Servicios</Badge>
                      </div>
                      {(resumenCierre.balance?.servicios_externos?.por_moneda?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-gray-700 mb-1">
                            Ingresos/Egresos por moneda
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {(resumenCierre.balance?.servicios_externos?.por_moneda || []).map(
                              (r) => (
                                <div
                                  key={r.moneda?.codigo}
                                  className="flex items-center justify-between text-xs bg-white border rounded px-2 py-1"
                                >
                                  <div className="text-gray-700">
                                    {r.moneda?.codigo}
                                    {r.moneda?.nombre ? ` (${r.moneda.nombre})` : ""}
                                  </div>
                                  <div className="text-gray-800 tabular-nums">
                                    +{fmt2(r.ingresos)} / -{fmt2(r.egresos)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-gray-600 mt-2">
                        Incluye ingresos/egresos del día por servicio.
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="cambios" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="cambios">
                        Cambios ({resumenCierre.transacciones?.cambios_divisas?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="servicios">
                        Servicios externos ({resumenCierre.transacciones?.servicios_externos?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="cambios" className="mt-3">
                      <div className="rounded-lg border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Hora</TableHead>
                              <TableHead>Recibo</TableHead>
                              <TableHead>Operación</TableHead>
                              <TableHead>Operador</TableHead>
                              <TableHead>Cliente entrega</TableHead>
                              <TableHead>Cliente recibe (sale)</TableHead>
                              <TableHead>Tasa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(resumenCierre.transacciones?.cambios_divisas || []).map((c) => {
                              const d = new Date(c.fecha);
                              const hora = isNaN(d.getTime())
                                ? String(c.fecha)
                                : d.toLocaleTimeString();
                              const mo = c.moneda_origen;
                              const md = c.moneda_destino;
                              const tasaText =
                                (Number(c.tasa_cambio_billetes || 0) > 0
                                  ? `B ${Number(c.tasa_cambio_billetes).toFixed(3)}`
                                  : "") +
                                (Number(c.tasa_cambio_monedas || 0) > 0
                                  ? `${Number(c.tasa_cambio_billetes || 0) > 0 ? " | " : ""}M ${Number(c.tasa_cambio_monedas).toFixed(3)}`
                                  : "");
                              return (
                                <TableRow key={c.id}>
                                  <TableCell className="whitespace-nowrap">{hora}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {c.numero_recibo || "—"}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c.tipo_operacion === "COMPRA" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                      {c.tipo_operacion}
                                    </span>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {c.usuario?.nombre || c.usuario?.username || "—"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {(mo?.codigo || "—") + (mo?.nombre ? ` (${mo.nombre})` : "")} {Number(c.monto_origen || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {(md?.codigo || "—") + (md?.nombre ? ` (${md.nombre})` : "")} {Number(c.monto_destino || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {tasaText || "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Usa este listado para validar diferencias antes de cerrar.
                      </p>
                    </TabsContent>

                    <TabsContent value="servicios" className="mt-3">
                      <div className="rounded-lg border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Hora</TableHead>
                              <TableHead>Servicio</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Operador</TableHead>
                              <TableHead>Moneda</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Ref</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(resumenCierre.transacciones?.servicios_externos || []).map((m) => {
                              const d = new Date(m.fecha);
                              const hora = isNaN(d.getTime())
                                ? String(m.fecha)
                                : d.toLocaleTimeString();
                              return (
                                <TableRow key={m.id}>
                                  <TableCell className="whitespace-nowrap">{hora}</TableCell>
                                  <TableCell className="whitespace-nowrap">{m.servicio}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${m.tipo_movimiento === "INGRESO" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                      {m.tipo_movimiento}
                                    </span>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {m.usuario?.nombre || m.usuario?.username || "—"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">{m.moneda || "—"}</TableCell>
                                  <TableCell className="whitespace-nowrap">{Number(m.monto || 0).toFixed(2)}</TableCell>
                                  <TableCell className="whitespace-nowrap">{m.numero_referencia || "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Incluye ingresos/egresos de servicios externos del día.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={printBalance}
              disabled={closing}
            >
              Imprimir balance
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowResumenModal(false)}
              disabled={closing}
            >
              Cancelar
            </Button>
            <Button
              onClick={proceedWithClose}
              className="bg-green-600 hover:bg-green-700"
              disabled={closing}
            >
              {closing ? "Cerrando..." : "Confirmar Cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog />
    </div>
  );
};

export default DailyClose;
