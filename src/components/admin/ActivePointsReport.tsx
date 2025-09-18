import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Clock,
  User,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User as UserType } from "../../types";
import { scheduleService } from "../../services/scheduleService";
import FreePointButton from "./FreePointButton";

interface ActiveSchedule {
  id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string | null;
  fecha_regreso?: string | null;
  fecha_salida?: string | null;
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  } | null;
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

const AUTO_REFRESH_INTERVAL = 0; // ms — ej: 60000 para 1 min auto-refresh

const ActivePointsReport = ({ user: _user }: ActivePointsReportProps) => {
  const [activeSchedules, setActiveSchedules] = useState<ActiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Orden y paginación
  const [sortKey, setSortKey] = useState<ColKey>("usuario");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { toast } = useToast();
  const refreshIntervalRef = useRef<number | null>(null);

  // Filtrado y ordenamiento
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
    const getTime = (v?: string | null) => (v ? new Date(v).getTime() : 0);
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

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  // Cargar datos
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
        setActiveSchedules([]);
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }

      const filtered = (schedules || [])
        .filter((s) => s.usuario && s.puntoAtencion)
        .map((s) => ({
          id: s.id,
          fecha_inicio: s.fecha_inicio,
          fecha_almuerzo: s.fecha_almuerzo,
          fecha_regreso: s.fecha_regreso,
          fecha_salida: s.fecha_salida,
          ubicacion_inicio: s.ubicacion_inicio ?? null,
          ubicacion_salida: s.ubicacion_salida ?? null,
          estado: s.estado,
          usuario: {
            id: s.usuario!.id,
            nombre: s.usuario!.nombre,
            username: s.usuario!.username,
          },
          puntoAtencion: {
            id: s.puntoAtencion!.id,
            nombre: s.puntoAtencion!.nombre,
          },
        })) as ActiveSchedule[];

      setActiveSchedules(filtered);
      setPage(1);
      toast({
        title: "Datos actualizados",
        description: `Se encontraron ${filtered.length} registros`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudieron cargar los datos";
      setErrorMsg(msg);
      setActiveSchedules([]);
      toast({
        title: "Error de conexión",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, fromDate, toDate, onlyActive]);

  // Auto-refresh seguro
  useEffect(() => {
    loadActiveSchedules();
    if (AUTO_REFRESH_INTERVAL > 0) {
      refreshIntervalRef.current = window.setInterval(
        loadActiveSchedules,
        AUTO_REFRESH_INTERVAL
      );
    }
    return () => {
      if (refreshIntervalRef.current !== null) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [loadActiveSchedules]);

  // Helpers
  const formatTime = (dateString?: string | null) =>
    dateString
      ? new Date(dateString).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No registrado";

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const getWorkingHours = (start: string, end?: string | null) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diff = e.getTime() - s.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const getLocationString = (
    loc?: { lat: number; lng: number; direccion?: string } | null
  ) =>
    loc
      ? loc.direccion || `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`
      : "No disponible";

  // Render
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando usuarios activos...</span>
      </div>
    );

  if (errorMsg)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{errorMsg}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Usuarios Activos
          </h2>
          <p className="text-gray-600">
            Monitoreo en tiempo real — {formatDate(new Date().toISOString())}
          </p>
        </div>
        <Button onClick={loadActiveSchedules} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <Label>Desde</Label>
          <Input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Buscar</Label>
          <Input
            placeholder="Usuario, username o punto"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <Label>Tamaño de página</Label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={onlyActive}
              onCheckedChange={(v) => setOnlyActive(Boolean(v))}
            />
            <Label>Solo activos (incluye ALMUERZO)</Label>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFromDate(todayStr);
              setToDate(todayStr);
              setOnlyActive(true);
              setSearchTerm("");
              setSortKey("usuario");
              setSortDir("asc");
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {/* Orden */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Label>Ordenar por</Label>
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as ColKey)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "usuario",
                "username",
                "punto",
                "entrada",
                "almuerzo",
                "regreso",
                "salida",
                "estado",
              ].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">{sortDir.toUpperCase()}</span>
        </div>
        <div className="text-sm text-gray-600">
          Mostrando {pagedData.length} de {sortedData.length}
        </div>
      </div>

      {/* Listado */}
      {sortedData.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No hay usuarios</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {pagedData.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader className="pb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">
                        {schedule.usuario.nombre}
                      </CardTitle>
                      <p className="text-sm text-gray-600 truncate">
                        @{schedule.usuario.username}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-2 shrink-0">
                    <Badge variant="secondary">
                      {schedule.puntoAtencion.nombre}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Trabajando:{" "}
                      {getWorkingHours(
                        schedule.fecha_inicio,
                        schedule.fecha_salida
                      )}
                    </p>
                    <FreePointButton
                      usuarioId={schedule.usuario.id}
                      onDone={loadActiveSchedules}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="schedule">
                    <TabsList className="grid grid-cols-2 w-full">
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
                        <div key={label}>
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
                      <div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          Ubicación Entrada
                        </div>
                        <p className="text-sm bg-green-50 p-2 rounded border">
                          {getLocationString(schedule.ubicacion_inicio)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          Ubicación Salida
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

          {/* Paginación */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-sm text-gray-600">
              Página {page} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivePointsReport;
