import { useState, useEffect } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  LogIn,
  LogOut,
  UtensilsCrossed,
  ArrowRight,
  MapPin,
  AlertTriangle,
  ExternalLink,
  Smartphone,
  Monitor,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { User, PuntoAtencion, SalidaEspontanea } from "../../types";
import { formatGyeTime } from "@/utils/timezone";
import { scheduleService } from "@/services/scheduleService";

interface TimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  spontaneousExits: SalidaEspontanea[];
}

type EstadoFrontend = "NO_INICIADO" | "TRABAJANDO" | "ALMUERZO" | "FINALIZADO";

export interface UbicacionRegistrada {
  lat: number;
  lng: number;
  accuracy?: number;
  direccion?: string;
  dispositivo?: "MOVIL" | "DESKTOP";
  sin_gps?: boolean;        // true cuando no se pudo obtener GPS (HTTP o denegado)
  motivo_sin_gps?: string;  // razón por la que no hay GPS
}

interface JornadaEstadoBackend {
  id?: string;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: string;
  ubicacion_inicio?: UbicacionRegistrada | null;
  ubicacion_salida?: UbicacionRegistrada | null;
}

interface JornadaEstado extends Omit<JornadaEstadoBackend, "estado"> {
  estado: EstadoFrontend;
}

interface SaveScheduleResponse {
  success: boolean;
  schedule: JornadaEstadoBackend;
}

interface JornadaPayload {
  usuario_id: string;
  punto_atencion_id: string | undefined;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  ubicacion_inicio?: UbicacionRegistrada | null;
  ubicacion_salida?: UbicacionRegistrada | null;
}

function mapEstadoJornada(estado: string): EstadoFrontend {
  switch (estado) {
    case "ACTIVO":    return "TRABAJANDO";
    case "ALMUERZO":  return "ALMUERZO";
    case "COMPLETADO":
    case "CANCELADO": return "FINALIZADO";
    default:          return "NO_INICIADO";
  }
}

/** Detecta si el navegador es móvil */
function detectarDispositivo(): "MOVIL" | "DESKTOP" {
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
    ? "MOVIL"
    : "DESKTOP";
}

/** Coordenadas claramente inválidas: null island (0,0) o sin valores */
function coordenadasInvalidas(lat?: number, lng?: number): boolean {
  if (lat == null || lng == null) return true;
  // Null island: exactamente 0,0 o en un radio de ~1km alrededor de 0,0
  return Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01;
}

/** Reverse geocoding via OpenStreetMap Nominatim */
async function obtenerDireccion(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "es" }, signal: AbortSignal.timeout(5000) }
    );
    if (resp.ok) {
      const data = await resp.json() as { display_name?: string };
      if (data.display_name) return data.display_name;
    }
  } catch { /* usa coordenadas como fallback */ }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Tarjeta de ubicación registrada */
