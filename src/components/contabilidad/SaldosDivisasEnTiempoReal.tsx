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
}

export const SaldosDivisasEnTiempoReal = ({
  user,
  selectedPoint,
  className = "",
  isAdminView = false,
}: SaldosDivisasEnTiempoRealProps) => {
  // Usar hook apropiado según si es vista de administrador
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

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filtros (solo relevantes en vista admin)
  const [selectedPointId, setSelectedPointId] = useState<string>("ALL");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("ALL");

  // Construir opciones desde los saldos consolidados
  const pointOptions = useMemo(() => {
    if (!isAdminView) return [] as { id: string; nombre: string }[];
    const map = new Map<string, string>();
    (saldos as SaldoConsolidado[]).forEach((s: any) => {
      if ("punto_id" in s)
        map.set((s as any).punto_id, (s as any).punto_nombre);
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [saldos, isAdminView]);

  const currencyOptions = useMemo(() => {
    const map = new Map<string, string>();
    saldos.forEach((s: any) => {
      map.set(s.moneda_id, s.moneda_codigo);
    });
    // Orden: USD primero
    return Array.from(map.entries())
      .map(([id, codigo]) => ({ id, codigo }))
      .sort((a, b) =>
        a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
      );
  }, [saldos]);

  // Lista filtrada según selección
  const filteredSaldos = useMemo(() => {
    let list = saldos;
    if (isAdminView) {
      if (selectedPointId !== "ALL") {
        list = list.filter((s: any) => (s as any).punto_id === selectedPointId);
      }
    }
    if (selectedCurrencyId !== "ALL") {
      list = list.filter((s: any) => s.moneda_id === selectedCurrencyId);
    }
    return list;
  }, [saldos, isAdminView, selectedPointId, selectedCurrencyId]);

  // Resumen por divisa (para vista consolidada)
  const resumenPorDivisa = useMemo(() => {
    const map = new Map<string, number>();
    filteredSaldos.forEach((s: any) => {
      map.set(s.moneda_codigo, (map.get(s.moneda_codigo) || 0) + s.saldo);
    });
    return Array.from(map.entries())
      .map(([codigo, total]) => ({ codigo, total }))
      .sort((a, b) =>
        a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
      );
  }, [filteredSaldos]);

  // Agrupar por punto para vista admin cuando se muestran todos los puntos
  const groupedByPoint = useMemo(() => {
    if (!isAdminView || selectedPointId !== "ALL") return null;
    const groups = new Map<string, { nombre: string; items: any[] }>();
    (filteredSaldos as any[]).forEach((s: any) => {
      const pid = s.punto_id as string;
      const pname = s.punto_nombre as string;
      if (!groups.has(pid)) groups.set(pid, { nombre: pname, items: [] });
      groups.get(pid)!.items.push(s);
    });
    // Ordenar internamente: USD primero, luego alfabético
    groups.forEach((g) => {
      g.items.sort((a, b) =>
        a.moneda_codigo === "USD"
          ? -1
          : b.moneda_codigo === "USD"
          ? 1
          : a.moneda_codigo.localeCompare(b.moneda_codigo)
      );
    });
    return Array.from(groups.entries()).map(([id, val]) => ({ id, ...val }));
  }, [filteredSaldos, isAdminView, selectedPointId]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(interval);
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
      return { color: "destructive", icon: AlertTriangle, text: "Sin saldo" };
    if (saldo < 1000)
      return { color: "warning", icon: TrendingDown, text: "Saldo bajo" };
    return { color: "success", icon: TrendingUp, text: "Saldo normal" };
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
                {/* Filtro por punto */}
                <div className="w-56">
                  <Select
                    value={selectedPointId}
                    onValueChange={(v) => setSelectedPointId(v)}
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

                {/* Filtro por divisa */}
                <div className="w-48">
                  <Select
                    value={selectedCurrencyId}
                    onValueChange={(v) => setSelectedCurrencyId(v)}
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
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && saldos.length === 0 ? (
          <Loading text="Cargando saldos..." className="py-8" />
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : filteredSaldos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay saldos para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen por divisa cuando se ven múltiples puntos */}
            {isAdminView &&
              selectedPointId === "ALL" &&
              resumenPorDivisa.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {resumenPorDivisa.map((t) => (
                    <div
                      key={t.codigo}
                      className="p-3 border rounded-md bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">{t.codigo}</p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(t.total, t.codigo)}
                          </p>
                        </div>
                        <DollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Vista agrupada por punto cuando se ven todos los puntos */}
            {isAdminView && selectedPointId === "ALL" && groupedByPoint && (
              <div className="space-y-6">
                {groupedByPoint.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">
                        {group.nombre}
                      </h3>
                      <Badge variant="outline">
                        {group.items.length} divisa
                        {group.items.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* USD primero */}
                    {group.items
                      .filter((saldo: any) => saldo.moneda_codigo === "USD")
                      .map((saldo: any) => {
                        const status = getSaldoStatus(saldo.saldo);
                        const StatusIcon = status.icon;
                        return (
                          <div
                            key={saldo.moneda_id + "-usd"}
                            className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-full">
                                <DollarSign className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-green-800">
                                  {saldo.moneda_codigo} (Principal)
                                </h4>
                                <p className="text-sm text-green-600">
                                  {group.nombre}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-800">
                                {formatCurrency(
                                  saldo.saldo,
                                  saldo.moneda_codigo
                                )}
                              </p>
                              <div className="flex items-center gap-1 justify-end mt-1">
                                <StatusIcon className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600">
                                  {status.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {/* Otras monedas */}
                    {group.items
                      .filter((saldo: any) => saldo.moneda_codigo !== "USD")
                      .map((saldo: any) => {
                        const status = getSaldoStatus(saldo.saldo);
                        const StatusIcon = status.icon;
                        return (
                          <div
                            key={saldo.moneda_id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold">
                                  {saldo.moneda_codigo}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {group.nombre}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">
                                {formatCurrency(
                                  saldo.saldo,
                                  saldo.moneda_codigo
                                )}
                              </p>
                              <div className="flex items-center gap-1 justify-end mt-1">
                                <StatusIcon
                                  className={`h-4 w-4 ${
                                    status.color === "destructive"
                                      ? "text-red-500"
                                      : status.color === "warning"
                                      ? "text-yellow-500"
                                      : "text-green-500"
                                  }`}
                                />
                                <span
                                  className={`text-sm ${
                                    status.color === "destructive"
                                      ? "text-red-500"
                                      : status.color === "warning"
                                      ? "text-yellow-500"
                                      : "text-green-500"
                                  }`}
                                >
                                  {status.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}

            {/* Vista normal o admin con punto específico */}
            {(!isAdminView || selectedPointId !== "ALL") && (
              <div className="space-y-4">
                {/* Saldo principal (USD) primero */}
                {filteredSaldos
                  .filter((saldo: any) => saldo.moneda_codigo === "USD")
                  .map((saldo: any) => {
                    const status = getSaldoStatus(saldo.saldo);
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={saldo.moneda_id + "-usd-single"}
                        className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <DollarSign className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-green-800">
                              {saldo.moneda_codigo} (Principal)
                            </h3>
                            <p className="text-sm text-green-600">
                              {isAdminView && "punto_nombre" in saldo
                                ? (saldo as any).punto_nombre
                                : "Moneda base del sistema"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-800">
                            {formatCurrency(saldo.saldo, saldo.moneda_codigo)}
                          </p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <StatusIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">
                              {status.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Otras monedas */}
                {filteredSaldos
                  .filter((saldo: any) => saldo.moneda_codigo !== "USD")
                  .sort((a: any, b: any) =>
                    a.moneda_codigo.localeCompare(b.moneda_codigo)
                  )
                  .map((saldo: any) => {
                    const status = getSaldoStatus(saldo.saldo);
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={saldo.moneda_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <DollarSign className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {saldo.moneda_codigo}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {isAdminView && "punto_nombre" in saldo
                                ? (saldo as any).punto_nombre
                                : "Moneda secundaria"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">
                            {formatCurrency(saldo.saldo, saldo.moneda_codigo)}
                          </p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <StatusIcon
                              className={`h-4 w-4 ${
                                status.color === "destructive"
                                  ? "text-red-500"
                                  : status.color === "warning"
                                  ? "text-yellow-500"
                                  : "text-green-500"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                status.color === "destructive"
                                  ? "text-red-500"
                                  : status.color === "warning"
                                  ? "text-yellow-500"
                                  : "text-green-500"
                              }`}
                            >
                              {status.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Resumen total */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Total de monedas configuradas:
                    </span>
                    <Badge variant="outline">
                      {filteredSaldos.length} moneda
                      {filteredSaldos.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Última actualización: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SaldosDivisasEnTiempoReal;
