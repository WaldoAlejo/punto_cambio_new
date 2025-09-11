import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User as UserType } from "../../types";
import { scheduleService } from "../../services/scheduleService";

interface ActiveSchedule {
  id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  estado: string;
  usuario: {
    id: string;
    nombre: string;
    username: string;
  };
  puntoAtencion: {
    id: string;
    nombre: string;
  };
}

interface ActivePointsReportProps {
  user: UserType;
}

const AUTO_REFRESH_INTERVAL = 0; // Pon aquí los milisegundos si quieres refresco automático, ej: 60000 para 1 min.

const ActivePointsReport = ({ user: _user }: ActivePointsReportProps) => {
  const [activeSchedules, setActiveSchedules] = useState<ActiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();
  const refreshTimeout = useRef<number | undefined>(undefined);

  const loadActiveSchedules = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { schedules, error } = await scheduleService.getAllSchedules({
        fecha: new Date().toISOString().slice(0, 10),
        estados: ["ACTIVO", "ALMUERZO"],
        limit: 500,
      });
      if (error) {
        setErrorMsg(error);
        toast({
          title: "Error",
          description: `Error al cargar horarios activos: ${error}`,
          variant: "destructive",
        });
        setActiveSchedules([]);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const activesOnly = schedules
        .filter(
          (schedule) =>
            ["ACTIVO", "ALMUERZO"].includes(schedule.estado) &&
            !schedule.fecha_salida &&
            new Date(schedule.fecha_inicio).toISOString().split("T")[0] ===
              today &&
            schedule.usuario &&
            schedule.puntoAtencion
        )
        .map((schedule) => {
          if (!schedule.usuario || !schedule.puntoAtencion) return null;
          return {
            id: schedule.id,
            fecha_inicio: schedule.fecha_inicio,
            fecha_almuerzo: schedule.fecha_almuerzo,
            fecha_regreso: schedule.fecha_regreso,
            fecha_salida: schedule.fecha_salida,
            ubicacion_inicio: schedule.ubicacion_inicio,
            ubicacion_salida: schedule.ubicacion_salida,
            estado: schedule.estado,
            usuario: {
              id: schedule.usuario.id,
              nombre: schedule.usuario.nombre,
              username: schedule.usuario.username,
            },
            puntoAtencion: {
              id: schedule.puntoAtencion.id,
              nombre: schedule.puntoAtencion.nombre,
            },
          };
        })
        .filter(Boolean) as ActiveSchedule[];

      setActiveSchedules(activesOnly);

      toast({
        title: "Datos actualizados",
        description: `Se encontraron ${activesOnly.length} usuarios activos`,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los datos de usuarios activos";
      setErrorMsg(msg);
      toast({
        title: "Error de conexión",
        description: msg,
        variant: "destructive",
      });
      setActiveSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadActiveSchedules();

    // Opcional: refresco automático si lo deseas (deja AUTO_REFRESH_INTERVAL en 0 si NO quieres)
    if (AUTO_REFRESH_INTERVAL > 0) {
      refreshTimeout.current = window.setTimeout(
        loadActiveSchedules,
        AUTO_REFRESH_INTERVAL
      );
    }
    return () => {
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
    };
  }, [loadActiveSchedules]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "No registrado";
    return new Date(dateString).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getWorkingHours = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getLocationString = (location?: {
    lat: number;
    lng: number;
    direccion?: string;
  }) => {
    if (!location) return "No disponible";
    return (
      location.direccion ||
      `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando usuarios activos...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Usuarios Activos</h2>
          <p className="text-gray-600">
            Monitoreo en tiempo real de jornadas laborales -{" "}
            {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadActiveSchedules} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const base =
                  (import.meta as any).env?.VITE_API_URL ||
                  "http://35.238.95.118/api";
                const today = new Date().toISOString().slice(0, 10);
                const url = `${base}/schedules?fecha=${today}&estados=ACTIVO,ALMUERZO&limit=500&format=csv`;
                const token = localStorage.getItem("authToken");
                const res = await fetch(url, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error("No se pudo exportar CSV");
                const blob = await res.blob();
                const dlUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = dlUrl;
                a.download = `usuarios_activos_${today}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(dlUrl);
              } catch (e) {
                toast({
                  title: "Error",
                  description: "No se pudo exportar el CSV",
                  variant: "destructive",
                });
              }
            }}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {activeSchedules.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">
                No hay usuarios trabajando actualmente
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {activeSchedules.map((schedule) => (
            <Card key={schedule.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {schedule.usuario.nombre}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        @{schedule.usuario.username}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">
                      {schedule.puntoAtencion.nombre}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Trabajando: {getWorkingHours(schedule.fecha_inicio)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="schedule" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="schedule">Horarios</TabsTrigger>
                    <TabsTrigger value="location">Ubicaciones</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="schedule"
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4"
                  >
                    {[
                      {
                        label: "Entrada",
                        value: schedule.fecha_inicio,
                        color: "text-green-600",
                      },
                      {
                        label: "Almuerzo",
                        value: schedule.fecha_almuerzo,
                        color: "text-orange-600",
                      },
                      {
                        label: "Regreso",
                        value: schedule.fecha_regreso,
                        color: "text-blue-600",
                      },
                      {
                        label: "Salida",
                        value: schedule.fecha_salida,
                        color: "text-red-600",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          {label}
                        </div>
                        <p className={`font-medium ${color}`}>
                          {formatTime(value)}
                        </p>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent
                    value="location"
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-1" />
                        Ubicación de Entrada
                      </div>
                      <p className="text-sm bg-green-50 p-2 rounded border">
                        {getLocationString(schedule.ubicacion_inicio)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-1" />
                        Ubicación de Salida
                      </div>
                      <p className="text-sm bg-red-50 p-2 rounded border">
                        {getLocationString(schedule.ubicacion_salida)}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivePointsReport;
