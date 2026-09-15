import { openingCurrencyName, openingCurrencyVisible } from "@/utils/openingCurrencyDisplay";
import { AddCoinDenomination } from "./AddCoinDenomination";
import React, { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { useAuth } from "@/hooks/useAuth";
import { scheduleService } from "@/services/scheduleService";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Phone,
  Save,
  AlertTriangle,
  Banknote,
  Coins,
  ArrowRight,
  MapPin,
  ExternalLink
} from "lucide-react";
import { aperturaCajaService, ConteoMoneda, DiferenciaMoneda } from "@/services/aperturaCajaService";
import { toast } from "@/hooks/use-toast";

const INCIDENCIA_APERTURA_PREFIX = "[INCIDENCIA_APERTURA]";
const INCIDENCIA_APERTURA_SUFFIX = "[/INCIDENCIA_APERTURA]";
const INCIDENCIA_APERTURA_OPTIONS = [
  { value: "DIFERENCIA_HEREDADA", label: "Diferencia heredada del día anterior" },
  { value: "FALTANTE_ROBO", label: "Faltante por robo o presunto robo" },
  { value: "FALTANTE_PERDIDA", label: "Faltante por pérdida operativa" },
  { value: "TRASLADO_PENDIENTE", label: "Traslado pendiente de registrar" },
  { value: "AJUSTE_PENDIENTE", label: "Ajuste contable pendiente" },
  { value: "OTRO", label: "Otro" },
] as const;

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

interface BilleteInput {
  denominacion: number;
  cantidad: number;
}

interface MonedaInput {
  denominacion: number;
  cantidad: number;
}

interface ConteoForm {
  moneda_id: string;
  codigo: string;
  billetes: BilleteInput[];
  monedas: MonedaInput[];
}

interface ServicioExternoInput {
  servicio: string;
  servicio_nombre: string;
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_sistema: number;
  saldo_validado: number;
  observaciones: string;
}

interface Props {
  jornadaId?: string;
  onAperturaCompletada?: () => void;
  onAperturaActualizada?: () => void;
  monedasObligatorias?: string[];
  bloquearHastaGuardarObligatorias?: boolean;
}

