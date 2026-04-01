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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { User, Usuario } from "../../types";
import { userService } from "@/services/userService";
import { pointService } from "@/services/pointService";
import { currencyService } from "@/services/currencyService";
import { exportToExcel } from "@/utils/exportToExcel";
import { formatGyeTime, formatGyeDate } from "@/utils/timezone";
import {
  Loader2,
  Filter,
  Download,
  BarChart2,
  Calendar,
  Users,
  MapPin,
  Coins,
  TrendingUp,
  FileText,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReportsProps {
  user: User;
  selectedPoint?: unknown;
}

type MainReportType =
  | "exchanges"
  | "transfers"
  | "balances"
  | "users"
  | "worktime"
  | "accounting_movements"
  | "point_assignments"
  | "summary"
  | "";

type MetodoEntrega = "efectivo" | "transferencia";

type ReportRow = Record<string, unknown>;

const isMainReportType = (v: string): v is MainReportType =>
  v === "" ||
  v === "exchanges" ||
  v === "transfers" ||
  v === "balances" ||
  v === "users" ||
  v === "worktime" ||
  v === "accounting_movements" ||
  v === "point_assignments" ||
  v === "summary";

const isMetodoEntrega = (v: string): v is MetodoEntrega =>
  v === "efectivo" || v === "transferencia";

const getRowNumber = (row: ReportRow, key: string): number => {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const ReportsImproved: React.FC<ReportsProps> = ({ user: _user }) => {
  // Estados principales
  const [mainType, setMainType] = useState<MainReportType>("");

  const [isDetailed, setIsDetailed] = useState<boolean>(false);
  const [corte, setCorte] = useState<"actual" | "eod">("actual");

  // Fechas
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Estados de carga y datos
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [users, setUsers] = useState<Usuario[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [points, setPoints] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Filtros adicionales
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

  // Configuración inicial de fechas (últimos 7 días)
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  }, []);

  // Cargar catálogos según el tipo de reporte
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
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
          if (users.length === 0) {
            const usersRes = await userService.getAllUsers();
            if (!usersRes.error) {
              setUsers(usersRes.users);
            } else {
              console.error("❌ Error al cargar usuarios:", usersRes.error);
            }
          }
          if (points.length === 0) {
            const pointsRes = await pointService.getAllPoints();
            if (!pointsRes.error) {
              const mappedPoints = pointsRes.points.map((p) => ({
                id: p.id,
                nombre: p.nombre,
              }));
              setPoints(mappedPoints);
            } else {
              console.error("❌ Error al cargar puntos:", pointsRes.error);
            }
          }
        }

        if (needCurrencies && currencies.length === 0) {
          const currenciesRes = await currencyService.getAllCurrencies();
          if (!currenciesRes.error) {
            setCurrencies(
              currenciesRes.currencies.map((c) => ({
                id: c.id,
                codigo: c.codigo,
              }))
            );
          }
        }
      } catch (error) {
        console.warn("Error cargando catálogos:", error);
      }
    };

    loadCatalogs();
  }, [
    mainType,
    isDetailed,
    corte,
    users.length,
    points.length,
    currencies.length,
  ]);

  // Filtrar usuarios por búsqueda
  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.nombre.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  // Tipo efectivo para el backend
  const effectiveReportType = useMemo(() => {
    if (mainType === "exchanges")
      return isDetailed ? "exchanges_detailed" : "exchanges";
    if (mainType === "transfers")
      return isDetailed ? "transfers_detailed" : "transfers";
    if (mainType === "balances")
      return corte === "eod" ? "eod_balances" : "balances";
    return mainType || "";
  }, [mainType, isDetailed, corte]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const sumByKeys = (arr: ReportRow[], keys: string[]) =>
      arr.reduce(
        (acc, r) => acc + keys.reduce((s, k) => s + getRowNumber(r, k), 0),
        0
      );
    const countBy = (arr: ReportRow[], key: string, val: unknown) =>
      arr.filter((r) => r[key] === val).length;

    const k: Array<{
      label: string;
      value: number | string;
      icon: React.ReactNode;
    }> = [
      {
        label: "Total Registros",
        value: reportData.length,
        icon: <FileText className="w-4 h-4" />,
      },
    ];

    const amount = sumByKeys(reportData, [
      "monto",
      "monto_destino",
      "monto_origen",
      "amount",
      "total",
      "balance",
    ]);

    if (amount > 0) {
      k.push({
        label: "Monto Total",
        value: `$${amount.toLocaleString("es-EC", {
          minimumFractionDigits: 2,
        })}`,
        icon: <TrendingUp className="w-4 h-4" />,
      });
    }

    if (effectiveReportType === "transfers_detailed") {
      k.push({
        label: "Aprobadas",
        value: countBy(reportData, "estado", "APROBADO"),
        icon: <Badge className="w-4 h-4" />,
      });
      k.push({
        label: "Rechazadas",
        value: countBy(reportData, "estado", "RECHAZADO"),
        icon: <AlertCircle className="w-4 h-4" />,
      });
    }

    if (effectiveReportType === "exchanges_detailed") {
      k.push({
        label: "Completadas",
        value: countBy(reportData, "estado", "COMPLETADO"),
        icon: <Badge className="w-4 h-4" />,
      });
      const margen = sumByKeys(reportData, ["margen_bruto"]);
      if (margen > 0) {
        k.push({
          label: "Margen Bruto",
          value: `$${margen.toLocaleString("es-EC", {
            minimumFractionDigits: 2,
          })}`,
          icon: <TrendingUp className="w-4 h-4" />,
        });
      }
    }

    return k;
  }, [reportData, effectiveReportType]);

  // Generar reporte
  const generateReport = async () => {
    if (!effectiveReportType || !dateFrom || !dateTo) {
      toast({
        title: "Campos requeridos",
        description: "Debe seleccionar el tipo de reporte y las fechas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      const apiUrl = import.meta.env.VITE_API_URL || "/api";

      const requestBody = {
        reportType: effectiveReportType,
        dateFrom,
        dateTo,
        // Filtros opcionales
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
        ...(effectiveReportType === "exchanges_detailed" && selectedCurrencyId
          ? { currencyId: selectedCurrencyId }
          : {}),
        ...(effectiveReportType === "exchanges_detailed" && estado
          ? { estado }
          : {}),
        ...(effectiveReportType === "exchanges_detailed" && metodoEntrega
          ? { metodoEntrega }
          : {}),
        ...(effectiveReportType === "transfers_detailed" && selectedCurrencyId
          ? { currencyId: selectedCurrencyId }
          : {}),
        ...(effectiveReportType === "transfers_detailed" && estado
          ? { estado }
          : {}),
      };

      const response = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "❌ Acceso denegado. Verifica tus permisos o contacta al administrador."
          );
        } else if (response.status === 401) {
          throw new Error(
            "❌ Sesión expirada. Por favor inicia sesión nuevamente."
          );
        } else {
          throw new Error(
            data.error || `❌ Error ${response.status}: ${response.statusText}`
          );
        }
      }

      if (!data.success) {
        throw new Error(data.error || "Error al generar reporte");
      }

      setReportData(Array.isArray(data.data) ? data.data : []);
      toast({
        title: "✅ Reporte generado",
        description: `Se encontraron ${
          Array.isArray(data.data) ? data.data.length : 0
        } registros`,
      });
    } catch (error) {
      console.error("Error generando reporte:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error desconocido al generar reporte";
      setError(errorMessage);
      toast({
        title: "❌ Error al generar reporte",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Exportar a Excel
  const exportReport = () => {
    if (reportData.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    const sheetNameMap: Record<string, string> = {
      exchanges: "Cambios",
      exchanges_detailed: "Cambios_Detallados",
      transfers: "Transferencias",
      transfers_detailed: "Transferencias_Detalladas",
      balances: "Saldos",
      users: "Usuarios",
      worktime: "Tiempo_Trabajo",
      accounting_movements: "Movimientos_Contables",
      eod_balances: "Saldos_Cierre",
      point_assignments: "Asignaciones_Punto",
      summary: "Resumen_General",
    };

    const fileName = sheetNameMap[effectiveReportType] || "Reporte";
    const fullFileName = `${fileName}_${dateFrom}_a_${dateTo}`;

    try {
      exportToExcel(
        reportData,
        fullFileName,
        undefined,
        undefined,
        undefined,
        fileName
      );
      toast({
        title: "✅ Exportación exitosa",
        description: `Archivo ${fullFileName}.xlsx descargado`,
      });
    } catch {
      toast({
        title: "❌ Error al exportar",
        description: "No se pudo exportar el archivo",
        variant: "destructive",
      });
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    setMainType("");
    setIsDetailed(false);
    setCorte("actual");
    setSelectedUserId(null);
    setSelectedPointId(null);
    setSelectedCurrencyId(null);
    setEstado(null);
    setMetodoEntrega(null);
    setUserSearch("");
    setReportData([]);
    setError(null);

    // Resetear fechas a últimos 7 días
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  };

  // Helpers de visibilidad
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
    <div className="w-full p-2 sm:p-3 md:p-4 space-y-4 sm:space-y-6">
      {/* Header mejorado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            📊 Reportes Generales
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Genera reportes detallados y exporta datos a Excel de forma
            profesional
          </p>
        </div>
        <Button
          variant="outline"
          onClick={clearFilters}
          className="shrink-0 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Limpiar Filtros
        </Button>
      </div>

      {/* Filtros mejorados */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-primary" />
            Configuración del Reporte
          </CardTitle>
          <CardDescription className="text-base">
            Configura los parámetros para generar tu reporte personalizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sección 1: Configuración Principal */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
              Configuración Principal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  Tipo de Reporte *
                </Label>
                <Select
                  value={mainType}
                  onValueChange={(v) => {
                    setMainType(isMainReportType(v) ? v : "");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exchanges">📊 Cambios</SelectItem>
                    <SelectItem value="transfers">💸 Transferencias</SelectItem>
                    <SelectItem value="balances">💰 Saldos</SelectItem>
                    <SelectItem value="users">👥 Actividad Usuarios</SelectItem>
                    <SelectItem value="worktime">
                      ⏰ Tiempo de Trabajo
                    </SelectItem>
                    <SelectItem value="accounting_movements">
                      📋 Movimientos Contables
                    </SelectItem>
                    <SelectItem value="point_assignments">
                      📍 Asignaciones de Punto
                    </SelectItem>
                    <SelectItem value="summary">📈 Resumen General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Configuración específica por tipo */}
              {(mainType === "exchanges" || mainType === "transfers") && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Nivel de Detalle
                  </Label>
                  <Select
                    value={isDetailed ? "detalle" : "resumen"}
                    onValueChange={(v) => setIsDetailed(v === "detalle")}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resumen">📋 Resumen</SelectItem>
                      <SelectItem value="detalle">🔍 Detallado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mainType === "balances" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Corte</Label>
                  <Select
                    value={corte}
                    onValueChange={(v) => setCorte(v as "actual" | "eod")}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">🔄 Actual</SelectItem>
                      <SelectItem value="eod">🌅 Fin de Día</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Sección 2: Rango de Fechas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
              Rango de Fechas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4 text-primary" />
                  Fecha Desde *
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4 text-primary" />
                  Fecha Hasta *
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Filtros Opcionales */}
          {(showUserFilter ||
            showPointFilter ||
            showCurrencyFilter ||
            showEstadoFilter ||
            showMetodoEntregaFilter) && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                Filtros Opcionales
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Usuario mejorado */}
                {showUserFilter && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Users className="w-4 h-4 text-primary" />
                      Usuario
                      {users.length === 0 && (
                        <Badge variant="outline" className="ml-2">
                          Cargando...
                        </Badge>
                      )}
                      {users.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {users.length} disponibles
                        </Badge>
                      )}
                    </Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="🔍 Buscar por nombre o usuario..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="h-10"
                        disabled={users.length === 0}
                      />
                      <Select
                        value={selectedUserId || ""}
                        onValueChange={(v) =>
                          setSelectedUserId(v === "ALL" ? null : v)
                        }
                        disabled={users.length === 0}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={users.length === 0 ? "Cargando usuarios..." : "Todos los usuarios"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="ALL">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Todos los usuarios
                            </div>
                          </SelectItem>
                          {filteredUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary rounded-full" />
                                <span className="font-medium">{u.nombre}</span>
                                <span className="text-muted-foreground text-xs">
                                  @{u.username}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Punto */}
                {showPointFilter && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="w-4 h-4 text-primary" />
                      Punto de Atención
                      {points.length === 0 && (
                        <Badge variant="outline" className="ml-2">
                          Cargando...
                        </Badge>
                      )}
                      {points.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {points.length} disponibles
                        </Badge>
                      )}
                    </Label>
                    <Select
                      value={selectedPointId || ""}
                      onValueChange={(v) =>
                        setSelectedPointId(v === "ALL" ? null : v)
                      }
                      disabled={points.length === 0}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={points.length === 0 ? "Cargando puntos..." : "Todos los puntos"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Todos los puntos
                          </div>
                        </SelectItem>
                        {points.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              {p.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Moneda */}
                {showCurrencyFilter && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Coins className="w-4 h-4 text-primary" />
                      Moneda
                    </Label>
                    <Select
                      value={selectedCurrencyId || ""}
                      onValueChange={(v) =>
                        setSelectedCurrencyId(v === "ALL" ? null : v)
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Todas las monedas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4" />
                            Todas las monedas
                          </div>
                        </SelectItem>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                              {c.codigo}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Estado */}
                {showEstadoFilter && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Estado</Label>
                    <Select
                      value={estado || ""}
                      onValueChange={(v) => setEstado(v === "ALL" ? null : v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        {mainType === "exchanges" && (
                          <>
                            <SelectItem value="PENDIENTE">
                              🟡 PENDIENTE
                            </SelectItem>
                            <SelectItem value="COMPLETADO">
                              🟢 COMPLETADO
                            </SelectItem>
                          </>
                        )}
                        {mainType === "transfers" && (
                          <>
                            <SelectItem value="PENDIENTE">
                              🟡 PENDIENTE
                            </SelectItem>
                            <SelectItem value="APROBADO">
                              🟢 APROBADO
                            </SelectItem>
                            <SelectItem value="RECHAZADO">
                              🔴 RECHAZADO
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Método de entrega */}
                {showMetodoEntregaFilter && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Método de Entrega
                    </Label>
                    <Select
                      value={metodoEntrega || ""}
                      onValueChange={(v) =>
                        setMetodoEntrega(
                          v === "ALL" ? null : isMetodoEntrega(v) ? v : null
                        )
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Todos los métodos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los métodos</SelectItem>
                        <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                        <SelectItem value="transferencia">
                          🏦 Transferencia
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones de acción mejorados */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
            <Button
              onClick={generateReport}
              disabled={loading || !effectiveReportType || !dateFrom || !dateTo}
              className="flex-1 sm:flex-none h-11 px-6"
              size="lg"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart2 className="w-4 h-4 mr-2" />
              )}
              {loading ? "Generando..." : "Generar Reporte"}
            </Button>

            <Button
              variant="outline"
              onClick={exportReport}
              disabled={reportData.length === 0}
              className="h-11 px-6"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados mejorados */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-5 h-5 text-primary" />
                Resultados del Reporte
              </CardTitle>
              <CardDescription className="text-base mt-1">
                {reportData.length > 0
                  ? `Se encontraron ${reportData.length} registros para el período seleccionado`
                  : "Los resultados aparecerán aquí después de generar un reporte"}
              </CardDescription>
            </div>
            {reportData.length > 0 && (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {reportData.length} registros
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                <div>
                  <p className="text-lg font-medium">Generando reporte...</p>
                  <p className="text-sm text-muted-foreground">
                    Esto puede tomar unos momentos dependiendo del rango de
                    fechas
                  </p>
                </div>
              </div>
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <BarChart2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                Sin datos para mostrar
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Selecciona un tipo de reporte y configura las fechas para
                comenzar a generar reportes
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPIs mejorados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => (
                  <Card
                    key={index}
                    className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {kpi.icon}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">
                          {kpi.label}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {typeof kpi.value === "number"
                          ? kpi.value.toLocaleString("es-EC")
                          : kpi.value}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              {/* Tabla de datos mejorada */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Datos Detallados</h4>
                  <div className="text-sm text-muted-foreground">
                    Desplázate horizontalmente para ver más columnas
                  </div>
                </div>

                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="max-h-[600px] overflow-y-auto">
                      <table className="w-full min-w-full">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                          <tr>
                            {reportData.length > 0 &&
                              Object.keys(reportData[0]).map((key) => (
                                <th
                                  key={key}
                                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b"
                                >
                                  {key.replace(/_/g, " ")}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {reportData.map((row, index) => (
                            <tr
                              key={index}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              {Object.entries(row).map(([key, value], cellIndex) => {
                                // Formateo especial para reporte worktime
                                if (
                                  effectiveReportType === "worktime" &&
                                  ["entrada", "almuerzo", "regreso", "salida"].includes(key) &&
                                  typeof value === "string"
                                ) {
                                  return (
                                    <td
                                      key={cellIndex}
                                      className="px-4 py-3 text-sm whitespace-nowrap"
                                    >
                                      {value ? formatGyeTime(value) : ""}
                                    </td>
                                  );
                                }
                                if (
                                  effectiveReportType === "worktime" &&
                                  key === "date" &&
                                  typeof value === "string"
                                ) {
                                  return (
                                    <td
                                      key={cellIndex}
                                      className="px-4 py-3 text-sm whitespace-nowrap"
                                    >
                                      {value ? formatGyeDate(value) : ""}
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={cellIndex}
                                    className="px-4 py-3 text-sm whitespace-nowrap"
                                  >
                                    <div
                                      className="max-w-[200px] truncate"
                                      title={String(value || "")}
                                    >
                                      {typeof value === "number"
                                        ? value.toLocaleString("es-EC", {
                                            minimumFractionDigits:
                                              value % 1 === 0 ? 0 : 2,
                                            maximumFractionDigits: 2,
                                          })
                                        : String(value || "")}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsImproved;
