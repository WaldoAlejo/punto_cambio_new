import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User as UserType } from "../../types";
import { scheduleService } from "../../services/scheduleService";
import FreePointButton from "./FreePointButton";

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

type ColKey =
  | "usuario"
  | "username"
  | "punto"
  | "entrada"
  | "almuerzo"
  | "regreso"
  | "salida"
  | "estado";

const AUTO_REFRESH_INTERVAL = 0; // Pon aquí los milisegundos si quieres refresco automático, ej: 60000 para 1 min.

const ActivePointsReport = ({ user: _user }: ActivePointsReportProps) => {
  const [activeSchedules, setActiveSchedules] = useState<ActiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, _setSortKey] = useState<ColKey>("usuario");
  const [sortDir, _setSortDir] = useState<"asc" | "desc">("asc");

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activeSchedules;
    return activeSchedules.filter((s) => {
      const u = s.usuario.nombre.toLowerCase();
      const un = s.usuario.username.toLowerCase();
      const p = s.puntoAtencion.nombre.toLowerCase();
      return u.includes(term) || un.includes(term) || p.includes(term);
    });
  }, [activeSchedules, searchTerm]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    const getTime = (v?: string) => (v ? new Date(v).getTime() : 0);
    data.sort((a, b) => {
      let comp = 0;
      switch (sortKey) {
        case "usuario":
          comp = a.usuario.nombre.localeCompare(b.usuario.nombre);
          break;
        case "username":
          comp = a.usuario.username.localeCompare(b.usuario.username);
          break;
        case "punto":
          comp = a.puntoAtencion.nombre.localeCompare(b.puntoAtencion.nombre);
          break;
        case "entrada":
          comp = getTime(a.fecha_inicio) - getTime(b.fecha_inicio);
          break;
        case "almuerzo":
          comp = getTime(a.fecha_almuerzo) - getTime(b.fecha_almuerzo);
          break;
        case "regreso":
          comp = getTime(a.fecha_regreso) - getTime(b.fecha_regreso);
          break;
        case "salida":
          comp = getTime(a.fecha_salida) - getTime(b.fecha_salida);
          break;
        case "estado":
          comp = a.estado.localeCompare(b.estado);
          break;
      }
      return sortDir === "asc" ? comp : -comp;
    });
    return data;
  }, [filteredData, sortKey, sortDir]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);
  const { toast } = useToast();
  const refreshTimeout = useRef<number | undefined>(undefined);

  const loadActiveSchedules = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const estados = onlyActive
        ? ["ACTIVO", "ALMUERZO"]
        : ["ACTIVO", "ALMUERZO", "COMPLETADO"];
      const byDay = fromDate === toDate;
      const { schedules, error } = await scheduleService.getAllSchedules({
        ...(byDay ? { fecha: fromDate } : { from: fromDate, to: toDate }),
        estados,
        limit: 1000,
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

      const filtered: ActiveSchedule[] = schedules.flatMap((schedule) => {
        if (!schedule.usuario || !schedule.puntoAtencion) return [];
        return [
          {
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
          },
        ];
      });

      setActiveSchedules(filtered);

      toast({
        title: "Datos actualizados",
        description: `Se encontraron ${filtered.length} registros`,
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
  }, [toast, fromDate, toDate, onlyActive]);

  useEffect(() => {
    loadActiveSchedules();

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
  }, [loadActiveSchedules, fromDate, toDate, onlyActive]);

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
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Usuarios Activos
            </h2>
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
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={fromDate}
              max={toDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1"
              value={toDate}
              min={fromDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Usuario, username o punto"
              className="w-full border rounded px-2 py-1"
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Tamaño de página
            </label>
            <select
              className="w-full border rounded px-2 py-1"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-end justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={onlyActive}
                onChange={(e) => {
                  setPage(1);
                  setOnlyActive(e.target.checked);
                }}
              />
              Solo activos del período (incluye ALMUERZO)
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setFromDate(todayStr);
                setToDate(todayStr);
                setOnlyActive(true);
                setSearchTerm("");
                setPage(1);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
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
        <>
          <div className="grid gap-4">
            {pagedData.map((schedule) => (
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
                    <div className="text-right space-y-2">
                      <div>
                        <Badge variant="secondary" className="mb-1">
                          {schedule.puntoAtencion.nombre}
                        </Badge>
                        <p className="text-sm text-gray-600">
                          Trabajando: {getWorkingHours(schedule.fecha_inicio)}
                        </p>
                      </div>
                      {/* Botón visible solo para ADMIN/SUPER: libera el punto moviendo la jornada al principal */}
                      <FreePointButton
                        usuarioId={schedule.usuario.id}
                        onDone={loadActiveSchedules}
                      />
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
        </>
      )}
    </div>
  );
};

export default ActivePointsReport;
