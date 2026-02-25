import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsCard, StatsGroup } from "@/components/ui/stats-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "../../services/apiService";

// Types
interface DashboardStats {
  totalUsuarios: number;
  totalPuntos: number;
  totalMonedas: number;
  transaccionesHoy: number;
  diferenciasHoy: number;
  cierresPendientes: number;
}

interface CierreReciente {
  id: string;
  fecha: string;
  punto: string;
  operador: string;
  moneda: string;
  diferencia: number;
  estado: "perfecto" | "sobrante" | "faltante";
}

interface ActividadDiaria {
  hora: string;
  cambios: number;
  transferencias: number;
  servicios: number;
}

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsuarios: 0,
    totalPuntos: 0,
    totalMonedas: 0,
    transaccionesHoy: 0,
    diferenciasHoy: 0,
    cierresPendientes: 0,
  });
  const [cierresRecientes, setCierresRecientes] = useState<CierreReciente[]>([]);
  const [actividad, setActividad] = useState<ActividadDiaria[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Simular datos para el dashboard (en producción vendrían de la API)
      // const response = await apiService.get('/admin/dashboard');
      
      // Datos de ejemplo
      setStats({
        totalUsuarios: 24,
        totalPuntos: 8,
        totalMonedas: 12,
        transaccionesHoy: 156,
        diferenciasHoy: 3,
        cierresPendientes: 2,
      });

      setCierresRecientes([
        {
          id: "1",
          fecha: "2025-02-24T18:30:00",
          punto: "Oficina Principal",
          operador: "Juan Pérez",
          moneda: "USD",
          diferencia: 15.5,
          estado: "sobrante",
        },
        {
          id: "2",
          fecha: "2025-02-24T18:15:00",
          punto: "Sucursal Norte",
          operador: "María García",
          moneda: "EUR",
          diferencia: -8.25,
          estado: "faltante",
        },
        {
          id: "3",
          fecha: "2025-02-24T17:45:00",
          punto: "Oficina Principal",
          operador: "Carlos Ruiz",
          moneda: "USD",
          diferencia: 0,
          estado: "perfecto",
        },
      ]);

      // Generar datos de actividad por hora
      const horas = Array.from({ length: 12 }, (_, i) => `${8 + i}:00`);
      setActividad(
        horas.map((hora) => ({
          hora,
          cambios: Math.floor(Math.random() * 20) + 5,
          transferencias: Math.floor(Math.random() * 10) + 2,
          servicios: Math.floor(Math.random() * 8) + 1,
        }))
      );

      setLastUpdate(new Date());
    } catch (error) {
      toast.error("Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
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
    });
  };

  return (
    <div className="w-full h-full animate-fade-in">
      <PageContainer maxWidth="full" padding="default">
        {/* Header */}
        <PageHeader
          title="Panel de Administración"
          description="Vista general del sistema y métricas clave"
          icon={BarChart3}
          action={{
            label: "Actualizar",
            onClick: loadDashboardData,
            icon: RefreshCw,
            variant: "outline",
          }}
        />

        {/* Stats Grid - Responsive: 1 col móvil, 2 col tablet, 4 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
          <StatsCard
            title="Total Usuarios"
            value={stats.totalUsuarios}
            description="Usuarios activos"
            icon={Users}
            trend={{ value: 12, direction: "up", label: "vs mes" }}
            loading={loading}
          />
          <StatsCard
            title="Puntos"
            value={stats.totalPuntos}
            description="Ubicaciones"
            icon={Building2}
            loading={loading}
          />
          <StatsCard
            title="Monedas"
            value={stats.totalMonedas}
            description="Divisas"
            icon={Coins}
            loading={loading}
          />
          <StatsCard
            title="Transacciones"
            value={stats.transaccionesHoy}
            description="Hoy"
            icon={ArrowRightLeft}
            trend={{ value: 8, direction: "up", label: "vs ayer" }}
            loading={loading}
          />
        </div>

        {/* Alertas y Estado */}
        {stats.diferenciasHoy > 0 && (
          <div className="mb-6">
            <div className="alert-soft-warning rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium">Diferencias en Cierres Detectadas</h4>
                <p className="text-sm mt-1">
                  Se han detectado <strong>{stats.diferenciasHoy} cierres</strong> con diferencias entre el conteo físico y el saldo teórico. 
                  Revise el informe de ajustes contables para más detalles.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid Principal - Responsive */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Columna Izquierda - Actividad */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Gráfico de Actividad */}
            <Card hover>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-primary" />
                  Actividad del Día
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Gráfico de barras simple */}
                    <div className="flex items-end gap-1 h-40">
                      {actividad.map((item, index) => {
                        const total = item.cambios + item.transferencias + item.servicios;
                        const maxTotal = Math.max(...actividad.map(a => a.cambios + a.transferencias + a.servicios));
                        const height = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                        
                        return (
                          <div
                            key={index}
                            className="flex-1 flex flex-col items-center gap-1 group"
                          >
                            <div className="relative w-full flex items-end justify-center">
                              <div
                                className="w-full bg-primary/20 rounded-t transition-all duration-300 group-hover:bg-primary/30"
                                style={{ height: `${height}%` }}
                              >
                                <div
                                  className="w-full bg-primary rounded-t"
                                  style={{ height: `${(item.cambios / total) * 100}%` }}
                                />
                              </div>
                              {/* Tooltip */}
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
                    
                    {/* Leyenda */}
                    <div className="flex items-center justify-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span className="text-muted-foreground">Cambios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[hsl(145,55%,42%)]" />
                        <span className="text-muted-foreground">Transferencias</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[hsl(32,95%,55%)]" />
                        <span className="text-muted-foreground">Servicios</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cierres Recientes */}
            <Card hover>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  Cierres Recientes
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary">
                  Ver todos
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : cierresRecientes.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-[hsl(145,55%,42%)] mx-auto mb-3" />
                    <p className="text-muted-foreground">No hay cierres registrados hoy</p>
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
                                ? "bg-[hsl(145,60%,96%)]"
                                : cierre.estado === "sobrante"
                                ? "bg-[hsl(217,100%,97%)]"
                                : "bg-[hsl(0,85%,97%)]"
                            }`}
                          >
                            {cierre.estado === "perfecto" ? (
                              <CheckCircle2 className="w-5 h-5 text-[hsl(145,55%,42%)]" />
                            ) : cierre.estado === "sobrante" ? (
                              <ArrowUpRight className="w-5 h-5 text-[hsl(217,70%,45%)]" />
                            ) : (
                              <ArrowDownRight className="w-5 h-5 text-[hsl(0,72%,51%)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{cierre.punto}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{cierre.operador}</span>
                              <span>•</span>
                              <span>{formatDate(cierre.fecha)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge
                            variant={
                              cierre.estado === "perfecto"
                                ? "success"
                                : cierre.estado === "sobrante"
                                ? "info"
                                : "error"
                            }
                          >
                            {cierre.estado === "perfecto"
                              ? "Perfecto"
                              : cierre.estado === "sobrante"
                              ? "Sobrante"
                              : "Faltante"}
                          </StatusBadge>
                          {cierre.diferencia !== 0 && (
                            <p
                              className={`text-sm font-medium mt-1 ${
                                cierre.diferencia > 0 ? "text-[hsl(145,55%,42%)]" : "text-[hsl(0,72%,51%)]"
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

          {/* Columna Derecha - Accesos Rápidos y Estado */}
          <div className="space-y-4 sm:space-y-6">
            {/* Accesos Rápidos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Accesos Rápidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2 sm:gap-3">
                  <QuickAccessButton
                    icon={Users}
                    label="Usuarios"
                    color="primary"
                    onClick={() => {}}
                  />
                  <QuickAccessButton
                    icon={Building2}
                    label="Puntos"
                    color="success"
                    onClick={() => {}}
                  />
                  <QuickAccessButton
                    icon={Coins}
                    label="Monedas"
                    color="warning"
                    onClick={() => {}}
                  />
                  <QuickAccessButton
                    icon={DollarSign}
                    label="Saldos"
                    color="info"
                    onClick={() => {}}
                  />
                  <QuickAccessButton
                    icon={ArrowRightLeft}
                    label="Transferencias"
                    color="primary"
                    onClick={() => {}}
                  />
                  <QuickAccessButton
                    icon={Activity}
                    label="Reportes"
                    color="success"
                    onClick={() => {}}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Estado de Puntos */}
            <Card hover>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                  Estado de Puntos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(145,60%,96%)] border border-[hsl(145,50%,85%)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[hsl(145,55%,42%)] animate-pulse" />
                      <span className="font-medium text-[hsl(145,55%,32%)]">Operativos</span>
                    </div>
                    <span className="text-lg font-bold text-[hsl(145,55%,32%)]">6</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(32,100%,96%)] border border-[hsl(32,80%,82%)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[hsl(32,95%,55%)]" />
                      <span className="font-medium text-[hsl(32,80%,35%)]">En cierre</span>
                    </div>
                    <span className="text-lg font-bold text-[hsl(32,80%,35%)]">2</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <span className="font-medium text-muted-foreground">Cerrados</span>
                    </div>
                    <span className="text-lg font-bold text-muted-foreground">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Última Actualización */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Última actualización</p>
                    <p className="font-medium text-foreground">
                      {lastUpdate.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
};

// Componente auxiliar para accesos rápidos
interface QuickAccessButtonProps {
  icon: React.ElementType;
  label: string;
  color: "primary" | "success" | "warning" | "info";
  onClick: () => void;
}

const QuickAccessButton: React.FC<QuickAccessButtonProps> = ({
  icon: Icon,
  label,
  color,
  onClick,
}) => {
  const colorClasses = {
    primary: "bg-[hsl(217,100%,97%)] text-[hsl(217,70%,45%)] hover:bg-[hsl(217,100%,94%)]",
    success: "bg-[hsl(145,60%,96%)] text-[hsl(145,55%,42%)] hover:bg-[hsl(145,60%,92%)]",
    warning: "bg-[hsl(32,100%,96%)] text-[hsl(32,95%,55%)] hover:bg-[hsl(32,100%,92%)]",
    info: "bg-[hsl(200,85%,97%)] text-[hsl(200,80%,50%)] hover:bg-[hsl(200,85%,93%)]",
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl transition-all duration-200 ${colorClasses[color]}`}
    >
      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      <span className="text-xs sm:text-sm font-medium text-center">{label}</span>
    </button>
  );
};

// Componente PageContainer local
interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  padding?: "none" | "sm" | "default" | "lg";
}

const PageContainer: React.FC<PageContainerProps> = ({
  className,
  maxWidth = "xl",
  padding = "default",
  children,
  ...props
}) => {
  const maxWidthClass = {
    sm: "max-w-3xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-7xl",
    full: "max-w-none",
  };

  const paddingClass = {
    none: "",
    sm: "p-4",
    default: "p-4 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  return (
    <div 
      className={`w-full mx-auto ${maxWidthClass[maxWidth]} ${paddingClass[padding]} ${className || ""}`} 
      {...props}
    >
      {children}
    </div>
  );
};

export default AdminDashboard;
