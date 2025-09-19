import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { User, PuntoAtencion, SaldoConsolidado } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { useContabilidadAdmin } from "@/hooks/useContabilidadAdmin";
import { Loading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SaldosDivisasEnTiempoRealProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  className?: string;
  isAdminView?: boolean;
  compact?: boolean;
}

type AnySaldo = {
  moneda_id: string;
  moneda_codigo: string;
  saldo: number;
  punto_id?: string;
  punto_nombre?: string;
};

export const SaldosDivisasEnTiempoReal = ({
  user,
  selectedPoint,
  className = "",
  isAdminView = false,
  compact = true, // por defecto compacto
}: SaldosDivisasEnTiempoRealProps) => {
  // Hooks de datos
  const contabilidadNormal = useContabilidadDivisas({ user, selectedPoint });
  const contabilidadAdmin = useContabilidadAdmin({ user });

  const { saldos, isLoading, error, refresh } = isAdminView
    ? {
        saldos: contabilidadAdmin.saldosConsolidados,
        isLoading: contabilidadAdmin.isLoading,
        error: contabilidadAdmin.error,
        refresh: contabilidadAdmin.refresh,
      }
    : contabilidadNormal;

  // Estado UI
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [selectedPointId, setSelectedPointId] = useState<string>("ALL");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("ALL");

  // Opciones para filtros (admin)
  const pointOptions = useMemo(() => {
    if (!isAdminView) return [] as { id: string; nombre: string }[];
    const map = new Map<string, string>();
    (saldos as SaldoConsolidado[]).forEach((s: any) => {
      if (s.punto_id && s.punto_nombre) map.set(s.punto_id, s.punto_nombre);
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [saldos, isAdminView]);

  const currencyOptions = useMemo(() => {
    const map = new Map<string, string>();
    (saldos as AnySaldo[]).forEach((s) =>
      map.set(s.moneda_id, s.moneda_codigo)
    );
    return Array.from(map.entries())
      .map(([id, codigo]) => ({ id, codigo }))
      .sort((a, b) =>
        a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
      );
  }, [saldos]);

  // Filtro aplicado
  const filteredSaldos = useMemo(() => {
    let list = saldos as AnySaldo[];
    if (isAdminView && selectedPointId !== "ALL") {
      list = list.filter((s) => s.punto_id === selectedPointId);
    }
    if (selectedCurrencyId !== "ALL") {
      list = list.filter((s) => s.moneda_id === selectedCurrencyId);
    }
    // Orden: USD primero; luego alfabético de código
    return [...list].sort((a, b) => {
      if (a.moneda_codigo === "USD" && b.moneda_codigo !== "USD") return -1;
      if (b.moneda_codigo === "USD" && a.moneda_codigo !== "USD") return 1;
      return a.moneda_codigo.localeCompare(b.moneda_codigo);
    });
  }, [saldos, isAdminView, selectedPointId, selectedCurrencyId]);

  // Resumen por divisa
  const resumenPorDivisa = useMemo(() => {
    const map = new Map<string, number>();
    filteredSaldos.forEach((s) =>
      map.set(s.moneda_codigo, (map.get(s.moneda_codigo) || 0) + s.saldo)
    );
    return Array.from(map.entries())
      .map(([codigo, total]) => ({ codigo, total }))
      .sort((a, b) =>
        a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
      );
  }, [filteredSaldos]);

  // Auto-refresh inteligente
  useEffect(() => {
    let interval: number | undefined;
    const run = () => autoRefresh && !document.hidden && refresh();
    if (autoRefresh) interval = window.setInterval(run, 30000);
    const onVis = () => {
      if (!document.hidden && autoRefresh) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [autoRefresh, refresh]);

  const formatCurrency = (amount: number, codigo: string) => {
    if (codigo === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    }
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getSaldoStatus = (saldo: number) => {
    if (saldo <= 0)
      return { tone: "red", text: "Sin saldo", Icon: AlertTriangle };
    if (saldo < 1000)
      return { tone: "yellow", text: "Saldo bajo", Icon: TrendingDown };
    return { tone: "green", text: "Saldo normal", Icon: TrendingUp };
  };

  if (!selectedPoint && !isAdminView) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Seleccione un punto de atención para ver los saldos
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            {isAdminView
              ? "Saldos de Divisas - Contabilidad General"
              : `Saldos de Divisas - ${selectedPoint?.nombre}`}
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {isAdminView && (
              <div className="flex items-center gap-2">
                <div className="w-56">
                  <Select
                    value={selectedPointId}
                    onValueChange={setSelectedPointId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por punto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los puntos</SelectItem>
                      {pointOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select
                    value={selectedCurrencyId}
                    onValueChange={setSelectedCurrencyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por divisa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas las divisas</SelectItem>
                      {currencyOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-8"
              title="Actualizar"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>

            <Badge
              variant={autoRefresh ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Badge>

            {compact && (
              <Badge
                variant={expanded ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Detalle" : "Resumen"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (saldos?.length ?? 0) === 0 ? (
          <Loading text="Cargando saldos..." className="py-8" />
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : (filteredSaldos?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay saldos para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen por divisa (chips/cards pequeñas) */}
            {resumenPorDivisa.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {resumenPorDivisa.map((t) => (
                  <div
                    key={t.codigo}
                    className="p-2 border rounded-md bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        {t.codigo}
                      </span>
                      <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="mt-1 text-[13px] font-semibold">
                      {formatCurrency(t.total, t.codigo)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Si compacto y no expandido, termina aquí */}
            {compact && !expanded ? (
              <div className="text-right text-xs text-gray-500">
                Última actualización: {new Date().toLocaleTimeString()}
              </div>
            ) : (
              <>
                {/* Tarjetas pequeñas por saldo (grid responsivo) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredSaldos.map((saldo) => {
                    const { tone, text, Icon } = getSaldoStatus(saldo.saldo);
                    const toneClasses =
                      tone === "green"
                        ? "border-green-200 bg-green-50/60"
                        : tone === "yellow"
                        ? "border-yellow-200 bg-yellow-50/60"
                        : "border-red-200 bg-red-50/60";

                    return (
                      <div
                        key={`${saldo.moneda_id}-${saldo.punto_id ?? "single"}`}
                        className={`rounded-lg border ${toneClasses} p-3 hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-full bg-white/70 border">
                              <DollarSign
                                className={`h-4 w-4 ${
                                  tone === "red"
                                    ? "text-red-600"
                                    : tone === "yellow"
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }`}
                              />
                            </div>
                            <div className="text-sm font-medium">
                              {saldo.moneda_codigo}
                              {saldo.moneda_codigo === "USD" && (
                                <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-white/80 border text-green-700">
                                  Principal
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="gap-1">
                            <Icon className="h-3.5 w-3.5" />
                            <span
                              className={
                                tone === "red"
                                  ? "text-red-700"
                                  : tone === "yellow"
                                  ? "text-yellow-700"
                                  : "text-green-700"
                              }
                            >
                              {text}
                            </span>
                          </Badge>
                        </div>

                        <div
                          className={`mt-2 ${
                            saldo.moneda_codigo === "USD"
                              ? "text-2xl"
                              : "text-xl"
                          } font-bold ${
                            tone === "red"
                              ? "text-red-700"
                              : tone === "yellow"
                              ? "text-yellow-700"
                              : "text-green-800"
                          }`}
                        >
                          {formatCurrency(saldo.saldo, saldo.moneda_codigo)}
                        </div>

                        {isAdminView && saldo.punto_nombre && (
                          <div className="mt-1 text-xs text-gray-600 line-clamp-1">
                            {saldo.punto_nombre}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-500">
                    {filteredSaldos.length} saldo
                    {filteredSaldos.length !== 1 ? "s" : ""} • última
                    actualización: {new Date().toLocaleTimeString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={refresh}>
                      <RefreshCw
                        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                      />
                    </Button>
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                    >
                      Ir arriba
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SaldosDivisasEnTiempoReal;
