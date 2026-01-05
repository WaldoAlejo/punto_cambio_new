import { useEffect, useMemo, useState, useCallback } from "react";
import { User, PuntoAtencion, CambioDivisa, Moneda, Usuario } from "@/types";
import { pointService } from "@/services/pointService";
import { exchangeService } from "@/services/exchangeService";
import { currencyService } from "@/services/currencyService";
import { userService } from "@/services/userService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ExchangeList from "./ExchangeList";
import PartialExchangesList from "./PartialExchangesList"; // <--- AGREGA ESTA LÍNEA
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AdminExchangeBrowserProps {
  user: User;
}

/**
 * AdminExchangeBrowser
 * - Vista SOLO para ADMIN/SUPER_USUARIO
 * - Lista todas las transacciones de cambio de todos los puntos (o filtradas por punto)
 * - Permite eliminar cambios (solo del día actual; validación en backend)
 * - Dispara evento global "saldosUpdated" tras eliminar para refrescar contabilidad general y por punto
 * - Filtros: por punto (server-side), por operador (client-side), por valor (client-side, origen o destino)
 */
const AdminExchangeBrowser = ({ user }: AdminExchangeBrowserProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>("ALL");
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [operators, setOperators] = useState<Usuario[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("ALL");
  const [valueMin, setValueMin] = useState<string>("");
  const [valueMax, setValueMax] = useState<string>("");
  // Filtros de fecha: por día o rango
  const [date, setDate] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab servicios externos (admin)
  const [activeTab, setActiveTab] = useState<
    "cambios" | "cambiosParciales" | "serviciosExternos"
  >("cambios");
  const [externalServices, setExternalServices] = useState<any[]>([]);
  const [extDesde, setExtDesde] = useState<string>("");
  const [extHasta, setExtHasta] = useState<string>("");

  // Cambios parciales
  const [partialExchanges, setPartialExchanges] = useState<any[]>([]);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const isAdmin = useMemo(
    () => user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO",
    [user?.rol]
  );

  const loadCurrencies = useCallback(async () => {
    const { currencies, error } = await currencyService.getAllCurrencies();
    if (error) {
      toast.error(error);
      setCurrencies([]);
    } else {
      setCurrencies(currencies);
    }
  }, []);

  const loadPoints = useCallback(async () => {
    const { points, error } = await pointService.getAllPointsForAdmin();
    if (error) {
      toast.error(error);
      setPoints([]);
    } else {
      setPoints(points);
    }
  }, []);

  const loadOperators = useCallback(async () => {
    const { users, error } = await userService.getAllUsers();
    if (error) {
      toast.error(error);
      setOperators([]);
      return;
    }
    const activeOperators = (users || [])
      .filter((u) => u.rol === "OPERADOR" && u.activo)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    setOperators(activeOperators);
  }, []);

  const loadExchanges = useCallback(
    async (pointId: string) => {
      setError(null);
      try {
        const dateParams = date
          ? { date }
          : fromDate || toDate
          ? { from: fromDate || undefined, to: toDate || undefined }
          : undefined;

        if (pointId && pointId !== "ALL") {
          const { exchanges, error } =
            await exchangeService.getExchangesByPoint(pointId, dateParams);
          if (error) {
            setExchanges([]);
            setError(error);
          } else {
            setExchanges(exchanges);
          }
        } else {
          const { exchanges, error } = await exchangeService.getAllExchanges(
            dateParams
          );
          if (error) {
            setExchanges([]);
            setError(error);
          } else {
            setExchanges(exchanges);
          }
        }
      } catch (e: any) {
        setError(e?.message || "Error al cargar cambios");
        setExchanges([]);
      }
    },
    [date, fromDate, toDate]
  );

  const loadExternalServices = useCallback(
    async (pointId?: string) => {
      try {
        const params: any = {
          pointId,
          desde: extDesde || undefined,
          hasta: extHasta || undefined,
          limit: 200,
        };
        const { movimientos, success } = await (
          await import("@/services/externalServicesService")
        ).listarMovimientosServiciosExternosAdmin(params);
        setExternalServices(success ? movimientos : []);
        if (!success) {
          toast.error("No se pudieron cargar los servicios externos");
        }
      } catch (e: any) {
        setExternalServices([]);
        toast.error(
          e?.friendlyMessage ||
            e?.message ||
            "Error cargando servicios externos"
        );
      }
    },
    [extDesde, extHasta]
  );

  const loadPartialExchanges = useCallback(async (pointId?: string) => {
    try {
      const response = await fetch(
        `/api/exchanges/partial?pointId=${pointId || "ALL"}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Error al cargar cambios parciales");
      }

      const data = await response.json();
      setPartialExchanges(data.success ? data.exchanges : []);

      if (!data.success) {
        toast.error("No se pudieron cargar los cambios parciales");
      }
    } catch (e: any) {
      setPartialExchanges([]);
      toast.error(e?.message || "Error cargando cambios parciales");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        await Promise.all([loadCurrencies(), loadPoints(), loadOperators()]);
        if (!isMounted) return;
        await loadExchanges("ALL");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadCurrencies, loadPoints, loadOperators, loadExchanges]);

  useEffect(() => {
    // Cuando cambia el punto seleccionado o la pestaña, recargar lista correspondiente
    (async () => {
      setIsRefreshing(true);
      if (activeTab === "cambios") {
        await loadExchanges(selectedPointId);
      } else if (activeTab === "cambiosParciales") {
        await loadPartialExchanges(selectedPointId);
      } else {
        await loadExternalServices(selectedPointId);
      }
      setIsRefreshing(false);
    })();
  }, [
    selectedPointId,
    activeTab,
    loadExchanges,
    loadExternalServices,
    loadPartialExchanges,
  ]);

  const handleDeleted = (id: string) => {
    setExchanges((prev) => prev.filter((e) => e.id !== id));
  };

  const filteredExchanges = useMemo(() => {
    const min = valueMin.trim() !== "" ? Number(valueMin) : null;
    const max = valueMax.trim() !== "" ? Number(valueMax) : null;

    return exchanges.filter((e) => {
      // Filtro por operador
      if (selectedOperatorId !== "ALL" && e.usuario_id !== selectedOperatorId) {
        return false;
      }

      // Filtro por valor (coincide si monto_origen o monto_destino está dentro del rango)
      if (min !== null || max !== null) {
        const origin = Number(e.monto_origen || 0);
        const dest = Number(e.monto_destino || 0);
        const inRange = (v: number) => {
          if (Number.isNaN(v)) return false;
          if (min !== null && v < min) return false;
          if (max !== null && v > max) return false;
          return true;
        };
        const match = inRange(origin) || inRange(dest);
        if (!match) return false;
      }

      return true;
    });
  }, [exchanges, selectedOperatorId, valueMin, valueMax]);

  if (!isAdmin) {
    return (
      <div className="p-6 text-center py-12 text-red-500">
        Permisos insuficientes
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header - Siempre visible */}
      <div className="flex-shrink-0">
        <div className="bg-card rounded-lg shadow-sm p-4 border border-border/50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-primary">
                Cambios de Divisas (Admin)
              </h1>
              <p className="text-xs text-muted-foreground">
                Visualiza y gestiona cambios de todos los puntos. Solo se pueden
                eliminar operaciones del día actual.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Punto selector */}
              <div className="min-w-[220px]">
                <Select
                  value={selectedPointId}
                  onValueChange={(v) => setSelectedPointId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un punto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los puntos</SelectItem>
                    {points.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operador selector */}
              <div className="min-w-[220px]">
                <Select
                  value={selectedOperatorId}
                  onValueChange={(v) => setSelectedOperatorId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los operadores</SelectItem>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.nombre || op.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por valor: rango min/max (aplica a origen o destino) */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Valor min"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  className="w-[120px]"
                />
                <span className="text-muted-foreground text-xs">a</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Valor max"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  className="w-[120px]"
                />
              </div>

              {/* Filtros de fecha: por día o rango */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[150px]"
                />
                <span className="text-muted-foreground text-xs">o</span>
                <Input
                  type="date"
                  placeholder="Desde"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[150px]"
                />
                <span className="text-muted-foreground text-xs">a</span>
                <Input
                  type="date"
                  placeholder="Hasta"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[150px]"
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    // Si se establece una fecha exacta, limpiamos el rango
                    if (date) {
                      setFromDate("");
                      setToDate("");
                    }
                    setIsRefreshing(true);
                    await loadExchanges(selectedPointId);
                    setIsRefreshing(false);
                  }}
                  disabled={isLoading || isRefreshing}
                  className="whitespace-nowrap"
                >
                  Aplicar
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setDate("");
                    setFromDate("");
                    setToDate("");
                    setIsRefreshing(true);
                    await loadExchanges(selectedPointId);
                    setIsRefreshing(false);
                  }}
                  disabled={isLoading || isRefreshing}
                  className="whitespace-nowrap"
                >
                  Limpiar
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={async () => {
                  setIsRefreshing(true);
                  if (activeTab === "cambios") {
                    await loadExchanges(selectedPointId);
                  } else if (activeTab === "cambiosParciales") {
                    await loadPartialExchanges(
                      selectedPointId === "ALL" ? undefined : selectedPointId
                    );
                  } else {
                    await loadExternalServices(
                      selectedPointId === "ALL"
                        ? (undefined as any)
                        : selectedPointId
                    );
                  }
                  setIsRefreshing(false);
                }}
                disabled={isLoading || isRefreshing}
                className="whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body - Scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="h-full flex flex-col"
        >
          <TabsList className="mb-2 flex-shrink-0">
            <TabsTrigger value="cambios">Cambios</TabsTrigger>
            <TabsTrigger value="cambiosParciales">
              Cambios Parciales
            </TabsTrigger>
            <TabsTrigger value="serviciosExternos">
              Servicios Externos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Cambios */}
          <div role="tabpanel" hidden={activeTab !== "cambios"}>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Listado{" "}
                  {selectedPointId === "ALL"
                    ? "(Todos los puntos)"
                    : "(Punto seleccionado)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-3 text-sm text-red-600">{error}</div>
                )}
                <ExchangeList
                  exchanges={filteredExchanges}
                  currencies={currencies}
                  onDeleted={handleDeleted}
                  onReprintReceipt={undefined}
                  /* Mostrar punto y usuario al admin */
                  showPointName
                  showUserName
                />
              </CardContent>
            </Card>
          </div>

          {/* Tab: Cambios Parciales */}
          <div role="tabpanel" hidden={activeTab !== "cambiosParciales"}>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Cambios Parciales{" "}
                  {selectedPointId === "ALL"
                    ? "(Todos los puntos)"
                    : "(Punto seleccionado)"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Cambios con saldo pendiente que requieren completar la entrega
                </p>
              </CardHeader>
              <CardContent>
                <PartialExchangesList
                  exchanges={partialExchanges}
                  onCompleted={(id: string) => {
                    setPartialExchanges((prev) =>
                      prev.filter((e) => e.id !== id)
                    );
                    toast.success("Cambio parcial completado");
                  }}
                  showPointName
                  showUserName
                />
              </CardContent>
            </Card>
          </div>

          {/* Tab: Servicios Externos */}
          <div role="tabpanel" hidden={activeTab !== "serviciosExternos"}>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Servicios Externos (Admin)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filtros fecha para servicios externos */}
                <div className="flex items-end gap-2 mb-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Desde
                    </label>
                    <Input
                      type="date"
                      value={extDesde}
                      onChange={(e) => setExtDesde(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Hasta
                    </label>
                    <Input
                      type="date"
                      value={extHasta}
                      onChange={(e) => setExtHasta(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setIsRefreshing(true);
                      await loadExternalServices(
                        selectedPointId === "ALL"
                          ? (undefined as any)
                          : selectedPointId
                      );
                      setIsRefreshing(false);
                    }}
                    disabled={isLoading || isRefreshing}
                  >
                    Aplicar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setExtDesde("");
                      setExtHasta("");
                      setIsRefreshing(true);
                      await loadExternalServices(
                        selectedPointId === "ALL"
                          ? (undefined as any)
                          : selectedPointId
                      );
                      setIsRefreshing(false);
                    }}
                    disabled={isLoading || isRefreshing}
                  >
                    Limpiar
                  </Button>
                </div>

                {/* Tabla servicios externos */}
                <div className="rounded border overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Punto</th>
                        <th className="p-2 text-left">Servicio</th>
                        <th className="p-2 text-left">Tipo</th>
                        <th className="p-2 text-right">Monto (USD)</th>
                        <th className="p-2 text-left">Referencia</th>
                        <th className="p-2 text-left">Descripción</th>
                        <th className="p-2 text-left">Usuario</th>
                        <th className="p-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {externalServices.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2">
                            {new Date(it.fecha).toLocaleString(undefined, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-2">
                            {points.find((p) => p.id === it.punto_atencion_id)
                              ?.nombre || it.punto_atencion_id}
                          </td>
                          <td className="p-2">{it.servicio}</td>
                          <td className="p-2">
                            <Badge
                              variant={
                                it.tipo_movimiento === "INGRESO"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className={
                                it.tipo_movimiento === "INGRESO"
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-red-100 text-red-800 border-red-200"
                              }
                            >
                              {it.tipo_movimiento === "INGRESO"
                                ? "Ingreso"
                                : "Egreso"}
                            </Badge>
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={
                                it.tipo_movimiento === "INGRESO"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }
                            >
                              {Number(it.monto).toFixed(2)}
                            </span>
                          </td>
                          <td className="p-2">
                            {it.numero_referencia?.trim()
                              ? it.numero_referencia
                              : "-"}
                          </td>
                          <td className="p-2">{it.descripcion || "-"}</td>
                          <td className="p-2">{it.usuario?.nombre || "-"}</td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                showConfirmation(
                                  "Eliminar movimiento",
                                  "¿Eliminar este movimiento? Esto revertirá el saldo con un ajuste. Solo se permiten eliminaciones del día actual.",
                                  async () => {
                                    try {
                                      const {
                                        eliminarMovimientoServicioExterno,
                                      } = await import(
                                        "@/services/externalServicesService"
                                      );
                                      const resp =
                                        await eliminarMovimientoServicioExterno(
                                          it.id
                                        );
                                      if (resp?.success) {
                                        toast.success("Movimiento eliminado");
                                        setExternalServices((prev) =>
                                          prev.filter((r) => r.id !== it.id)
                                        );
                                        window.dispatchEvent(
                                          new CustomEvent("saldosUpdated")
                                        );
                                      } else {
                                        toast.error(
                                          resp?.error || "No se pudo eliminar"
                                        );
                                      }
                                    } catch (e: any) {
                                      toast.error(
                                        e?.friendlyMessage ||
                                          e?.message ||
                                          "Error de conexión"
                                      );
                                    }
                                  },
                                  "destructive"
                                );
                              }}
                              title="Eliminar movimiento"
                              aria-label="Eliminar movimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ConfirmationDialog />
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminExchangeBrowser;
