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
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { User, PuntoAtencion, SalidaEspontanea } from "../../types";

interface TimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  spontaneousExits: SalidaEspontanea[];
}

type EstadoFrontend = "NO_INICIADO" | "TRABAJANDO" | "ALMUERZO" | "FINALIZADO";

interface JornadaEstadoBackend {
  id?: string;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: string;
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cargarJornadaActual = async () => {
      try {
        if (!user.id || !selectedPoint?.id) return;
        const { data } = await axiosInstance.get<ActiveScheduleResponse>(
          "/api/schedules/active"
        );
        if (data.success && data.schedule) {
          setJornadaActual({
            ...data.schedule,
            estado: mapEstadoJornada(data.schedule.estado),
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

  const getLocation = (): Promise<{
    lat: number;
    lng: number;
    direccion?: string;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation)
        return reject(new Error("Geolocalización no soportada"));
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsGettingLocation(false);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            direccion: "Ubicación de trabajo",
          });
        },
        () => {
          setIsGettingLocation(false);
          reject(new Error("Error al obtener ubicación"));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const formatearHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const guardarJornadaBackend = async (data: JornadaPayload) => {
    try {
      const response = await axiosInstance.post<SaveScheduleResponse>(
        "/api/schedules",
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
    try {
      let ubicacion;
      try {
        ubicacion = await getLocation();
      } catch {
        ubicacion = null;
      }
      const ahora = new Date().toISOString();

      await guardarJornadaBackend({
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id,
        fecha_inicio: ahora,
        ubicacion_inicio: ubicacion,
      });

      toast.success(
        `✅ Jornada iniciada a las ${formatearHora(ahora)}${
          ubicacion ? " con ubicación" : ""
        }`
      );
    } catch {
      // El error ya fue manejado en guardarJornadaBackend
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
      toast.success(`🍽️ Salida a almuerzo a las ${formatearHora(ahora)}`);
    } catch {
      // Error manejado en guardarJornadaBackend
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
      toast.success(`🔄 Regreso de almuerzo a las ${formatearHora(ahora)}`);
    } catch {
      // Error manejado en guardarJornadaBackend
    }
  };

  const handleFinalizarJornada = () => {
    if (jornadaActual.estado !== "TRABAJANDO") return;

    showConfirmation(
      "Confirmar finalización de jornada",
      "¿Está seguro de finalizar su jornada laboral? Esta acción no se puede deshacer.",
      async () => {
        const ahora = new Date().toISOString();
        try {
          await guardarJornadaBackend({
            usuario_id: user.id,
            punto_atencion_id: selectedPoint?.id,
            fecha_salida: ahora,
          });
          toast.success(`🏁 Jornada finalizada a las ${formatearHora(ahora)}`);
        } catch {
          // Error manejado en guardarJornadaBackend
        }
      }
    );
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
            {jornadaActual.ubicacion_inicio && (
              <div className="flex gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>Ubicación registrada</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
