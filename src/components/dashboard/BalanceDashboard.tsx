import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calculator,
  BarChart3,
  AlertTriangle,
  ArrowUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, VistaSaldosPorPunto } from "../../types";
import { saldoInicialService } from "../../services/saldoInicialService";
import { apiService } from "../../services/apiService";
import ContabilidadDiaria from "./ContabilidadDiaria";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** =========================
 *  Props
 *  ========================= */
interface BalanceDashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

type BalanceDashboardTab = "saldos" | "contabilidad";

type BalancePorMoneda = {
  moneda_codigo: string;
  balance: number;
  detalles: {
    cambiosDivisasOrigen: number;
    cambiosDivisasDestino: number;
    serviciosExternosIngresos: number;
    serviciosExternosEgresos: number;
    transferenciasNetas: number;
  };
};

type BalanceCompletoData = {
  actividad: {
    cambiosDivisas: number;
    serviciosExternos: number;
    transferenciasOrigen: number;
    transferenciasDestino: number;
    totalMovimientos: number;
  };
  balancesPorMoneda?: BalancePorMoneda[];
};

const isTab = (v: string): v is BalanceDashboardTab =>
  v === "saldos" || v === "contabilidad";

const extractErrorMessage = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
};

/** =========================
 *  Helpers
 *  ========================= */
const formatMoney = (n: number, symbol = "$") =>
  `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0))}`;

const getStatus = (s: VistaSaldosPorPunto) => {
  if (Number(s.saldo_inicial) === 0) return "Sin configurar";
  if (Number(s.diferencia) > 0) return "Excedente";
  if (Number(s.diferencia) < 0) return "Déficit";
  return "Equilibrado";
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Sin configurar":
      return { variant: "secondary" as const, tone: "text-gray-600" };
    case "Excedente":
      return { variant: "default" as const, tone: "text-green-700" };
    case "Déficit":
      return { variant: "destructive" as const, tone: "text-red-700" };
    case "Equilibrado":
      return { variant: "outline" as const, tone: "text-amber-700" };
    default:
      return { variant: "secondary" as const, tone: "text-gray-600" };
  }
};

const diffIcon = (d: number) =>
  d > 0 ? (
    <TrendingUp className="h-4 w-4 text-green-600" />
  ) : d < 0 ? (
    <TrendingDown className="h-4 w-4 text-red-600" />
  ) : (
    <DollarSign className="h-4 w-4 text-gray-600" />
  );

/** =========================
 *  Component
 *  ========================= */