const UbicacionCard = ({
  ubicacion,
  titulo,
}: {
  ubicacion: UbicacionRegistrada;
  titulo: string;
}) => {
  const dispositivo = ubicacion.dispositivo ?? "DESKTOP";
  const invalida = coordenadasInvalidas(ubicacion.lat, ubicacion.lng);
  const mapsUrl = !invalida
    ? `https://www.google.com/maps?q=${ubicacion.lat},${ubicacion.lng}`
    : null;

  // Sin GPS registrado (HTTP / denegado)
  if (ubicacion.sin_gps) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">{titulo}</span>
          <span className="ml-auto">
            {dispositivo === "MOVIL" ? (
              <Smartphone className="h-4 w-4 text-amber-500" />
            ) : (
              <Monitor className="h-4 w-4 text-amber-500" />
            )}
          </span>
        </div>
        <p className="text-xs text-amber-700 pl-6">
          GPS no disponible — {ubicacion.motivo_sin_gps ?? "conexión insegura (HTTP)"}
        </p>
        <p className="text-xs text-amber-600 pl-6 font-medium">
          Dispositivo: {dispositivo}
        </p>
      </div>
    );
  }

  // Coordenadas inválidas (0,0)
  if (invalida) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-red-800">{titulo}</span>
        </div>
        <p className="text-xs text-red-600 pl-6">
          Coordenadas inválidas registradas (GPS sin fix al momento del ingreso).
        </p>
      </div>
    );
  }

  // Ubicación válida
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-green-800">{titulo}</span>
        <span className="ml-auto flex items-center gap-1">
          {dispositivo === "MOVIL" ? (
            <Smartphone className="h-3.5 w-3.5 text-green-500" title="Dispositivo móvil" />
          ) : (
            <Monitor className="h-3.5 w-3.5 text-green-500" title="Computadora" />
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800"
              title="Ver en Google Maps"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </span>
      </div>
      {ubicacion.direccion && (
        <p className="text-xs text-green-700 leading-tight pl-6">
          {ubicacion.direccion}
        </p>
      )}
      <p className="text-xs text-gray-500 pl-6 font-mono">
        {ubicacion.lat.toFixed(6)}, {ubicacion.lng.toFixed(6)}
        {ubicacion.accuracy != null && (
          <span className="ml-2 text-gray-400">± {Math.round(ubicacion.accuracy)} m</span>
        )}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const TimeTracker = ({
  user,
  selectedPoint,
  spontaneousExits,
}: TimeTrackerProps) => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [jornadaActual, setJornadaActual] = useState<JornadaEstado>({
    estado: "NO_INICIADO",
  });
  const [tiempoActual, setTiempoActual] = useState(new Date());
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // true cuando el navegador está en contexto HTTP (no HTTPS)
  const esContextoInseguro = !window.isSecureContext;
  const dispositivo = detectarDispositivo();

  useEffect(() => {
    const interval = window.setInterval(() => setTiempoActual(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const cargarJornadaActual = async () => {
      try {
        if (!user.id || !selectedPoint?.id) return;
        const result = await scheduleService.getActiveSchedule();
        if (result.schedule) {
          setJornadaActual({
            ...result.schedule,
            estado: mapEstadoJornada(result.schedule.estado),
          });
        } else {
          setJornadaActual({ estado: "NO_INICIADO" });
        }
      } catch {
        toast.error("No se pudo cargar la jornada activa");
      }
    };
    cargarJornadaActual();
  }, [user.id, selectedPoint?.id]);

  /**
   * Intenta obtener ubicación GPS.
   * - En HTTP (insecure context): retorna null con flag sin_gps=true
   * - Si el usuario deniega: retorna null con flag sin_gps=true
   * - Si GPS retorna 0,0: reintenta una vez más; si sigue igual, rechaza
   */
  const getLocation = async (): Promise<UbicacionRegistrada | null> => {
    if (esContextoInseguro) {
      return {
        lat: 0,
        lng: 0,
        dispositivo,
        sin_gps: true,
        motivo_sin_gps: "Conexión HTTP — el navegador requiere HTTPS para GPS",
      };
    }

    return new Promise((resolve) => {
      setIsGettingLocation(true);
      setLocationError(null);

      const intentarObtener = (intento: number) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            setIsGettingLocation(false);
            const { latitude, longitude, accuracy } = position.coords;

            // Coordenadas 0,0 → GPS sin fix todavía; reintentar una vez
            if (coordenadasInvalidas(latitude, longitude) && intento === 1) {
              setTimeout(() => intentarObtener(2), 2000);
              return;
            }

            // Si en el segundo intento siguen siendo 0,0, guardar como sin_gps
            if (coordenadasInvalidas(latitude, longitude)) {
              resolve({
                lat: 0,
                lng: 0,
                dispositivo,
                sin_gps: true,
                motivo_sin_gps: "GPS sin señal al momento del ingreso",
              });
              return;
            }

            const direccion = await obtenerDireccion(latitude, longitude);
            resolve({ lat: latitude, lng: longitude, accuracy, direccion, dispositivo });
          },
          (err) => {
            setIsGettingLocation(false);
            let motivo: string;
            if (err.code === 1) {
              motivo = "Permiso de ubicación denegado por el usuario";
              setLocationError(
                "Permitiste el acceso a la ubicación en Android, pero el navegador Chrome también necesita permiso. Toca el ícono 🔒 en la barra de dirección y activa la Ubicación."
              );
            } else if (err.code === 2) {
              motivo = "GPS no disponible en este momento";
            } else {
              motivo = "Tiempo de espera agotado al obtener GPS";
            }
            resolve({
              lat: 0,
              lng: 0,
              dispositivo,
              sin_gps: true,
              motivo_sin_gps: motivo,
            });
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      };

      intentarObtener(1);
    });
  };

  const formatearHora = (fecha: string) => formatGyeTime(fecha);

  const guardarJornadaBackend = async (data: JornadaPayload) => {
    try {
      const response = await axiosInstance.post<SaveScheduleResponse>("/schedules", data);
      if (response.data.success) {
        setJornadaActual({
          ...response.data.schedule,
          estado: mapEstadoJornada(response.data.schedule.estado),
        });
        return response.data.schedule;
      }
      throw new Error("Error guardando jornada");
    } catch {
      toast.error("Error al guardar la jornada en backend");
      throw new Error("Error guardando jornada");
    }
  };

  const iniciarJornada = async () => {
    const ubicacion = await getLocation();
    if (!ubicacion) return;

    try {
      const ahora = new Date().toISOString();
      await guardarJornadaBackend({
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_inicio: ahora,
        ubicacion_inicio: ubicacion,
      });

      const resumen = ubicacion.sin_gps
        ? `sin GPS (${dispositivo})`
        : `${ubicacion.direccion ?? "ubicación registrada"} (${dispositivo})`;

      toast.success(`Jornada iniciada a las ${formatearHora(ahora)} — ${resumen}`);
    } catch {
      // Manejado en guardarJornadaBackend
    }
  };

  const irAlmuerzo = async () => {
    if (jornadaActual.estado !== "TRABAJANDO") return;
    const ahora = new Date().toISOString();
    try {
      await guardarJornadaBackend({
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_almuerzo: ahora,
      });
      toast.success(`Salida a almuerzo a las ${formatearHora(ahora)}`);
    } catch { /* manejado */ }
  };

  const regresarAlmuerzo = async () => {
    if (jornadaActual.estado !== "ALMUERZO") return;
    const ahora = new Date().toISOString();
    try {
      await guardarJornadaBackend({
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_regreso: ahora,
      });
      toast.success(`Regreso de almuerzo a las ${formatearHora(ahora)}`);
    } catch { /* manejado */ }
  };

  const handleFinalizarJornada = async () => {
    if (jornadaActual.estado !== "TRABAJANDO") return;
    try {
      const ahora = new Date().toISOString();
      await guardarJornadaBackend({
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_salida: ahora,
      });
      toast.success(`Jornada finalizada a las ${formatearHora(ahora)}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message
        : typeof error === "object" && error !== null
          ? String((error as Record<string, unknown>).message ?? "")
          : "";
      if (message.includes("cierre de caja diario") || message.includes("cierre diario")) {
        showConfirmation(
          "Cierre requerido",
          "Para finalizar su jornada debe realizar primero el cierre de caja diario.",
          async () => {
            try {
              localStorage.setItem("pc_active_view", "daily-close");
              window.dispatchEvent(new CustomEvent("pc:navigate", { detail: { view: "daily-close" } }));
            } catch { /* no-op */ }
            toast.info("Vaya a Cierre Diario para finalizar su jornada.");
          }
        );
      }
    }
  };

  const calcularTiempoTrabajado = () => {
    if (!jornadaActual.fecha_inicio) return "0h 0m";
    const inicio = new Date(jornadaActual.fecha_inicio);
    const fin = jornadaActual.fecha_salida ? new Date(jornadaActual.fecha_salida) : new Date();
    let ms = fin.getTime() - inicio.getTime();

    if (jornadaActual.fecha_almuerzo && jornadaActual.fecha_regreso) {
      ms -= new Date(jornadaActual.fecha_regreso).getTime() - new Date(jornadaActual.fecha_almuerzo).getTime();
    } else if (jornadaActual.fecha_almuerzo && jornadaActual.estado === "ALMUERZO") {
      ms -= new Date().getTime() - new Date(jornadaActual.fecha_almuerzo).getTime();
    }
    spontaneousExits.forEach((exit) => {
      if (exit.fecha_regreso)
        ms -= new Date(exit.fecha_regreso).getTime() - new Date(exit.fecha_salida).getTime();
    });
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const calcularTiempoSalidas = () => {
    let total = 0;
    spontaneousExits.forEach((exit) => {
      total += exit.duracion_minutos
        ? exit.duracion_minutos
        : !exit.fecha_regreso
        ? Math.round((Date.now() - new Date(exit.fecha_salida).getTime()) / 60000)
        : 0;
    });
    return `${Math.floor(total / 60)}h ${total % 60}m`;
  };

  const getEstadoBadge = () => {
    switch (jornadaActual.estado) {
      case "NO_INICIADO": return <Badge variant="secondary">No iniciado</Badge>;
      case "TRABAJANDO":  return <Badge variant="default" className="bg-green-500">Trabajando</Badge>;
      case "ALMUERZO":    return <Badge variant="destructive">En almuerzo</Badge>;
      case "FINALIZADO":  return <Badge variant="outline">Finalizado</Badge>;
    }
  };

  if (!selectedPoint) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Selecciona un punto de atención</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Control de Horarios</h2>
          <p className="text-gray-600">{selectedPoint.nombre}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono">{tiempoActual.toLocaleTimeString("es-EC")}</div>
          <div className="text-sm text-gray-500">{tiempoActual.toLocaleDateString("es-EC")}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Estado ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Estado Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Estado:</span>
              {getEstadoBadge()}
            </div>
            <div className="flex justify-between items-center">
              <span>Tiempo trabajado:</span>
              <span className="font-mono font-bold">{calcularTiempoTrabajado()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Salidas espontáneas:</span>
              <span className="font-mono font-bold text-orange-600">{calcularTiempoSalidas()}</span>
            </div>

            {jornadaActual.ubicacion_inicio && (
              <UbicacionCard
                ubicacion={jornadaActual.ubicacion_inicio as UbicacionRegistrada}
                titulo="Ubicación al ingresar"
              />
            )}
            {jornadaActual.ubicacion_salida && (
              <UbicacionCard
                ubicacion={jornadaActual.ubicacion_salida as UbicacionRegistrada}
                titulo="Ubicación al salir"
              />
            )}

            {jornadaActual.estado === "TRABAJANDO" && !jornadaActual.ubicacion_inicio && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Sin ubicación registrada en el ingreso.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Acciones ── */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Aviso HTTP */}
            {esContextoInseguro && jornadaActual.estado === "NO_INICIADO" && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <WifiOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Conexión HTTP — el GPS no estará disponible. Se registrará el ingreso
                  sin coordenadas pero con el tipo de dispositivo ({dispositivo}).
                </span>
              </div>
            )}

            {/* Aviso HTTPS normal */}
            {!esContextoInseguro && jornadaActual.estado === "NO_INICIADO" && (
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Se capturará tu ubicación GPS al ingresar. Asegúrate de tener la
                  geolocalización activada en el navegador.
                </span>
              </div>
            )}

            {/* Error de permiso del navegador (solo HTTPS) */}
            {locationError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{locationError}</span>
              </div>
            )}

            <Button
              onClick={iniciarJornada}
              disabled={jornadaActual.estado !== "NO_INICIADO" || isGettingLocation}
              className="w-full"
              variant={jornadaActual.estado === "NO_INICIADO" ? "default" : "secondary"}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isGettingLocation ? "Obteniendo ubicación..." : "Iniciar Jornada"}
            </Button>
            <Button
              onClick={irAlmuerzo}
              disabled={jornadaActual.estado !== "TRABAJANDO"}
              variant="outline"
              className="w-full"
            >
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              Ir a Almuerzo
            </Button>
            <Button
              onClick={regresarAlmuerzo}
              disabled={jornadaActual.estado !== "ALMUERZO"}
              variant="outline"
              className="w-full"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Regresar de Almuerzo
            </Button>
            <Button
              onClick={handleFinalizarJornada}
              disabled={jornadaActual.estado !== "TRABAJANDO"}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Finalizar Jornada
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog />
    </div>
  );
};

export default TimeTracker;