interface IncidenciaAperturaForm {
  motivo: string;
  detalle: string;
  monedas_afectadas: string[];
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calcularTotalConteo(billetes: BilleteInput[], monedas: MonedaInput[]): number {
  const totalBilletes = billetes.reduce((sum, b) => sum + b.denominacion * b.cantidad, 0);
  const totalMonedas = monedas.reduce((sum, m) => sum + m.denominacion * m.cantidad, 0);
  return Math.round((totalBilletes + totalMonedas) * 100) / 100;
}

function mergeDenominacionesGuardadas(
  base: Array<{ denominacion: number; cantidad: number }>,
  guardadas: Array<{ denominacion: number; cantidad: number }> | null | undefined
) {
  const cantidadesPorDenominacion = new Map<number, number>();

  (guardadas || []).forEach((item) => {
    cantidadesPorDenominacion.set(item.denominacion, item.cantidad);
  });

  const combinadas = base.map((item) => ({
    denominacion: item.denominacion,
    cantidad: cantidadesPorDenominacion.get(item.denominacion) ?? item.cantidad,
  }));

  (guardadas || []).forEach((item) => {
    if (!cantidadesPorDenominacion.has(item.denominacion)) {
      return;
    }

    const yaExiste = combinadas.some(
      (actual) => actual.denominacion === item.denominacion
    );

    if (!yaExiste) {
      combinadas.push({
        denominacion: item.denominacion,
        cantidad: item.cantidad,
      });
    }
  });

  return combinadas;
}

function parseIncidenciaApertura(
  observaciones: string | null | undefined
): IncidenciaAperturaForm | null {
  const valor = String(observaciones || "");
  const inicio = valor.indexOf(INCIDENCIA_APERTURA_PREFIX);
  const fin = valor.indexOf(INCIDENCIA_APERTURA_SUFFIX);

  if (inicio === -1 || fin === -1 || fin <= inicio) {
    return null;
  }

  try {
    const payload = JSON.parse(
      valor.slice(inicio + INCIDENCIA_APERTURA_PREFIX.length, fin).trim()
    ) as Partial<IncidenciaAperturaForm>;

    if (
      typeof payload.motivo !== "string" ||
      !payload.motivo.trim() ||
      typeof payload.detalle !== "string" ||
      !payload.detalle.trim()
    ) {
      return null;
    }

    return {
      motivo: payload.motivo.trim(),
      detalle: payload.detalle.trim(),
      monedas_afectadas: Array.isArray(payload.monedas_afectadas)
        ? payload.monedas_afectadas.map((item) => String(item || "").toUpperCase()).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

function getEstadoMonedasObligatorias(
  monedasObligatorias: string[],
  saldoEsperadoActual: Array<{ moneda_id: string; codigo: string }>,
  conteoFisico: Array<{ moneda_id: string; total?: number; billetes?: BilleteInput[]; monedas?: MonedaInput[] }> | null | undefined
) {
  const saldoPorCodigo = new Map(
    saldoEsperadoActual.map((saldo: any) => [saldo.codigo.toUpperCase(), saldo])
  );
  const guardadas = new Set<string>();
  const cuadradas = new Set<string>();
  const descuadradas = new Set<string>();

  (conteoFisico || []).forEach((conteo) => {
    const saldo = saldoEsperadoActual.find((item) => item.moneda_id === conteo.moneda_id) as any;
    const codigo = saldo?.codigo?.toUpperCase();
    if (codigo && monedasObligatorias.includes(codigo)) {
      guardadas.add(codigo);
      const total = conteo.total ?? calcularTotalConteo(conteo.billetes || [], conteo.monedas || []);
      const esperado = Number(saldoPorCodigo.get(codigo)?.cantidad || 0);
      const tolerancia = codigo === "USD" ? 1 : 0.01;
      if (Math.abs(total - esperado) <= tolerancia) {
        cuadradas.add(codigo);
      } else {
        descuadradas.add(codigo);
      }
    }
  });

  return {
    guardadas: Array.from(guardadas),
    cuadradas: Array.from(cuadradas),
    descuadradas: Array.from(descuadradas),
  };
}

export default function AperturaCaja({
  jornadaId: propJornadaId,
  onAperturaCompletada,
  onAperturaActualizada,
  monedasObligatorias: monedasObligatoriasIniciales = ["USD", "EUR"],
  bloquearHastaGuardarObligatorias = false,
}: Props) {
  const { user } = useAuth();
  const [jornadaId, setJornadaId] = useState<string>(propJornadaId || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aperturaId, setAperturaId] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>("PENDIENTE");
  const [saldoEsperado, setSaldoEsperado] = useState<any[]>([]);
  const monedasObligatorias = [...new Set([...monedasObligatoriasIniciales,
    ...saldoEsperado.filter(s => s.obligatoria_inicio).map(s => String(s.codigo).toUpperCase())])];
  const porEtapas = saldoEsperado.some(s => s.apertura_por_etapas);
  const [monedasDelPunto, setMonedasDelPunto] = useState<string[] | null>(null);
  const [mostrarOtrasDivisas, setMostrarOtrasDivisas] = useState(false);
  const nombreDivisa = (codigo: string) => openingCurrencyName(codigo, saldoEsperado);
  const nombresDivisas = (codigos: string[], separador: string) => codigos.map(nombreDivisa).join(separador);
  const visibleEnPunto = (conteo: ConteoForm) => openingCurrencyVisible(
    { ...conteo, cantidad: Number(saldoEsperado.find(s => s.moneda_id === conteo.moneda_id)?.cantidad || 0) },
    monedasDelPunto, monedasObligatorias, monedasContadas, mostrarOtrasDivisas);
  const [monedasContadas, setMonedasContadas] = useState<string[]>([]);
  const [conteos, setConteos] = useState<ConteoForm[]>([]);
  const [diferencias, setDiferencias] = useState<DiferenciaMoneda[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [cuadrado, setCuadrado] = useState<boolean | null>(null);
  const [puedeAbrir, setPuedeAbrir] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puntoAtencion, setPuntoAtencion] = useState<{ id: string; nombre: string; ciudad: string } | null>(null);
  const [serviciosExternos, setServiciosExternos] = useState<ServicioExternoInput[]>([]);
  const [conDiferenciaPendiente, setConDiferenciaPendiente] = useState(false);
  const [tipoArqueo, setTipoArqueo] = useState<"COMPLETO" | "PARCIAL" | null>(null);
  const [monedasExcluidas, setMonedasExcluidas] = useState<Array<{ moneda_id: string; codigo: string; razon: string }>>([]);
  const [requiereArqueoCompleto, setRequiereArqueoCompleto] = useState(false);
  const [monedasObligatoriasGuardadas, setMonedasObligatoriasGuardadas] = useState<string[]>([]);
  const [monedasObligatoriasCuadradas, setMonedasObligatoriasCuadradas] = useState<string[]>([]);
  const [monedasObligatoriasDescuadradas, setMonedasObligatoriasDescuadradas] = useState<string[]>([]);
  const [abrirConIncidencia, setAbrirConIncidencia] = useState(false);
  const [incidenciaMotivo, setIncidenciaMotivo] = useState("");
  const [incidenciaDetalle, setIncidenciaDetalle] = useState("");

  const monedasObligatoriasPendientes = monedasObligatorias.filter(
    (codigo) => !monedasObligatoriasCuadradas.includes(codigo)
  );
  const incidenciaDisponible = monedasObligatoriasDescuadradas.length > 0;
  const incidenciaCompleta =
    abrirConIncidencia && incidenciaMotivo.trim().length > 0 && incidenciaDetalle.trim().length > 0;
  const incidenciaApertura = incidenciaCompleta
    ? {
        motivo: incidenciaMotivo.trim(),
        detalle: incidenciaDetalle.trim(),
        monedas_afectadas: monedasObligatoriasDescuadradas,
      }
    : null;
  const aperturaCompletaPeroBloqueada =
    estado === "ABIERTA" &&
    bloquearHastaGuardarObligatorias &&
    monedasObligatoriasPendientes.length > 0;

  // Obtener jornada activa si no se proporcionó
  useEffect(() => {
    const obtenerJornadaActiva = async () => {
      if (!jornadaId) {
        const result = await scheduleService.getActiveSchedule();
        if (result.schedule && result.schedule.id) {
          setJornadaId(result.schedule.id);
          if (result.schedule.puntoAtencion) {
            setPuntoAtencion({
              id: result.schedule.puntoAtencion.id,
              nombre: result.schedule.puntoAtencion.nombre,
              ciudad: result.schedule.puntoAtencion.ciudad,
            });
          }
        } else {
          setError("No tienes una jornada activa. Inicia tu jornada primero.");
          setLoading(false);
        }
      }
    };
    obtenerJornadaActiva();
  }, []);

  // Iniciar apertura cuando tengamos el jornadaId
  useEffect(() => {
    if (jornadaId) {
      iniciarApertura();
    }
  }, [jornadaId]);

  const iniciarApertura = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await aperturaCajaService.iniciarApertura(jornadaId);

      if (result.error) {
        setError(result.error);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      if (result.apertura) {
        setAperturaId(result.apertura.id);
        setEstado(result.apertura.estado);
        setMonedasContadas((result.apertura.conteo_fisico || []).map(c => c.moneda_id));
          const saldoEsperadoActual = result.apertura.saldo_esperado || [];
          setSaldoEsperado(saldoEsperadoActual);
          setMonedasDelPunto(result.apertura.monedas_del_punto ?? null);
        setTipoArqueo(result.apertura.tipo_arqueo || null);
        setMonedasExcluidas(result.apertura.monedas_excluidas || []);
        setRequiereArqueoCompleto(result.apertura.requiere_arqueo_completo || false);
          const estadoMonedas = getEstadoMonedasObligatorias(
              [...new Set([...monedasObligatoriasIniciales, ...saldoEsperadoActual.filter(s => s.obligatoria_inicio).map(s => s.codigo)])],
              saldoEsperadoActual,
              (result.apertura.conteo_fisico as Array<{ moneda_id: string; total?: number; billetes?: BilleteInput[]; monedas?: MonedaInput[] }>) || []
            );
          setMonedasObligatoriasGuardadas(estadoMonedas.guardadas);
          setMonedasObligatoriasCuadradas(estadoMonedas.cuadradas);
          setMonedasObligatoriasDescuadradas(estadoMonedas.descuadradas);
          const incidenciaGuardada = parseIncidenciaApertura(
            result.apertura.observaciones_operador
          );
          if (incidenciaGuardada) {
            setAbrirConIncidencia(true);
            setIncidenciaMotivo(incidenciaGuardada.motivo);
            setIncidenciaDetalle(incidenciaGuardada.detalle);
          } else {
            setAbrirConIncidencia(false);
            setIncidenciaMotivo("");
            setIncidenciaDetalle("");
          }

        // Inicializar formularios de conteo para cada moneda
        const conteosIniciales: ConteoForm[] = (result.apertura.saldo_esperado || []).map(
          (saldo: any) => {
            // Siempre usar denominaciones hardcoded para garantizar consistencia
            const denominaciones = DENOMINACIONES_POR_MONEDA[saldo.codigo] || DENOMINACIONES_DEFAULT;
            
            return {
              moneda_id: saldo.moneda_id,
              codigo: saldo.codigo,
              billetes: denominaciones.billetes.map((d: number) => ({
                denominacion: d,
                cantidad: 0,
              })),
              monedas: denominaciones.monedas.map((d: number) => ({
                denominacion: d,
                cantidad: 0,
              })),
            };
          }
        );

        // Inicializar servicios externos
        const serviciosIniciales: ServicioExternoInput[] = (result.apertura.saldos_servicios_externos || []).map(
          (s: any) => ({
            servicio: s.servicio,
            servicio_nombre: s.servicio_nombre,
            moneda_id: s.moneda_id,
            codigo: s.codigo,
            nombre: s.nombre,
            simbolo: s.simbolo,
            saldo_sistema: s.cantidad,
            saldo_validado: s.cantidad,
            observaciones: "",
          })
        );
        setServiciosExternos(serviciosIniciales);

        // Si hay conteo previo de servicios externos, cargarlo
        if (result.apertura.conteo_servicios_externos && result.apertura.conteo_servicios_externos.length > 0) {
          result.apertura.conteo_servicios_externos.forEach((conteo: any) => {
            const idx = serviciosIniciales.findIndex(
              (s) => s.servicio === conteo.servicio && s.moneda_id === conteo.moneda_id
            );
            if (idx >= 0) {
              serviciosIniciales[idx].saldo_validado = conteo.saldo_validado || conteo.saldo_sistema;
              serviciosIniciales[idx].observaciones = conteo.observaciones || "";
            }
          });
          setServiciosExternos([...serviciosIniciales]);
        }

        // Si hay conteo previo, cargarlo
        if (result.apertura.conteo_fisico && result.apertura.conteo_fisico.length > 0) {
          result.apertura.conteo_fisico.forEach((conteo: ConteoMoneda) => {
            const idx = conteosIniciales.findIndex((c) => c.moneda_id === conteo.moneda_id);
            if (idx >= 0) {
              conteosIniciales[idx].billetes = mergeDenominacionesGuardadas(
                conteosIniciales[idx].billetes,
                conteo.billetes
              );
              conteosIniciales[idx].monedas = mergeDenominacionesGuardadas(
                conteosIniciales[idx].monedas,
                conteo.monedas
              );
            }
          });
        }

        setConteos(conteosIniciales);

        // Si ya tiene diferencias calculadas
        if (result.apertura.diferencias) {
          setDiferencias(result.apertura.diferencias);
          const hayDiferencias = result.apertura.diferencias.some((d: DiferenciaMoneda) => d.fuera_tolerancia);
          setCuadrado(!hayDiferencias);
          setConDiferenciaPendiente(hayDiferencias);
        }

        if (result.apertura.estado === "ABIERTA" && estadoMonedas.descuadradas.length === 0) {
          setPuedeAbrir(true);
          toast({
            title: "Apertura ya completada",
            description: "Esta jornada ya fue abierta anteriormente.",
          });
        } else if (result.apertura.estado === "ABIERTA") {
          setPuedeAbrir(false);
        }
      }
    } catch (e) {
      setError("Error al iniciar apertura");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateBillete = (monedaIdx: number, denomIdx: number, cantidad: string) => {
    const numCantidad = parseInt(cantidad) || 0;
    setConteos((prev) => {
      const nuevo = [...prev];
      nuevo[monedaIdx].billetes[denomIdx].cantidad = Math.max(0, numCantidad);
      return nuevo;
    });
  };

  const addCoin = (monedaIdx: number, denominacion: number) => {
    setConteos(prev => prev.map((c, i) => i !== monedaIdx || c.monedas.some(m => m.denominacion === denominacion) ? c : {
      ...c, monedas: [...c.monedas, { denominacion, cantidad: 0 }].sort((a, b) => b.denominacion - a.denominacion),
    }));
  };

  const updateMoneda = (monedaIdx: number, denomIdx: number, cantidad: string) => {
    const numCantidad = parseInt(cantidad) || 0;
    setConteos((prev) => {
      const nuevo = [...prev];
      nuevo[monedaIdx].monedas[denomIdx].cantidad = Math.max(0, numCantidad);
      return nuevo;
    });
  };

  const updateServicioExterno = (idx: number, saldo_validado: string) => {
    const numSaldo = parseFloat(saldo_validado) || 0;
    setServiciosExternos((prev) => {
      const nuevo = [...prev];
      nuevo[idx].saldo_validado = numSaldo;
      return nuevo;
    });
  };

  const updateServicioExternoObs = (idx: number, observaciones: string) => {
    setServiciosExternos((prev) => {
      const nuevo = [...prev];
      nuevo[idx].observaciones = observaciones;
      return nuevo;
    });
  };

  const guardarConteo = async () => {
    try {
      setSaving(true);
      setError(null);

      // Preparar datos para enviar
      const conteosData: ConteoMoneda[] = conteos.filter(c => !porEtapas || monedasObligatorias.includes(c.codigo)).map((c) => ({
        moneda_id: c.moneda_id,
        billetes: c.billetes.filter((b) => b.cantidad > 0),
        monedas: c.monedas.filter((m) => m.cantidad > 0),
        total: calcularTotalConteo(c.billetes, c.monedas),
      }));

      const monedasPresentes = new Set(conteos.map((c) => c.codigo.toUpperCase()));
      const monedasPendientes = monedasObligatorias.filter((codigo) => !monedasPresentes.has(codigo));
      if (monedasPendientes.length > 0) {
        setError(`Faltan las monedas obligatorias: ${nombresDivisas(monedasPendientes, ", ")}`);
        toast({
          title: "Apertura incompleta",
          description: `Debes registrar ${nombresDivisas(monedasPendientes, " y ")} en la apertura.`,
          variant: "destructive",
        });
        return;
      }

      const serviciosData = serviciosExternos.map((s) => ({
        servicio: s.servicio,
        servicio_nombre: s.servicio_nombre,
        moneda_id: s.moneda_id,
        codigo: s.codigo,
        nombre: s.nombre,
        simbolo: s.simbolo,
        saldo_sistema: s.saldo_sistema,
        saldo_validado: s.saldo_validado,
        diferencia: s.saldo_validado - s.saldo_sistema,
        observaciones: s.observaciones,
      }));

      const result = await aperturaCajaService.guardarConteo(
        aperturaId!,
        conteosData,
        undefined,
        observaciones,
        serviciosData,
        incidenciaApertura
      );

      if (result.error) {
        setError(result.error);
        toast({
          title: "Error al guardar",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setDiferencias(result.diferencias || []);
      setCuadrado(result.cuadrado);
      setPuedeAbrir(result.puede_abrir);
      setConDiferenciaPendiente(!result.cuadrado);
      setEstado(result.apertura?.estado || "EN_CONTEO");
      setMonedasObligatoriasGuardadas(result.monedas_obligatorias_guardadas || monedasObligatorias);
      setMonedasObligatoriasCuadradas(result.monedas_obligatorias_cuadradas || []);
      setMonedasObligatoriasDescuadradas(result.monedas_obligatorias_descuadradas || []);
      onAperturaActualizada?.();

      toast({
        title:
          result.puede_abrir_con_incidencia
            ? "Incidencia registrada"
            : result.puede_abrir
            ? result.cuadrado
              ? "¡Conteo guardado!"
              : "Conteo guardado con diferencias"
            : "dólares estadounidenses y euros siguen descuadrados",
        description: result.message || "Revisa el conteo obligatorio antes de continuar.",
      });
    } catch (e) {
      setError("Error al guardar conteo");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const guardarPendiente = async (conteo: ConteoForm) => {
    setSaving(true);
    try {
      const esperado = saldoEsperado.find(s => s.moneda_id === conteo.moneda_id);
      await apiService.post("/apertura-caja/conteo-pendiente", {
        apertura_id: aperturaId, moneda_id: conteo.moneda_id,
        billetes: conteo.billetes, monedas: conteo.monedas, saldo_esperado: Number(esperado.cantidad),
      });
      await iniciarApertura();
      onAperturaActualizada?.();
      toast({ title: `${nombreDivisa(conteo.codigo)}: conteo guardado` });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "Revisa el conteo", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const confirmarApertura = async () => {
    try {
      setSaving(true);
      const result = await aperturaCajaService.confirmarApertura(
        aperturaId!,
        incidenciaApertura
      );

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setEstado("ABIERTA");
      await iniciarApertura();
      setPuedeAbrir(true);
      setConDiferenciaPendiente(Boolean(result.apertura_abierta_con_incidencia) || cuadrado === false);
      onAperturaActualizada?.();
      
      if (result.apertura_abierta_con_incidencia) {
        toast({
          title: "Apertura confirmada con incidencia",
          description: result.message || "La novedad quedó registrada para revisión del administrador.",
        });
      } else if (result.con_diferencia) {
        toast({
          title: "Apertura confirmada con diferencias",
          description: "La novedad ha sido registrada para revisión del administrador. Puedes iniciar a operar.",
        });
      } else {
        toast({
          title: "Apertura completada",
          description: "Tu jornada ha sido iniciada correctamente.",
        });
      }

      if (onAperturaCompletada) {
        onAperturaCompletada();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const abrirVideollamada = () => {
    const meetUrl = `https://meet.google.com/new`;
    window.open(meetUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Cargando...</span>
      </div>
    );
  }

  if (estado === "ABIERTA" && !aperturaCompletaPeroBloqueada) {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">
                Apertura Completada
              </h3>
              <p className="text-green-700">
                Puedes operar con las divisas verificadas. Completa las pendientes antes de utilizarlas.
              </p>
              {conDiferenciaPendiente && (
                <p className="text-amber-700 mt-2 text-sm">
                  ⚠️ Hay diferencias pendientes de revisión por el administrador.
                </p>
              )}
            </div>
          </div>
          {porEtapas && <Button type="button" variant="outline" className="mt-4" disabled={saving}
            onClick={() => setMostrarOtrasDivisas(value => !value)}>
            {mostrarOtrasDivisas ? "Mostrar solo divisas del punto" : "Contar una divisa recibida por primera vez"}
          </Button>}
          {porEtapas && conteos.map((c, monedaIdx) => monedasContadas.includes(c.moneda_id) || !visibleEnPunto(c) ? null : (
            <div key={c.moneda_id} className="mt-4 rounded border bg-white p-4">
              <h4 className="font-semibold">{nombreDivisa(c.codigo)}: pendiente de conteo</h4>
              <p>Saldo esperado: {formatMoney(Number(saldoEsperado.find(s => s.moneda_id === c.moneda_id)?.cantidad || 0))}</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {c.billetes.map((b, i) => <label key={`b${b.denominacion}`} className="text-sm">Billetes de {b.denominacion}
                  <Input type="number" min="0" step="1" value={b.cantidad} disabled={saving} onChange={e => updateBillete(monedaIdx, i, e.target.value)} />
                </label>)}
                {c.monedas.map((m, i) => <label key={`m${m.denominacion}`} className="text-sm">Monedas de {m.denominacion}
                  <Input type="number" min="0" step="1" value={m.cantidad} disabled={saving} onChange={e => updateMoneda(monedaIdx, i, e.target.value)} />
                </label>)}
              </div>
              <AddCoinDenomination codigo={nombreDivisa(c.codigo)} existing={c.monedas.map(m => m.denominacion)} disabled={saving} onAdd={d => addCoin(monedaIdx, d)} />
              <p className="my-2">Total contado: {formatMoney(calcularTotalConteo(c.billetes, c.monedas))}</p>
              <Button disabled={saving} onClick={() => guardarPendiente(c)}>Confirmar conteo de {nombreDivisa(c.codigo)}</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Apertura de Caja</h1>
        </div>
        <Badge
          variant={
            estado === "CUADRADO"
              ? "default"
              : estado === "CON_DIFERENCIA"
              ? "destructive"
              : "secondary"
          }
        >
          {estado === "EN_CONTEO" && "En conteo"}
          {estado === "CUADRADO" && "Cuadrado"}
          {estado === "CON_DIFERENCIA" && "Con diferencia"}
          {estado === "PENDIENTE" && "Pendiente"}
        </Badge>
      </div>

      {aperturaCompletaPeroBloqueada && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Correccion obligatoria antes de operar</AlertTitle>
          <AlertDescription>
            Esta apertura quedo marcada como completada, pero dólares estadounidenses y euros siguen descuadrados.
            Debes corregir y guardar nuevamente el conteo de {nombresDivisas(monedasObligatoriasPendientes, " y ")}.
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cuadrado === true && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">¡Todo cuadrado!</AlertTitle>
          <AlertDescription className="text-green-700">
            Tu conteo físico coincide con el saldo esperado. Puedes confirmar la apertura.
          </AlertDescription>
        </Alert>
      )}

      {cuadrado === false && (
        <Alert variant="destructive" className="bg-red-50 border-red-300">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Diferencias detectadas</AlertTitle>
          <AlertDescription className="text-red-700">
            Hay diferencias entre tu conteo físico y el saldo esperado. 
            Puedes confirmar la apertura y operar normalmente. La novedad quedará registrada para revisión del administrador.
          </AlertDescription>
        </Alert>
      )}

      {incidenciaDisponible && (
        <Alert className="bg-orange-50 border-orange-300">
          <AlertTriangle className="h-4 w-4 text-orange-700" />
          <AlertTitle className="text-orange-900">Apertura con incidencia disponible</AlertTitle>
          <AlertDescription className="text-orange-800">
            Si el faltante o sobrante de {nombresDivisas(monedasObligatoriasDescuadradas, " y ")} es real,
            puedes registrar la incidencia, guardar el conteo y confirmar la apertura para seguir operando.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="bg-amber-50 border-amber-300">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">Divisas obligatorias al inicio</AlertTitle>
        <AlertDescription className="text-amber-800 space-y-2">
          <p>
            Debes dejar cuadrados {nombresDivisas(monedasObligatorias, " y ")} para habilitar la operación.
            {bloquearHastaGuardarObligatorias
              ? " Mientras no lo hagas, seguirás bloqueado en esta pantalla."
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {monedasObligatorias.map((codigo) => {
              const guardada = monedasObligatoriasGuardadas.includes(codigo);
              const cuadrada = monedasObligatoriasCuadradas.includes(codigo);
              return (
                <Badge
                  key={codigo}
                  variant={cuadrada ? "default" : "outline"}
                  className={
                    cuadrada
                      ? "bg-green-600 text-white"
                      : guardada
                      ? "border-red-400 text-red-900"
                      : "border-amber-400 text-amber-900"
                  }
                >
                  {codigo} {cuadrada ? "cuadrado" : guardada ? "descuadrado" : "pendiente"}
                </Badge>
              );
            })}
          </div>
          {monedasObligatoriasPendientes.length > 0 && (
            <p className="text-sm font-medium">
              Debes cuadrar: {nombresDivisas(monedasObligatoriasPendientes, ", ")}
            </p>
          )}
        </AlertDescription>
      </Alert>

      {/* Info del punto de atención */}
      {puntoAtencion && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-blue-800">
              <MapPin className="h-5 w-5" />
              <span className="font-medium">Punto de Atención:</span>
              <span>{puntoAtencion.nombre}</span>
              <span className="text-blue-600">({puntoAtencion.ciudad})</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner de tipo de arqueo */}
      {tipoArqueo && (
        <Card className={tipoArqueo === "COMPLETO" ? "border-blue-300 bg-blue-50" : "border-amber-300 bg-amber-50"}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {tipoArqueo === "COMPLETO" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base text-blue-800">Arqueo Completo Requerido</CardTitle>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base text-amber-800">Arqueo Parcial</CardTitle>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {tipoArqueo === "COMPLETO" ? (
              <p className="text-sm text-blue-700">
                Este es el <strong>primer arqueo completo</strong> del punto. Debes contar <strong>todas las divisas</strong>.
                Este registro servirá como base para auditorías futuras.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-amber-700">
                  Cuenta dólares estadounidenses, euros y las divisas con movimientos de efectivo desde la última jornada del punto.
                  Las demás quedan pendientes; podrás contarlas después de confirmar la apertura.
                </p>
                {monedasExcluidas.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">
                      Divisas excluidas (sin movimiento):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {monedasExcluidas.map((m) => (
                        <Badge key={m.moneda_id} variant="outline" className="text-xs">
                          {nombreDivisa(m.codigo)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instrucciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>Cuenta físicamente todo el efectivo que tienes en caja</li>
            <li>Ingresa la cantidad de billetes y monedas por denominación</li>
            <li>Cuenta {nombresDivisas(monedasObligatorias, ", ")} y confirma la apertura. Las otras divisas se cuentan después, antes de utilizarlas.</li>
            <li>Valida los saldos de los servicios externos en sus páginas web</li>
            <li>Guarda el conteo para registrar los cuadres obligatorios</li>
            <li>Confirma la apertura para iniciar tu jornada y habilitar operaciones</li>
          </ol>
        </CardContent>
      </Card>

      {/* Formularios de conteo por moneda */}
      {conteos.map((conteo, monedaIdx) => {
        if (porEtapas && !monedasObligatorias.includes(conteo.codigo)) return null;
        const saldoEsperadoMoneda = saldoEsperado.find(
          (s) => s.moneda_id === conteo.moneda_id
        );
        const totalConteo = calcularTotalConteo(conteo.billetes, conteo.monedas);
        const esperado = saldoEsperadoMoneda?.cantidad || 0;
        const diferencia = Math.round((totalConteo - esperado) * 100) / 100;
        const diferenciaInfo = diferencias.find(
          (d) => d.moneda_id === conteo.moneda_id
        );

        return (
          <Card key={conteo.moneda_id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-blue-600" />
                  <CardTitle>
                    {saldoEsperadoMoneda?.nombre}
                    {monedasObligatorias.includes(String(saldoEsperadoMoneda?.codigo || "").toUpperCase()) && (
                      <Badge variant="outline" className="ml-2 border-amber-400 text-amber-900">
                        Obligatoria
                      </Badge>
                    )}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Saldo esperado</div>
                  <div className="text-xl font-bold">
                    {saldoEsperadoMoneda?.simbolo} {formatMoney(esperado)}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Billetes */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Billetes
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {conteo.billetes.map((billete, idx) => (
                    <div key={billete.denominacion} className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        ${billete.denominacion}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={billete.cantidad || ""}
                        onChange={(e) =>
                          updateBillete(monedaIdx, idx, e.target.value)
                        }
                        className="text-center"
                        placeholder="0"
                        disabled={saving}
                      />
                      <div className="text-xs text-right text-gray-500">
                        = ${formatMoney(billete.denominacion * billete.cantidad)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Monedas */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Monedas
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {conteo.monedas.map((moneda, idx) => (
                    <div key={moneda.denominacion} className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {moneda.denominacion >= 1
                          ? `$${moneda.denominacion}`
                          : `${(moneda.denominacion * 100).toFixed(0)}¢`}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={moneda.cantidad || ""}
                        onChange={(e) =>
                          updateMoneda(monedaIdx, idx, e.target.value)
                        }
                        className="text-center"
                        placeholder="0"
                        disabled={saving}
                      />
                      <div className="text-xs text-right text-gray-500">
                        = ${formatMoney(moneda.denominacion * moneda.cantidad)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <AddCoinDenomination codigo={nombreDivisa(conteo.codigo)} existing={conteo.monedas.map(m => m.denominacion)} disabled={saving} onAdd={d => addCoin(monedaIdx, d)} />

              {/* Resumen de esta moneda */}
              <div
                className={`p-4 rounded-lg ${
                  diferenciaInfo?.fuera_tolerancia
                    ? "bg-red-50 border border-red-200"
                    : totalConteo === esperado
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-600">Tu conteo total</div>
                    <div className="text-2xl font-bold">
                      {saldoEsperadoMoneda?.simbolo} {formatMoney(totalConteo)}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Diferencia</div>
                    <div
                      className={`text-2xl font-bold ${
                        diferencia > 0
                          ? "text-green-600"
                          : diferencia < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {diferencia > 0 ? "+" : ""}
                      {formatMoney(diferencia)}
                    </div>
                  </div>
                </div>
                {diferenciaInfo?.fuera_tolerancia && (
                  <div className="mt-2 text-sm text-red-600 font-medium">
                    ⚠️ Fuera de tolerancia - Se notificará al administrador
                  </div>
                )}
                {monedasObligatoriasDescuadradas.includes(String(saldoEsperadoMoneda?.codigo || "").toUpperCase()) && (
                  <div className="mt-2 text-sm text-red-700 font-medium">
                    Esta divisa obligatoria debe quedar cuadrada antes de confirmar la apertura.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Servicios Externos */}
      {serviciosExternos.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-purple-50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-purple-600" />
                <CardTitle>Servicios Externos - Validación de Saldos</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Valida los saldos en las páginas web de cada servicio y registra el saldo real.
            </p>
            <div className="space-y-4">
              {serviciosExternos.map((servicio, idx) => {
                const diferencia = servicio.saldo_validado - servicio.saldo_sistema;
                return (
                  <div key={`${servicio.servicio}-${servicio.moneda_id}`} className="border rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {servicio.servicio_nombre}
                        </div>
                        <div className="text-sm text-gray-500">
                          Moneda: {servicio.nombre}
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Saldo sistema</div>
                          <div className="font-medium">
                            {servicio.simbolo} {formatMoney(servicio.saldo_sistema)}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 hidden md:block" />
                        <div>
                          <Label className="text-xs text-gray-500">Saldo validado</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={servicio.saldo_validado}
                            onChange={(e) => updateServicioExterno(idx, e.target.value)}
                            className="w-32 text-right"
                            disabled={saving}
                          />
                        </div>
                        <div className={`text-right min-w-[80px] ${
                          diferencia !== 0 ? (diferencia > 0 ? "text-green-600" : "text-red-600") : ""
                        }`}>
                          <div className="text-xs text-gray-500">Diferencia</div>
                          <div className="font-medium">
                            {diferencia > 0 ? "+" : ""}{formatMoney(diferencia)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs text-gray-500">Observaciones (opcional)</Label>
                      <Textarea
                        value={servicio.observaciones}
                        onChange={(e) => updateServicioExternoObs(idx, e.target.value)}
                        placeholder="Ej: Saldo validado en página web del servicio..."
                        rows={1}
                        disabled={saving}
                        className="text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observaciones generales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observaciones Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Añade cualquier observación sobre el conteo..."
            rows={3}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {incidenciaDisponible && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-orange-900">
              Registro de Incidencia de Apertura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-white p-3">
              <Checkbox
                checked={abrirConIncidencia}
                onCheckedChange={(checked) => setAbrirConIncidencia(Boolean(checked))}
                disabled={saving}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-orange-900">
                  Permitir apertura con incidencia registrada
                </Label>
                <p className="text-sm text-orange-800">
                  Usa esta opción solo si el faltante o sobrante es real y el punto debe seguir operando.
                </p>
              </div>
            </div>

            {abrirConIncidencia && (
              <>
                <div className="space-y-2">
                  <Label>Motivo de la incidencia</Label>
                  <Select value={incidenciaMotivo} onValueChange={setIncidenciaMotivo}>
                    <SelectTrigger disabled={saving}>
                      <SelectValue placeholder="Seleccione el motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENCIA_APERTURA_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Detalle obligatorio</Label>
                  <Textarea
                    value={incidenciaDetalle}
                    onChange={(e) => setIncidenciaDetalle(e.target.value)}
                    placeholder="Describe qué pasó, monto faltante/sobrante, soporte o acción inmediata realizada..."
                    rows={4}
                    disabled={saving}
                  />
                </div>

                <div className="rounded-lg border border-orange-200 bg-white p-3 text-sm text-orange-900">
                  Monedas afectadas: {nombresDivisas(monedasObligatoriasDescuadradas, ", ")}
                </div>

                {!incidenciaCompleta && (
                  <p className="text-sm font-medium text-red-700">
                    Para habilitar la confirmación con incidencia debes seleccionar un motivo y completar el detalle.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          variant="outline"
          onClick={guardarConteo}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Conteo
        </Button>

        {cuadrado === false && (
          <Button
            variant="secondary"
            onClick={abrirVideollamada}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Llamar al Administrador
          </Button>
        )}

        {puedeAbrir && (
          <Button
            onClick={confirmarApertura}
            disabled={saving}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {abrirConIncidencia && incidenciaCompleta
              ? "Confirmar Apertura con Incidencia"
              : cuadrado === false 
              ? "Confirmar Apertura (con Diferencias)" 
              : "Confirmar Apertura"}
          </Button>
        )}
        {!puedeAbrir && monedasObligatoriasPendientes.length > 0 && (
          <div className="w-full text-right text-sm text-red-700 font-medium">
            {abrirConIncidencia && incidenciaCompleta
              ? `Guarda nuevamente el conteo para registrar la incidencia de ${nombresDivisas(monedasObligatoriasPendientes, " y ")} y habilitar la confirmación.`
              : `No puedes confirmar la apertura hasta cuadrar ${nombresDivisas(monedasObligatoriasPendientes, " y ")}.`}
          </div>
        )}
      </div>
    </div>
  );
}
