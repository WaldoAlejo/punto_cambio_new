import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import type { User, Usuario } from "../../types";
import { userService } from "@/services/userService";
import { pointService } from "@/services/pointService";
import { currencyService } from "@/services/currencyService";
import { exportToExcel } from "@/utils/exportToExcel";
import { Loader2, Filter, Download, BarChart2 } from "lucide-react";

interface ReportsProps {
  user: User;
  selectedPoint?: any; // compat
}

const Reports: React.FC<ReportsProps> = ({ user: _user }) => {
  // Tipo principal unificado
  const [mainType, setMainType] = useState<
    | "exchanges"
    | "transfers"
    | "balances"
    | "users"
    | "worktime"
    | "accounting_movements"
    | "point_assignments"
    | "summary"
    | ""
  >("");

  // Toggles/selecciones auxiliares
  const [isDetailed, setIsDetailed] = useState<boolean>(false); // para exchanges/transfers
  const [corte, setCorte] = useState<"actual" | "eod">("actual"); // para balances

  // Fechas
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Carga / data
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  // Filtros
  const [users, setUsers] = useState<Usuario[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [points, setPoints] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Filtros extra detallados
  const [currencies, setCurrencies] = useState<
    { id: string; codigo: string }[]
  >([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(
    null
  );
  const [estado, setEstado] = useState<string | null>(null);
  const [metodoEntrega, setMetodoEntrega] = useState<
    "efectivo" | "transferencia" | null
  >(null);

  // Prefill: últimos 7 días
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  }, []);

  // Cargar catálogos según mainType/isDetailed/corte
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await userService.getAllUsers();
        if (!res.error) setUsers(res.users);
      } catch (e) {
        console.warn("No se pudieron cargar usuarios", e);
      }
    };
    const loadPoints = async () => {
      try {
        const res = await pointService.getAllPoints();
        if (!res.error)
          setPoints(
            res.points.map((p: any) => ({ id: p.id, nombre: p.nombre }))
          );
      } catch (e) {
        console.warn("No se pudieron cargar puntos", e);
      }
    };
    const loadCurrencies = async () => {
      try {
        const res = await currencyService.getAllCurrencies();
        if (!res.error) {
          setCurrencies(
            res.currencies.map((c: any) => ({ id: c.id, codigo: c.codigo }))
          );
        }
      } catch (e) {
        console.warn("No se pudieron cargar monedas", e);
      }
    };

    const needUsersPoints =
      mainType === "worktime" ||
      (mainType === "exchanges" && isDetailed) ||
      (mainType === "transfers" && isDetailed) ||
      mainType === "accounting_movements" ||
      (mainType === "balances" && corte === "eod");

    const needCurrencies =
      (mainType === "exchanges" && isDetailed) ||
      (mainType === "transfers" && isDetailed);

    if (needUsersPoints) {
      if (users.length === 0) loadUsers();
      if (points.length === 0) loadPoints();
    }
    if (needCurrencies && currencies.length === 0) loadCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainType, isDetailed, corte]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.nombre.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  // Tipo efectivo que va al backend y define columnas/exports
  const effectiveReportType = useMemo(() => {
    if (mainType === "exchanges")
      return isDetailed ? "exchanges_detailed" : "exchanges";
    if (mainType === "transfers")
      return isDetailed ? "transfers_detailed" : "transfers";
    if (mainType === "balances")
      return corte === "eod" ? "eod_balances" : "balances";
    return mainType || "";
  }, [mainType, isDetailed, corte]);

  // ====== Helpers KPI ======
  const sumByKeys = (arr: any[], keys: string[]) =>
    arr.reduce(
      (acc, r) =>
        acc + keys.reduce((s, k) => s + (Number((r as any)?.[k]) || 0), 0),
      0
    );
  const countBy = (arr: any[], key: string, val: any) =>
    arr.filter((r) => (r as any)?.[key] === val).length;

  const kpis = useMemo(() => {
    const k: Array<{ label: string; value: number | string }> = [
      { label: "Registros", value: reportData.length },
    ];
    const amount = sumByKeys(reportData, [
      "monto",
      "monto_destino",
      "monto_origen",
      "amount",
      "total",
      "balance",
    ]);
    if (amount > 0) k.push({ label: "Total ($)", value: amount });

    if (effectiveReportType === "transfers_detailed") {
      k.push({
        label: "Aprobadas",
        value: countBy(reportData, "estado", "APROBADO"),
      });
      k.push({
        label: "Rechazadas",
        value: countBy(reportData, "estado", "RECHAZADO"),
      });
    }
    if (effectiveReportType === "exchanges_detailed") {
      k.push({
        label: "Completadas",
        value: countBy(reportData, "estado", "COMPLETADO"),
      });
      k.push({
        label: "Pendientes",
        value: countBy(reportData, "estado", "PENDIENTE"),
      });
      const margen = sumByKeys(reportData, ["margen_bruto"]);
      if (margen > 0) k.push({ label: "Margen Bruto ($)", value: margen });
    }
    return k;
  }, [reportData, effectiveReportType]);

  const generateReport = async () => {
    if (!effectiveReportType || !dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Debe completar tipo y fechas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://34.122.108.114:3001/api"
        }/reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportType: effectiveReportType,
            dateFrom,
            dateTo,
            // filtros opcionales
            ...((effectiveReportType === "worktime" ||
              effectiveReportType === "exchanges_detailed" ||
              effectiveReportType === "transfers_detailed" ||
              effectiveReportType === "accounting_movements") &&
            selectedUserId
              ? { userId: selectedUserId }
              : {}),
            ...((effectiveReportType === "worktime" ||
              effectiveReportType === "exchanges_detailed" ||
              effectiveReportType === "transfers_detailed" ||
              effectiveReportType === "accounting_movements" ||
              effectiveReportType === "eod_balances") &&
            selectedPointId
              ? { pointId: selectedPointId }
              : {}),
            ...(effectiveReportType === "exchanges_detailed" &&
            selectedCurrencyId
              ? { currencyId: selectedCurrencyId }
              : {}),
            ...(effectiveReportType === "exchanges_detailed" && estado
              ? { estado }
              : {}),
            ...(effectiveReportType === "exchanges_detailed" && metodoEntrega
              ? { metodoEntrega }
              : {}),
            ...(effectiveReportType === "transfers_detailed" &&
            selectedCurrencyId
              ? { currencyId: selectedCurrencyId }
              : {}),
            ...(effectiveReportType === "transfers_detailed" && estado
              ? { estado }
              : {}),
          }),
        }
      );

      const data = await response.json();

      if (!data.success)
        throw new Error(data.error || "Error al generar reporte");

      setReportData(data.data);
      toast({
        title: "Reporte generado",
        description: `Se generó el reporte exitosamente`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Error al generar reporte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canExport = reportData.length > 0;
  const doExport = () => {
    const sheetNameMap: Record<string, string> = {
      exchanges: "Cambios",
      exchanges_detailed: "Cambios Detallados",
      transfers: "Transferencias",
      transfers_detailed: "Transferencias Detalladas",
      balances: "Saldos",
      users: "Usuarios",
      worktime: "Tiempo Trabajo",
      accounting_movements: "Movimientos",
      eod_balances: "Cierres",
      point_assignments: "Asignaciones",
      summary: "Resumen",
    };
    const fileBase = sheetNameMap[effectiveReportType] || "Reporte";
    exportToExcel(
      reportData,
      `${fileBase}_${dateFrom}_a_${dateTo}`,
      undefined,
      undefined,
      undefined,
      fileBase
    );
  };

  // UI helpers de visibilidad
  const showUserFilter =
    mainType === "worktime" ||
    (mainType === "exchanges" && isDetailed) ||
    (mainType === "transfers" && isDetailed) ||
    mainType === "accounting_movements";

  const showPointFilter =
    mainType === "worktime" ||
    (mainType === "exchanges" && isDetailed) ||
    (mainType === "transfers" && isDetailed) ||
    mainType === "accounting_movements" ||
    (mainType === "balances" && corte === "eod");

  const showCurrencyFilter =
    (mainType === "exchanges" && isDetailed) ||
    (mainType === "transfers" && isDetailed);

  const showEstadoFilter =
    (mainType === "exchanges" && isDetailed) ||
    (mainType === "transfers" && isDetailed);

  const showMetodoEntregaFilter = mainType === "exchanges" && isDetailed;

  return (
    <div className="space-y-4">
      {/* Barra de filtros sticky */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Tipo principal */}
          <div className="space-y-1 lg:col-span-3">
            <Label>Tipo</Label>
            <Select
              value={mainType}
              onValueChange={(v) =>
                setMainType(
                  v as ReportsProps["user"] extends never ? never : any
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exchanges">Cambios</SelectItem>
                <SelectItem value="transfers">Transferencias</SelectItem>
                <SelectItem value="balances">Saldos</SelectItem>
                <SelectItem value="users">Actividad Usuarios</SelectItem>
                <SelectItem value="worktime">Tiempo de Trabajo</SelectItem>
                <SelectItem value="accounting_movements">
                  Movimientos Contables
                </SelectItem>
                <SelectItem value="point_assignments">
                  Asignaciones de Punto
                </SelectItem>
                <SelectItem value="summary">Resumen General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Variantes por tipo */}
          <div className="space-y-1 lg:col-span-2">
            {mainType === "exchanges" || mainType === "transfers" ? (
              <>
                <Label>Detalle</Label>
                <Select
                  value={isDetailed ? "detalle" : "resumen"}
                  onValueChange={(v) => setIsDetailed(v === "detalle")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resumen">Resumen</SelectItem>
                    <SelectItem value="detalle">Detalle</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : mainType === "balances" ? (
              <>
                <Label>Corte</Label>
                <Select
                  value={corte}
                  onValueChange={(v) => setCorte(v as "actual" | "eod")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Corte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actual">Actual</SelectItem>
                    <SelectItem value="eod">Fin de día</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div />
            )}
          </div>

          {/* Fechas */}
          <div className="space-y-1 lg:col-span-2">
            <Label>Desde</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label>Hasta</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Usuario */}
          <div className="space-y-1 lg:col-span-3">
            <Label>Usuario (opcional)</Label>
            {showUserFilter ? (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Buscar por nombre o username"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <Select
                  value={selectedUserId || ""}
                  onValueChange={(v) =>
                    setSelectedUserId(v === "ALL" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nombre} (@{u.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Input disabled placeholder="No aplica" />
            )}
          </div>

          {/* Punto */}
          <div className="space-y-1 lg:col-span-3">
            <Label>Punto (opcional)</Label>
            {showPointFilter ? (
              <Select
                value={selectedPointId || ""}
                onValueChange={(v) =>
                  setSelectedPointId(v === "ALL" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {points.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input disabled placeholder="No aplica" />
            )}
          </div>

          {/* Moneda */}
          <div className="space-y-1 lg:col-span-2">
            <Label>Moneda</Label>
            {showCurrencyFilter ? (
              <Select
                value={selectedCurrencyId || ""}
                onValueChange={(v) =>
                  setSelectedCurrencyId(v === "ALL" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input disabled placeholder="No aplica" />
            )}
          </div>

          {/* Estado */}
          <div className="space-y-1 lg:col-span-2">
            <Label>Estado</Label>
            {showEstadoFilter ? (
              <Select
                value={estado || ""}
                onValueChange={(v) => setEstado(v === "ALL" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {mainType === "exchanges" && (
                    <>
                      <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                      <SelectItem value="COMPLETADO">COMPLETADO</SelectItem>
                    </>
                  )}
                  {mainType === "transfers" && (
                    <>
                      <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                      <SelectItem value="APROBADO">APROBADO</SelectItem>
                      <SelectItem value="RECHAZADO">RECHAZADO</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input disabled placeholder="No aplica" />
            )}
          </div>

          {/* Método de entrega */}
          <div className="space-y-1 lg:col-span-2">
            <Label>Método de entrega</Label>
            {showMetodoEntregaFilter ? (
              <Select
                value={metodoEntrega || ""}
                onValueChange={(v) =>
                  setMetodoEntrega(v === "ALL" ? null : (v as any))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input disabled placeholder="No aplica" />
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2 lg:col-span-2">
            <Button
              variant="outline"
              onClick={generateReport}
              disabled={loading}
            >
              <Filter className="w-4 h-4 mr-2" />
              Aplicar
            </Button>
            <Button onClick={doExport} disabled={!canExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Reportes
            </CardTitle>
            <CardDescription>
              Vistas limpias y consistentes. Ajusta filtros y exporta a Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Cargando…
              </div>
            ) : reportData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <BarChart2 className="w-8 h-8 mb-2 opacity-60" />
                <div className="text-lg font-medium">Sin datos</div>
                <div className="text-sm">
                  Ajusta los filtros o cambia el tipo de reporte.
                </div>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {kpis.map((k) => (
                    <Card key={k.label} className="rounded-2xl">
                      <CardContent className="py-4">
                        <div className="text-sm text-muted-foreground">
                          {k.label}
                        </div>
                        <div className="text-2xl font-semibold tabular-nums">
                          {typeof k.value === "number"
                            ? Intl.NumberFormat("es-EC").format(k.value)
                            : k.value}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator className="mb-4" />

                {/* Tablas según tipo efectivo */}
                {effectiveReportType === "worktime" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/40">
                          {[
                            "Fecha",
                            "Punto",
                            "Usuario",
                            "Username",
                            "Entrada",
                            "Almuerzo",
                            "Regreso",
                            "Salida",
                            "Almuerzo (min)",
                            "Salidas (min)",
                            "Tiempo Efectivo",
                            "Estado",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any, index: number) => {
                          const fmtHM = (mins: number) => {
                            const h = Math.floor((mins || 0) / 60);
                            const m = Math.abs((mins || 0) % 60);
                            return `${h}h ${m}m`;
                          };
                          const fmtTime = (iso?: string) =>
                            iso
                              ? new Date(iso).toLocaleTimeString("es-EC", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "";
                          return (
                            <tr key={index} className="hover:bg-muted/20">
                              <td className="px-3 py-2">{row.date}</td>
                              <td className="px-3 py-2">{row.point}</td>
                              <td className="px-3 py-2">{row.user}</td>
                              <td className="px-3 py-2">
                                {row.username ? `@${row.username}` : ""}
                              </td>
                              <td className="px-3 py-2">
                                {fmtTime(row.entrada)}
                              </td>
                              <td className="px-3 py-2">
                                {fmtTime(row.almuerzo)}
                              </td>
                              <td className="px-3 py-2">
                                {fmtTime(row.regreso)}
                              </td>
                              <td className="px-3 py-2">
                                {fmtTime(row.salida)}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {fmtHM(row.lunchMinutes)}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {fmtHM(row.spontaneousMinutes)}
                              </td>
                              <td className="px-3 py-2 font-semibold tabular-nums">
                                {fmtHM(row.effectiveMinutes)}
                              </td>
                              <td className="px-3 py-2">{row.estado || ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : effectiveReportType === "exchanges_detailed" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/40">
                          {[
                            "fecha",
                            "punto",
                            "usuario",
                            "tipo_operacion",
                            "moneda_origen",
                            "moneda_destino",
                            "monto_origen",
                            "monto_destino",
                            "tasa_billetes",
                            "tasa_monedas",
                            "rate_applied",
                            "tasa_mid",
                            "spread",
                            "margen_bruto",
                            "metodo_entrega",
                            "numero_recibo",
                            "estado",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap"
                            >
                              {h.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any, index: number) => (
                          <tr
                            key={row.id || index}
                            className="hover:bg-muted/20"
                          >
                            <td className="px-3 py-2">
                              {new Date(row.fecha).toLocaleString("es-EC")}
                            </td>
                            <td className="px-3 py-2">{row.punto}</td>
                            <td className="px-3 py-2">{row.usuario}</td>
                            <td className="px-3 py-2">{row.tipo_operacion}</td>
                            <td className="px-3 py-2">{row.moneda_origen}</td>
                            <td className="px-3 py-2">{row.moneda_destino}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {Number(row.monto_origen || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {Number(row.monto_destino || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.tasa_billetes}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.tasa_monedas}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.rate_applied}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.tasa_mid}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.spread}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {Number(row.margen_bruto || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{row.metodo_entrega}</td>
                            <td className="px-3 py-2">
                              {row.numero_recibo || ""}
                            </td>
                            <td className="px-3 py-2">{row.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : effectiveReportType === "transfers_detailed" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/40">
                          {[
                            "fecha",
                            "punto_origen",
                            "punto_destino",
                            "usuario_solicitante",
                            "moneda",
                            "monto",
                            "estado",
                            "numero_recibo",
                            "observaciones",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap"
                            >
                              {h.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any, index: number) => (
                          <tr
                            key={row.id || index}
                            className="hover:bg-muted/20"
                          >
                            <td className="px-3 py-2">
                              {new Date(row.fecha).toLocaleString("es-EC")}
                            </td>
                            <td className="px-3 py-2">{row.punto_origen}</td>
                            <td className="px-3 py-2">{row.punto_destino}</td>
                            <td className="px-3 py-2">
                              {row.usuario_solicitante}
                            </td>
                            <td className="px-3 py-2">{row.moneda}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {Number(row.monto || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{row.estado}</td>
                            <td className="px-3 py-2">
                              {row.numero_recibo || ""}
                            </td>
                            <td className="px-3 py-2">
                              {row.observaciones || ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Tabla genérica (exchanges, transfers, balances, users, point_assignments, summary, accounting_movements)
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/40">
                          {reportData.length > 0 &&
                            Object.keys(reportData[0]).map((key: string) => (
                              <th
                                key={key}
                                className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap"
                              >
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any, index: number) => (
                          <tr key={index} className="hover:bg-muted/20">
                            {Object.keys(row).map((k: string) => (
                              <td key={k} className="px-3 py-2 tabular-nums">
                                {typeof row[k] === "number"
                                  ? Intl.NumberFormat("es-EC").format(
                                      row[k] as number
                                    )
                                  : String(row[k])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
