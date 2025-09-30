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
  selectedPoint?: any;
}

const ReportsImproved: React.FC<ReportsProps> = ({ user: _user }) => {
  // Estados principales
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

  const [isDetailed, setIsDetailed] = useState<boolean>(false);
  const [corte, setCorte] = useState<"actual" | "eod">("actual");

  // Fechas
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Estados de carga y datos
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
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
            if (!usersRes.error) setUsers(usersRes.users);
          }
          if (points.length === 0) {
            const pointsRes = await pointService.getAllPoints();
            if (!pointsRes.error) {
              setPoints(
                pointsRes.points.map((p: any) => ({
                  id: p.id,
                  nombre: p.nombre,
                }))
              );
            }
          }
        }

        if (needCurrencies && currencies.length === 0) {
          const currenciesRes = await currencyService.getAllCurrencies();
          if (!currenciesRes.error) {
            setCurrencies(
              currenciesRes.currencies.map((c: any) => ({
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
    const sumByKeys = (arr: any[], keys: string[]) =>
      arr.reduce(
        (acc, r) =>
          acc + keys.reduce((s, k) => s + (Number((r as any)?.[k]) || 0), 0),
        0
      );
    const countBy = (arr: any[], key: string, val: any) =>
      arr.filter((r) => (r as any)?.[key] === val).length;

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
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://34.70.184.11:3001/api";

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

      console.log("Enviando solicitud de reporte:", { apiUrl, requestBody });

      const response = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("Respuesta del servidor:", data);

      if (!response.ok) {
        throw new Error(
          data.error || `Error ${response.status}: ${response.statusText}`
        );
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
    } catch (error) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Reportes Generales
          </h1>
          <p className="text-muted-foreground">
            Genera reportes detallados y exporta datos a Excel
          </p>
        </div>
        <Button variant="outline" onClick={clearFilters}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Limpiar Filtros
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Reporte
          </CardTitle>
          <CardDescription>
            Configura los parámetros para generar tu reporte personalizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fila 1: Tipo y configuración */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Tipo de Reporte *
              </Label>
              <Select
                value={mainType}
                onValueChange={(v) => setMainType(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exchanges">📊 Cambios</SelectItem>
                  <SelectItem value="transfers">💸 Transferencias</SelectItem>
                  <SelectItem value="balances">💰 Saldos</SelectItem>
                  <SelectItem value="users">👥 Actividad Usuarios</SelectItem>
                  <SelectItem value="worktime">⏰ Tiempo de Trabajo</SelectItem>
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
                <Label>Nivel de Detalle</Label>
                <Select
                  value={isDetailed ? "detalle" : "resumen"}
                  onValueChange={(v) => setIsDetailed(v === "detalle")}
                >
                  <SelectTrigger>
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
                <Label>Tipo de Corte</Label>
                <Select
                  value={corte}
                  onValueChange={(v) => setCorte(v as "actual" | "eod")}
                >
                  <SelectTrigger>
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

          {/* Fila 2: Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha Desde *
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha Hasta *
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Fila 3: Filtros opcionales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Usuario */}
            {showUserFilter && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuario
                </Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar usuario..."
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
                      <SelectValue placeholder="Todos los usuarios" />
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
              </div>
            )}

            {/* Punto */}
            {showPointFilter && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Punto de Atención
                </Label>
                <Select
                  value={selectedPointId || ""}
                  onValueChange={(v) =>
                    setSelectedPointId(v === "ALL" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los puntos" />
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
              </div>
            )}

            {/* Moneda */}
            {showCurrencyFilter && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Moneda
                </Label>
                <Select
                  value={selectedCurrencyId || ""}
                  onValueChange={(v) =>
                    setSelectedCurrencyId(v === "ALL" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las monedas" />
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
              </div>
            )}

            {/* Estado */}
            {showEstadoFilter && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={estado || ""}
                  onValueChange={(v) => setEstado(v === "ALL" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {mainType === "exchanges" && (
                      <>
                        <SelectItem value="PENDIENTE">🟡 PENDIENTE</SelectItem>
                        <SelectItem value="COMPLETADO">
                          🟢 COMPLETADO
                        </SelectItem>
                      </>
                    )}
                    {mainType === "transfers" && (
                      <>
                        <SelectItem value="PENDIENTE">🟡 PENDIENTE</SelectItem>
                        <SelectItem value="APROBADO">🟢 APROBADO</SelectItem>
                        <SelectItem value="RECHAZADO">🔴 RECHAZADO</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Método de entrega */}
            {showMetodoEntregaFilter && (
              <div className="space-y-2">
                <Label>Método de Entrega</Label>
                <Select
                  value={metodoEntrega || ""}
                  onValueChange={(v) =>
                    setMetodoEntrega(v === "ALL" ? null : (v as any))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                    <SelectItem value="transferencia">
                      🏦 Transferencia
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              onClick={generateReport}
              disabled={loading || !effectiveReportType || !dateFrom || !dateTo}
              className="flex-1 sm:flex-none"
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
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resultados del Reporte
          </CardTitle>
          <CardDescription>
            {reportData.length > 0
              ? `Se encontraron ${reportData.length} registros`
              : "Los resultados aparecerán aquí después de generar un reporte"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-lg font-medium">Generando reporte...</p>
                <p className="text-sm text-muted-foreground">
                  Esto puede tomar unos momentos
                </p>
              </div>
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart2 className="w-12 h-12 mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">
                Sin datos para mostrar
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Selecciona un tipo de reporte y fechas para comenzar
              </p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {kpis.map((kpi, index) => (
                  <Card
                    key={index}
                    className="bg-gradient-to-br from-primary/5 to-primary/10"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {kpi.icon}
                        <span className="text-sm font-medium text-muted-foreground">
                          {kpi.label}
                        </span>
                      </div>
                      <div className="text-2xl font-bold">
                        {typeof kpi.value === "number"
                          ? kpi.value.toLocaleString("es-EC")
                          : kpi.value}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator className="mb-6" />

              {/* Tabla de datos */}
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {reportData.length > 0 &&
                          Object.keys(reportData[0]).map((key) => (
                            <th
                              key={key}
                              className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap"
                            >
                              {key.replace(/_/g, " ").toUpperCase()}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-muted/30 border-b border-border/50"
                        >
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 text-sm">
                              {typeof value === "number"
                                ? value.toLocaleString("es-EC")
                                : String(value || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsImproved;
