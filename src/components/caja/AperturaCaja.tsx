import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { scheduleService } from "@/services/scheduleService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

export default function AperturaCaja({ jornadaId: propJornadaId, onAperturaCompletada }: Props) {
  const { user } = useAuth();
  const [jornadaId, setJornadaId] = useState<string>(propJornadaId || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aperturaId, setAperturaId] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>("PENDIENTE");
  const [saldoEsperado, setSaldoEsperado] = useState<any[]>([]);
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
        setSaldoEsperado(result.apertura.saldo_esperado || []);
        setTipoArqueo(result.apertura.tipo_arqueo || null);
        setMonedasExcluidas(result.apertura.monedas_excluidas || []);
        setRequiereArqueoCompleto(result.apertura.requiere_arqueo_completo || false);

        // Inicializar formularios de conteo para cada moneda
        const conteosIniciales: ConteoForm[] = (result.apertura.saldo_esperado || []).map(
          (saldo: any) => {
            // Obtener denominaciones: primero del backend, luego específicas, luego default
            let denominaciones = saldo.denominaciones;
            if (!denominaciones) {
              denominaciones = DENOMINACIONES_POR_MONEDA[saldo.codigo] || DENOMINACIONES_DEFAULT;
            }
            
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
              conteosIniciales[idx].billetes = conteo.billetes.map((b) => ({
                denominacion: b.denominacion,
                cantidad: b.cantidad,
              }));
              conteosIniciales[idx].monedas = conteo.monedas.map((m) => ({
                denominacion: m.denominacion,
                cantidad: m.cantidad,
              }));
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

        if (result.apertura.estado === "ABIERTA") {
          setPuedeAbrir(true);
          toast({
            title: "Apertura ya completada",
            description: "Esta jornada ya fue abierta anteriormente.",
          });
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
      const conteosData: ConteoMoneda[] = conteos.map((c) => ({
        moneda_id: c.moneda_id,
        billetes: c.billetes.filter((b) => b.cantidad > 0),
        monedas: c.monedas.filter((m) => m.cantidad > 0),
        total: calcularTotalConteo(c.billetes, c.monedas),
      }));

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
        serviciosData
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
      setPuedeAbrir(true); // Permitir abrir incluso con diferencias
      setConDiferenciaPendiente(!result.cuadrado);
      setEstado(result.apertura?.estado || "EN_CONTEO");

      toast({
        title: result.cuadrado ? "¡Conteo guardado!" : "Conteo guardado con diferencias",
        description: result.cuadrado 
          ? "Todo cuadrado. Puedes confirmar la apertura."
          : "Hay diferencias registradas. El administrador será notificado. Puedes iniciar a operar.",
      });
    } catch (e) {
      setError("Error al guardar conteo");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const confirmarApertura = async () => {
    try {
      setSaving(true);
      const result = await aperturaCajaService.confirmarApertura(aperturaId!);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setEstado("ABIERTA");
      setPuedeAbrir(true);
      
      if (result.con_diferencia) {
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

  if (estado === "ABIERTA") {
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
                Tu jornada ha sido iniciada correctamente. Puedes comenzar a operar.
              </p>
              {conDiferenciaPendiente && (
                <p className="text-amber-700 mt-2 text-sm">
                  ⚠️ Hay diferencias pendientes de revisión por el administrador.
                </p>
              )}
            </div>
          </div>
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
                  Se muestran solo las divisas que tuvieron movimiento en el último día.
                  Las divisas sin movimiento quedan registradas con su saldo histórico.
                </p>
                {monedasExcluidas.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">
                      Divisas excluidas (sin movimiento):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {monedasExcluidas.map((m) => (
                        <Badge key={m.moneda_id} variant="outline" className="text-xs">
                          {m.codigo}
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
            <li>Valida los saldos de los servicios externos en sus páginas web</li>
            <li>Si hay diferencias, puedes operar igual - quedarán registradas para el admin</li>
            <li>Confirma la apertura para iniciar tu jornada</li>
          </ol>
        </CardContent>
      </Card>

      {/* Formularios de conteo por moneda */}
      {conteos.map((conteo, monedaIdx) => {
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
                    {saldoEsperadoMoneda?.codigo} - {saldoEsperadoMoneda?.nombre}
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
                          Moneda: {servicio.codigo} ({servicio.nombre})
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
            {cuadrado === false 
              ? "Confirmar Apertura (con Diferencias)" 
              : "Confirmar Apertura"}
          </Button>
        )}
      </div>
    </div>
  );
}
