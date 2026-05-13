import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  Building2,
  Coins,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Calendar,
  MapPin,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Package,
  ClipboardCheck,
} from "lucide-react";
import {
  adminDashboardService,
  DashboardStats,
  CierreReciente,
  ActividadHora,
  PuntoEstado,
} from "../../services/adminDashboardService";

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsuarios: 0,
    totalPuntos: 0,
    totalMonedas: 0,
    operadoresActivos: 0,
    transaccionesHoy: 0,
    transferenciasHoy: 0,
    serviciosHoy: 0,
    cierresPendientes: 0,
    aperturasPendientes: 0,
    diferenciasHoy: 0,
  });
  const [cierresRecientes, setCierresRecientes] = useState<CierreReciente[]>([]);
  const [actividad, setActividad] = useState<ActividadHora[]>([]);
  const [puntosEstado, setPuntosEstado] = useState<{
    operativos: number;
    enCierre: number;
    cerrados: number;
    detalle: PuntoEstado[];
  }>({ operativos: 0, enCierre: 0, cerrados: 0, detalle: [] });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await adminDashboardService.getStats();
      if (error || !data) {
        toast.error(error || "Error cargando dashboard");
        return;
      }
      setStats(data.stats);
      setCierresRecientes(data.cierresRecientes);
      setActividad(data.actividad);
      setPuntosEstado(data.puntosEstado);
      setLastUpdate(new Date());
    } catch {
      toast.error("Error inesperado cargando dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Guayaquil",
    });
  };

  const maxTotal = Math.max(
    1,
    ...actividad.map((a) => a.cambios + a.transferencias + a.servicios)
  );

  return (
    <div className="w-full h-full animate-fade-in">
      <div className="w-full mx-auto max-w-none p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              📊 Panel de Administración
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Vista general del sistema y métricas clave en tiempo real
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadDashboardData}
            disabled={loading}
            className="shrink-0 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard
            title="Total Usuarios"
            value={stats.totalUsuarios}
            description={`${stats.operadoresActivos} operadores activos`}
            icon={Users}
            color="blue"
            loading={loading}
          />
          <StatCard
            title="Puntos Activos"
            value={stats.totalPuntos}
            description={`${puntosEstado.operativos} operativos`}
            icon={Building2}
            color="green"
            loading={loading}
          />
          <StatCard
            title="Monedas"
            value={stats.totalMonedas}
            description="Divisas activas"
            icon={Coins}
            color="amber"
            loading={loading}
          />
          <StatCard
            title="Transacciones Hoy"
            value={stats.transaccionesHoy}
            description={`${stats.transferenciasHoy} transfer + ${stats.serviciosHoy} servicios`}
            icon={ArrowRightLeft}
            color="indigo"
            loading={loading}
          />
        </div>

        {/* Alertas */}
        {stats.diferenciasHoy > 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <h4 className="font-medium text-amber-800">
                Diferencias en Cierres Detectadas
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Se han detectado{" "}
                <strong>{stats.diferenciasHoy} cierres</strong> con diferencias
                entre el conteo físico y el saldo teórico.
              </p>
            </div>
          </div>
        )}

        {stats.aperturasPendientes > 0 && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-800">
                Aperturas Pendientes
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                Hay <strong>{stats.aperturasPendientes} aperturas</strong>{" "}
                pendientes de aprobación.
              </p>
            </div>
          </div>
        )}

        {/* Grid Principal */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Columna Izquierda */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Actividad del Día */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-primary" />
                  Actividad del Día (por hora)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : actividad.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Sin actividad registrada hoy
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-end gap-1 h-40">
                      {actividad.map((item, index) => {
                        const total =
                          item.cambios + item.transferencias + item.servicios;
                        const height =
                          maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                        return (
                          <div
                            key={index}
                            className="flex-1 flex flex-col items-center gap-1 group"
                          >
                            <div className="relative w-full flex items-end justify-center">
                              <div
                                className="w-full bg-primary/20 rounded-t transition-all duration-300 group-hover:bg-primary/30"
                                style={{ height: `${Math.max(height, 2)}%` }}
                              />
                              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                {item.hora}: {total} ops
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {item.hora.split(":")[0]}h
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span className="text-muted-foreground">Cambios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span className="text-muted-foreground">
                          Transferencias
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-amber-500" />
                        <span className="text-muted-foreground">Servicios</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cierres Recientes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  Cierres Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : cierresRecientes.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No hay cierres registrados recientemente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cierresRecientes.map((cierre) => (
                      <div
                        key={cierre.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              cierre.estado === "perfecto"
                                ? "bg-green-100"
                                : cierre.estado === "sobrante"
                                ? "bg-blue-100"
                                : "bg-red-100"
                            }`}
                          >
                            {cierre.estado === "perfecto" ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : cierre.estado === "sobrante" ? (
                              <ArrowUpRight className="w-5 h-5 text-blue-600" />
                            ) : (
                              <ArrowDownRight className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {cierre.punto}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{cierre.operador}</span>
                              <span>•</span>
                              <span>{formatDate(cierre.fecha)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              cierre.estado === "perfecto"
                                ? "default"
                                : cierre.estado === "sobrante"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {cierre.estado === "perfecto"
                              ? "Perfecto"
                              : cierre.estado === "sobrante"
                              ? "Sobrante"
                              : "Faltante"}
                          </Badge>
                          {cierre.diferencia !== 0 && (
                            <p
                              className={`text-sm font-medium mt-1 ${
                                cierre.diferencia > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {cierre.diferencia > 0 ? "+" : ""}
                              {formatMoney(cierre.diferencia)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-4 sm:space-y-6">
            {/* Estado de Puntos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                  Estado de Puntos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium text-green-800">
                        Operativos
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-800">
                      {puntosEstado.operativos}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-medium text-amber-800">
                        En actividad
                      </span>
                    </div>
                    <span className="text-lg font-bold text-amber-800">
                      {puntosEstado.enCierre}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="font-medium text-gray-600">
                        Sin actividad
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-600">
                      {puntosEstado.cerrados}
                    </span>
                  </div>
                </div>

                {/* Detalle por punto */}
                {puntosEstado.detalle.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Detalle por punto
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {puntosEstado.detalle.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate">{p.nombre}</span>
                          <div className="flex items-center gap-2">
                            {p.cambiosHoy > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {p.cambiosHoy} cambios
                              </Badge>
                            )}
                            <div
                              className={`w-2 h-2 rounded-full ${
                                p.estado === "operativo"
                                  ? "bg-green-500"
                                  : p.estado === "en_cierre"
                                  ? "bg-amber-500"
                                  : "bg-gray-400"
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Operaciones Hoy */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Operaciones Hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-sm">Cambios de Divisa</span>
                    </div>
                    <span className="font-bold">{stats.transaccionesHoy}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Transferencias</span>
                    </div>
                    <span className="font-bold">{stats.transferenciasHoy}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-600" />
                      <span className="text-sm">Servicios Externos</span>
                    </div>
                    <span className="font-bold">{stats.serviciosHoy}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Última Actualización */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Última actualización</p>
                    <p className="font-medium text-foreground">
                      {lastUpdate.toLocaleTimeString("es-EC")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

/* StatCard component */
interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "indigo";
  loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  color,
  loading,
}) => {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
  };

  return (
    <Card className={`border ${colorMap[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium opacity-80">{title}</span>
        </div>
        {loading ? (
          <div className="animate-pulse h-8 w-20 bg-current/20 rounded" />
        ) : (
          <div className="text-2xl font-bold">{value.toLocaleString("es-EC")}</div>
        )}
        <p className="text-xs opacity-70 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