const BalanceDashboard = ({ user, selectedPoint }: BalanceDashboardProps) => {
  const [saldos, setSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Estado para balance completo
  const [balanceCompleto, setBalanceCompleto] =
    useState<BalanceCompletoData | null>(null);
  const [loadingBalanceCompleto, setLoadingBalanceCompleto] = useState(false);

  // UX: auto-refresh y controles de filtro
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tab, setTab] = useState<BalanceDashboardTab>("saldos");
  const isPrivileged = user.rol === "ADMIN" || user.rol === "SUPER_USUARIO";

  // En roles no privilegiados, forzar pestaña 'saldos'
  useEffect(() => {
    if (!isPrivileged && tab === "contabilidad") {
      setTab("saldos");
    }
  }, [isPrivileged, tab]);

  // Moneda seleccionada: por requerimiento, USD (principal) por defecto
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [onlyNonZeroDiff, setOnlyNonZeroDiff] = useState<boolean>(false);

  /** ===== Fetch ===== */
  const loadSaldos = useCallback(async () => {
    if (!selectedPoint) return;
    setLoading(true);
    try {
      const resp = await saldoInicialService.getVistaSaldosPorPunto({
        pointId: selectedPoint.id,
        reconciliar: true,
      });
      if (resp.error) {
        toast({
          title: "Error",
          description: resp.error,
          variant: "destructive",
        });
        return;
      }
      const items = (resp.saldos || []).filter(
        (s: VistaSaldosPorPunto) => s.punto_atencion_id === selectedPoint.id
      );
      setSaldos(items);
      setLastUpdate(new Date());
    } catch (e: unknown) {
      toast({
        title: "Error",
        description:
          extractErrorMessage(e) ||
          "Error inesperado al cargar los saldos del punto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPoint]);

  /** ===== Fetch Balance Completo ===== */
  const loadBalanceCompleto = useCallback(async () => {
    if (!selectedPoint) return;
    setLoadingBalanceCompleto(true);
    try {
      const data = await apiService.get(
        `/balance-completo/punto/${selectedPoint.id}`
      );
      if (data.success) {
        setBalanceCompleto(data.data);
      } else {
        throw new Error(data.error || "Error al cargar balance completo");
      }
    } catch (e: unknown) {
      toast({
        title: "Error",
        description:
          extractErrorMessage(e) ||
          "Error inesperado al cargar el balance completo.",
        variant: "destructive",
      });
    } finally {
      setLoadingBalanceCompleto(false);
    }
  }, [selectedPoint]);

  /** ===== Auto refresh (30s) + visibilidad ===== */
  useEffect(() => {
    if (!selectedPoint) return;
    loadSaldos();
    loadBalanceCompleto();

    const tick = () => {
      if (autoRefresh && !document.hidden) {
        loadSaldos();
        loadBalanceCompleto();
      }
    };
    const interval = window.setInterval(tick, 30000);

    const onVis = () => {
      if (!document.hidden && autoRefresh) {
        loadSaldos();
        loadBalanceCompleto();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [selectedPoint, autoRefresh, loadSaldos, loadBalanceCompleto]);

  /** ===== Eventos globales ===== */
  useEffect(() => {
    const onExchange = () => {
      loadSaldos();
      loadBalanceCompleto();
    };
    const onTransfer = () => {
      loadSaldos();
      loadBalanceCompleto();
    };
    window.addEventListener("exchangeCompleted", onExchange);
    window.addEventListener("transferApproved", onTransfer);
    return () => {
      window.removeEventListener("exchangeCompleted", onExchange);
      window.removeEventListener("transferApproved", onTransfer);
    };
  }, [loadSaldos, loadBalanceCompleto]);

  /** ===== Opciones de moneda (para selector) ===== */
  const currencyOptions = useMemo(() => {
    const set = new Set<string>();
    saldos.forEach((s) => set.add(s.moneda_codigo));
    const list = Array.from(set);
    // USD primero, luego alfabético
    list.sort((a, b) =>
      a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)
    );
    return list;
  }, [saldos]);

  /** ===== Derivados por filtros ===== */
  const sortedSaldos = useMemo(() => {
    const base = saldos.filter((s) => s.moneda_codigo === selectedCurrency);
    // (Opcional) en el futuro podrías tener múltiples por misma moneda; ordena por símbolo/alfabético si aplica
    return [...base].sort((a, b) =>
      a.moneda_nombre.localeCompare(b.moneda_nombre)
    );
  }, [saldos, selectedCurrency]);

  const filteredSaldos = useMemo(() => {
    if (!onlyNonZeroDiff) return sortedSaldos;
    return sortedSaldos.filter((s) => Number(s.diferencia || 0) !== 0);
  }, [sortedSaldos, onlyNonZeroDiff]);

  const totalDiff = useMemo(
    () => filteredSaldos.reduce((acc, s) => acc + Number(s.diferencia || 0), 0),
    [filteredSaldos]
  );

  /** ===== Guard ===== */
  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para ver los saldos.
          </p>
        </div>
      </div>
    );
  }

  /** ===== UI ===== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Dashboard Operativo
          </h2>
          <div className="flex items-center gap-2 text-gray-600">
            <span>
              {selectedPoint.nombre} • {selectedPoint.ciudad}
            </span>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                • Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Moneda principal por defecto (USD) + selector de divisa */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Moneda</span>
            <Select
              value={selectedCurrency}
              onValueChange={(v) => setSelectedCurrency(v)}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Selecciona divisa" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                    {c === "USD" ? " (principal)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge
            variant={onlyNonZeroDiff ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setOnlyNonZeroDiff((v) => !v)}
            title="Mostrar solo saldos con diferencia ≠ 0"
          >
            ≠ 0
          </Badge>

          <Badge
            variant={autoRefresh ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setAutoRefresh((v) => !v)}
            title="Conmuta auto-actualización (30s)"
          >
            🔄 Auto {autoRefresh ? "ON" : "OFF"}
          </Badge>

          <Button
            onClick={() => {
              loadSaldos();
              loadBalanceCompleto();
            }}
            disabled={loading || loadingBalanceCompleto}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                loading || loadingBalanceCompleto ? "animate-spin" : ""
              }`}
            />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Ir arriba"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="saldos"
        value={tab}
        onValueChange={(v) => {
          if (isTab(v)) setTab(v);
        }}
        className="w-full"
      >
        <TabsList
          className={`grid w-full ${
            isPrivileged ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <TabsTrigger value="saldos" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Saldos por Moneda
          </TabsTrigger>
          {isPrivileged && (
            <TabsTrigger
              value="contabilidad"
              className="flex items-center gap-2"
            >
              <Calculator className="h-4 w-4" />
              Contabilidad Diaria
            </TabsTrigger>
          )}
        </TabsList>

        {/* ================= SALDOS ================= */}
        <TabsContent value="saldos" className="space-y-6">
          {/* Resumen: basado en lo que se ve (moneda seleccionada y filtro) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Moneda seleccionada
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedCurrency}{" "}
                  {selectedCurrency === "USD" ? "• Principal" : ""}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cambia la divisa desde el selector
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Balance General ({selectedCurrency})
                </CardTitle>
                {diffIcon(totalDiff)}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    totalDiff >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {totalDiff >= 0 ? "+" : ""}
                  {formatMoney(Math.abs(totalDiff))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Diferencia total vs inicial (filtrados)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Última Actualización
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {lastUpdate ? lastUpdate.toLocaleTimeString() : "--:--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastUpdate
                    ? lastUpdate.toLocaleDateString()
                    : "No actualizado"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Balance Completo del Punto */}
          {balanceCompleto && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Balance Completo - {selectedPoint.nombre}
                  {loadingBalanceCompleto && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">
                      Cambios de Divisas
                    </p>
                    <p className="text-2xl font-bold text-blue-800">
                      {balanceCompleto.actividad.cambiosDivisas}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">
                      Servicios Externos
                    </p>
                    <p className="text-2xl font-bold text-green-800">
                      {balanceCompleto.actividad.serviciosExternos}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">
                      Transferencias
                    </p>
                    <p className="text-2xl font-bold text-purple-800">
                      {balanceCompleto.actividad.transferenciasOrigen +
                        balanceCompleto.actividad.transferenciasDestino}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 font-medium">
                      Total Movimientos
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {balanceCompleto.actividad.totalMovimientos}
                    </p>
                  </div>
                </div>

                {balanceCompleto.balancesPorMoneda &&
                  balanceCompleto.balancesPorMoneda.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold mb-3">
                        Balance por Moneda
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {balanceCompleto.balancesPorMoneda.map(
                          (balance) => (
                            <div
                              key={balance.moneda_codigo}
                              className="border rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">
                                  {balance.moneda_codigo}
                                </span>
                                <span
                                  className={`font-bold ${
                                    balance.balance >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {balance.balance >= 0 ? "+" : ""}
                                  {formatMoney(balance.balance)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div>
                                  Cambios: -
                                  {formatMoney(
                                    balance.detalles.cambiosDivisasOrigen
                                  )}{" "}
                                  / +
                                  {formatMoney(
                                    balance.detalles.cambiosDivisasDestino
                                  )}
                                </div>
                                <div>
                                  Servicios: +
                                  {formatMoney(
                                    balance.detalles.serviciosExternosIngresos
                                  )}{" "}
                                  / -
                                  {formatMoney(
                                    balance.detalles.serviciosExternosEgresos
                                  )}
                                </div>
                                <div>
                                  Transferencias:{" "}
                                  {formatMoney(
                                    balance.detalles.transferenciasNetas
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Detalle por Moneda (sólo la seleccionada) */}
          {loading && filteredSaldos.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Cargando saldos…</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredSaldos.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                  <p className="text-gray-600 text-base">
                    No hay saldos que coincidan con los filtros.
                  </p>
                  <p className="text-gray-400 text-sm">
                    Revisa la divisa seleccionada o desactiva “≠ 0”.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredSaldos.map((s) => {
                const status = getStatus(s);
                const badge = getStatusBadge(status);
                const diff = Number(s.diferencia || 0);

                return (
                  <Card
                    key={`${s.punto_atencion_id}-${s.moneda_id}`}
                    className="transition-all duration-200 hover:shadow-lg rounded-xl border"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle
                          className="text-sm font-semibold truncate"
                          title={`${s.moneda_codigo} • ${s.moneda_nombre}`}
                        >
                          {s.moneda_codigo} • {s.moneda_nombre}
                        </CardTitle>
                        <Badge variant={badge.variant} className="text-[11px]">
                          {status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border bg-blue-50/60 p-2">
                            <p className="text-[11px] text-blue-700">
                              Saldo Inicial
                            </p>
                            <p className="text-lg font-bold text-blue-900">
                              {formatMoney(
                                Number(s.saldo_inicial || 0),
                                s.moneda_simbolo
                              )}
                            </p>
                          </div>
                          <div className="rounded-md border bg-green-50/60 p-2">
                            <p className="text-[11px] text-green-700">
                              Saldo Actual (Reconciliado)
                            </p>
                            <p className="text-lg font-bold text-green-900">
                              {formatMoney(
                                Number(s.saldo_actual || 0),
                                s.moneda_simbolo
                              )}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rounded-md border p-2 flex items-center justify-between ${
                            diff >= 0 ? "bg-green-50/70" : "bg-red-50/70"
                          }`}
                        >
                          <div>
                            <p
                              className={`text-[11px] font-medium ${
                                diff >= 0 ? "text-green-700" : "text-red-700"
                              }`}
                            >
                              Diferencia
                            </p>
                            <p
                              className={`text-base font-bold ${
                                diff >= 0 ? "text-green-800" : "text-red-800"
                              }`}
                            >
                              {diff >= 0 ? "+" : ""}
                              {formatMoney(Math.abs(diff), s.moneda_simbolo)}
                            </p>
                          </div>
                          {diffIcon(diff)}
                        </div>

                        <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                          Físico: <b>{s.billetes}</b> billetes •{" "}
                          <b>{s.monedas_fisicas}</b> monedas
                        </div>

                        {s.ultima_actualizacion && (
                          <div className="pt-1 text-[11px] text-gray-500">
                            Última actualización:{" "}
                            {new Date(s.ultima_actualizacion).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============== CONTABILIDAD ============== */}
        {isPrivileged && (
          <TabsContent value="contabilidad">
            <ContabilidadDiaria user={user} selectedPoint={selectedPoint} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default BalanceDashboard;
