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

interface UbicacionRegistrada {
  lat: number;
  lng: number;
  accuracy?: number;
  direccion?: string;
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

interface ActiveScheduleResponse {
  success: boolean;
  schedule: JornadaEstadoBackend | null;
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
    case "ACTIVO":
      return "TRABAJANDO";
    case "ALMUERZO":
      return "ALMUERZO";
    case "COMPLETADO":
    case "CANCELADO":
      return "FINALIZADO";
    default:
      return "NO_INICIADO";
  }
}

/** Reverse geocoding via OpenStreetMap Nominatim */
async function obtenerDireccion(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "es" } }
    );
    if (resp.ok) {
      const data = await resp.json() as { display_name?: string };
      if (data.display_name) return data.display_name;
    }
  } catch {
    // fallback a coordenadas
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Tarjeta que muestra la ubicación registrada */
const UbicacionCard = ({ ubicacion, titulo }: { ubicacion: UbicacionRegistrada; titulo: string }) => {
  const mapsUrl = `https://www.google.com/maps?q=${ubicacion.lat},${ubicacion.lng}`;
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-green-800">{titulo}</span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-green-600 hover:text-green-800"
          title="Ver en Google Maps"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {ubicacion.direccion && (
        <p className="text-xs text-green-700 leading-tight pl-6">{ubicacion.direccion}</p>
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);
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
   * Obtiene la ubicación del dispositivo. OBLIGATORIA para timbrar.
   * Incluye reverse geocoding para obtener dirección legible.
   */
  const getLocation = (): Promise<UbicacionRegistrada> => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocalización no disponible en este dispositivo"));
        return;
      }
      setIsGettingLocation(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setIsGettingLocation(false);
          const { latitude, longitude, accuracy } = position.coords;
          const direccion = await obtenerDireccion(latitude, longitude);
          resolve({ lat: latitude, lng: longitude, accuracy, direccion });
        },
        (err) => {
          setIsGettingLocation(false);
          let msg: string;
          if (err.code === 1) {
            msg =
              "Debes permitir el acceso a tu ubicación para timbrar. Activa la geolocalización en la configuración de tu navegador o dispositivo.";
          } else if (err.code === 2) {
            msg =
              "No se pudo obtener tu ubicación. Asegúrate de tener señal GPS o conexión a internet.";
          } else {
            msg = "Tiempo de espera agotado al obtener la ubicación. Intenta de nuevo.";
          }
          setLocationError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const formatearHora = (fecha: string) => formatGyeTime(fecha);

  const guardarJornadaBackend = async (data: JornadaPayload) => {
    try {
      const response = await axiosInstance.post<SaveScheduleResponse>(
        "/schedules",
        data
      );
      if (response.data.success) {
        setJornadaActual({
          ...response.data.schedule,
          estado: mapEstadoJornada(response.data.schedule.estado),
        });
        return response.data.schedule;
      } else {
        throw new Error("Error guardando jornada");
      }
    } catch {
      toast.error("Error al guardar la jornada en backend");
      throw new Error("Error guardando jornada");
    }
  };

  const iniciarJornada = async () => {
    // Geolocalización OBLIGATORIA como evidencia de presencia
    let ubicacion: UbicacionRegistrada;
    try {
      ubicacion = await getLocation();
    } catch (geoError) {
      const msg =
        geoError instanceof Error
          ? geoError.message
          : "No se pudo obtener la ubicación";
      toast.error(msg);
      return;
    }

    try {
      const ahora = new Date().toISOString();
      const payload: JornadaPayload = {
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_inicio: ahora,
        ubicacion_inicio: ubicacion,
      };

      await guardarJornadaBackend(payload);
      toast.success(
        `Jornada iniciada a las ${formatearHora(ahora)} — ${ubicacion.direccion ?? "ubicación registrada"}`
      );
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
    } catch {
      // Manejado arriba
    }
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
    } catch {
      // Manejado arriba
    }
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
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null
          ? typeof (error as Record<string, unknown>).message === "string"
            ? String((error as Record<string, unknown>).message)
            : ""
          : "";
      if (
        message.includes("cierre de caja diario") ||
        message.includes("cierre diario")
      ) {
        showConfirmation(
          "Cierre requerido",
          "Para finalizar su jornada debe realizar primero el cierre de caja diario.",
          async () => {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set("view", "daily-close");
              window.history.pushState({}, "", url.toString());
              window.dispatchEvent(new Event("popstate"));
              toast.info("Vaya a Cierre Diario para finalizar su jornada.");
            } catch {
              toast.info("Vaya a Cierre Diario para finalizar su jornada.");
            }
          }
        );
      }
    }
  };

  const calcularTiempoTrabajado = () => {
    if (!jornadaActual.fecha_inicio) return "0h 0m";
    const inicio = new Date(jornadaActual.fecha_inicio);
    const fin = jornadaActual.fecha_salida
      ? new Date(jornadaActual.fecha_salida)
      : new Date();
    let tiempoTotal = fin.getTime() - inicio.getTime();

    if (jornadaActual.fecha_almuerzo && jornadaActual.fecha_regreso) {
      tiempoTotal -=
        new Date(jornadaActual.fecha_regreso).getTime() -
        new Date(jornadaActual.fecha_almuerzo).getTime();
    } else if (
      jornadaActual.fecha_almuerzo &&
      jornadaActual.estado === "ALMUERZO"
    ) {
      tiempoTotal -=
        new Date().getTime() - new Date(jornadaActual.fecha_almuerzo).getTime();
    }

    spontaneousExits.forEach((exit) => {
      if (exit.fecha_regreso) {
        tiempoTotal -=
          new Date(exit.fecha_regreso).getTime() -
          new Date(exit.fecha_salida).getTime();
      }
    });

    const horas = Math.floor(tiempoTotal / 3600000);
    const minutos = Math.floor((tiempoTotal % 3600000) / 60000);
    return `${horas}h ${minutos}m`;
  };

  const calcularTiempoSalidasEspontaneas = () => {
    let tiempoTotal = 0;
    spontaneousExits.forEach((exit) => {
      if (exit.duracion_minutos) {
        tiempoTotal += exit.duracion_minutos;
      } else if (!exit.fecha_regreso) {
        tiempoTotal += Math.round(
          (Date.now() - new Date(exit.fecha_salida).getTime()) / 60000
        );
      }
    });
    const horas = Math.floor(tiempoTotal / 60);
    const minutos = tiempoTotal % 60;
    return `${horas}h ${minutos}m`;
  };

  const getEstadoBadge = () => {
    switch (jornadaActual.estado) {
      case "NO_INICIADO":
        return <Badge variant="secondary">No iniciado</Badge>;
      case "TRABAJANDO":
        return (
          <Badge variant="default" className="bg-green-500">
            Trabajando
          </Badge>
        );
      case "ALMUERZO":
        return <Badge variant="destructive">En almuerzo</Badge>;
      case "FINALIZADO":
        return <Badge variant="outline">Finalizado</Badge>;
    }
  };

  if (!selectedPoint) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">
            Selecciona un punto de atención
          </p>
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
          <div className="text-2xl font-mono">
            {tiempoActual.toLocaleTimeString("es-EC")}
          </div>
          <div className="text-sm text-gray-500">
            {tiempoActual.toLocaleDateString("es-EC")}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
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
              <span className="font-mono font-bold">
                {calcularTiempoTrabajado()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Salidas espontáneas:</span>
              <span className="font-mono font-bold text-orange-600">
                {calcularTiempoSalidasEspontaneas()}
              </span>
            </div>

            {/* Ubicación de inicio */}
            {jornadaActual.ubicacion_inicio && (
              <UbicacionCard
                ubicacion={jornadaActual.ubicacion_inicio as UbicacionRegistrada}
                titulo="Ubicación al ingresar"
              />
            )}

            {/* Ubicación de salida */}
            {jornadaActual.ubicacion_salida && (
              <UbicacionCard
                ubicacion={jornadaActual.ubicacion_salida as UbicacionRegistrada}
                titulo="Ubicación al salir"
              />
            )}

            {/* Aviso si no hay ubicación registrada (jornada activa sin geo) */}
            {jornadaActual.estado === "TRABAJANDO" &&
              !jornadaActual.ubicacion_inicio && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Sin ubicación registrada en el ingreso.</span>
                </div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Aviso de geolocalización obligatoria */}
            {jornadaActual.estado === "NO_INICIADO" && (
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Se requiere tu ubicación para registrar el ingreso. Asegúrate de tener activada la geolocalización.
                </span>
              </div>
            )}

            {/* Error de geolocalización */}
            {locationError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{locationError}</span>
              </div>
            )}

            <Button
              onClick={iniciarJornada}
              disabled={
                jornadaActual.estado !== "NO_INICIADO" || isGettingLocation
              }
              className="w-full"
              variant={
                jornadaActual.estado === "NO_INICIADO" ? "default" : "secondary"
              }
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isGettingLocation
                ? "Obteniendo ubicación..."
                : "Iniciar Jornada"}
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
