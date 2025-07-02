import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, Plus, List } from "lucide-react";
import { User, PuntoAtencion } from "../../types";
import { useToast } from "@/hooks/use-toast";
import { scheduleService } from "../../services/scheduleService";
import {
  spontaneousExitService,
  SpontaneousExit,
} from "../../services/spontaneousExitService";
import AutoTimeTracker from "./AutoTimeTracker";
import SpontaneousExitForm from "./SpontaneousExitForm";
import SpontaneousExitHistory from "./SpontaneousExitHistory";

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface Schedule {
  id: string;
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: string;
}

const TimeManagement = ({ user, selectedPoint }: TimeManagementProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionTime, setCurrentSessionTime] = useState(0);
  const { toast } = useToast();
  const [activeSession, setActiveSession] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // NUEVO: Salidas espontáneas del usuario y punto
  const [exits, setExits] = useState<SpontaneousExit[]>([]);
  const [loadingExits, setLoadingExits] = useState(false);

  // Consultar el estado de la jornada activa del backend
  const fetchActiveSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await scheduleService.getActiveSchedule();
      if (res && res.schedule && !res.error) {
        setActiveSession(res.schedule);
        setIsTracking(true);
      } else {
        setActiveSession(null);
        setIsTracking(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar historial de salidas espontáneas
  const fetchExits = useCallback(async () => {
    if (!user?.id /*|| !selectedPoint?.id*/) {
      setExits([]);
      return;
    }
    setLoadingExits(true);
    try {
      // Solo necesita user.id, punto es opcional según tus endpoints
      const { exits, error } = await spontaneousExitService.getAllExits(
        user.id
      );
      if (!error) {
        setExits(exits);
      } else {
        setExits([]);
        toast({
          title: "Error",
          description: "No se pudo obtener el historial de salidas espontáneas",
          variant: "destructive",
        });
      }
    } catch {
      setExits([]);
    } finally {
      setLoadingExits(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchActiveSession();
  }, [user.id, selectedPoint?.id, fetchActiveSession]);

  useEffect(() => {
    fetchExits();
  }, [fetchExits, showHistory, showExitForm]); // Asegura recarga al mostrar historial o después de una nueva salida

  useEffect(() => {
    // Revisar si hay tracking local (compatibilidad previa)
    const savedSession = localStorage.getItem("timeTrackingSession");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (
          session.userId === user.id &&
          session.pointId === selectedPoint?.id
        ) {
          setIsTracking(true);
        }
      } catch {
        localStorage.removeItem("timeTrackingSession");
      }
    }
  }, [user.id, selectedPoint?.id]);

  const startTracking = async () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description:
          "Debe seleccionar un punto de atención para iniciar el tracking",
        variant: "destructive",
      });
      return;
    }
    // Registrar inicio de jornada en backend
    const scheduleData = {
      usuario_id: user.id,
      punto_atencion_id: selectedPoint.id,
      fecha_inicio: new Date().toISOString(),
    };
    const res = await scheduleService.createOrUpdateSchedule(scheduleData);
    if (res.error) {
      toast({
        title: "Error",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setIsTracking(true);
    setActiveSession(res.schedule);
    toast({
      title: "Tracking iniciado",
      description: "Se ha iniciado el seguimiento de tiempo",
    });
  };

  const stopTracking = async () => {
    if (!activeSession) return;
    // Registrar cierre de jornada en backend
    const scheduleData = {
      usuario_id: user.id,
      punto_atencion_id: selectedPoint?.id || "",
      fecha_salida: new Date().toISOString(),
    };
    const res = await scheduleService.createOrUpdateSchedule(scheduleData);
    if (res.error) {
      toast({
        title: "Error",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setIsTracking(false);
    setActiveSession(null);
    setCurrentSessionTime(0);
    toast({
      title: "Tracking detenido",
      description: "Se ha detenido el seguimiento de tiempo",
    });
  };

  const handleExitRegistered = () => {
    setShowExitForm(false);
    toast({
      title: "Salida registrada",
      description: "La salida espontánea ha sido registrada exitosamente",
    });
    fetchExits(); // <-- refrescar historial tras registrar salida
    fetchActiveSession();
  };

  const handleTimeUpdate = (totalMinutes: number) => {
    setCurrentSessionTime(totalMinutes);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando gestión de tiempo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Tiempo</h1>
        <Badge variant={isTracking ? "default" : "secondary"}>
          {isTracking ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Control de Tiempo
            </CardTitle>
            <CardDescription>
              Inicie o detenga el seguimiento de su tiempo de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isTracking ? (
              <Button onClick={startTracking} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Iniciar Tracking
              </Button>
            ) : (
              <div className="space-y-4">
                <AutoTimeTracker
                  user={user}
                  selectedPoint={selectedPoint}
                  onTimeUpdate={handleTimeUpdate}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={stopTracking}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Detener
                  </Button>
                  <Button
                    onClick={() => setShowExitForm(true)}
                    variant="outline"
                    disabled={showExitForm}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Salida
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              className="w-full"
            >
              <List className="mr-2 h-4 w-4" />
              {showHistory ? "Ocultar" : "Ver"} Historial
            </Button>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Sesión</CardTitle>
            <CardDescription>
              Detalles de la sesión actual de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Usuario:</span>
                <span className="text-sm">{user.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Punto:</span>
                <span className="text-sm">
                  {selectedPoint?.nombre || "No seleccionado"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Estado:</span>
                <Badge variant={isTracking ? "default" : "secondary"}>
                  {isTracking ? "Trabajando" : "Inactivo"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Tiempo actual:</span>
                <span className="text-sm font-mono">
                  {formatTime(currentSessionTime)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spontaneous Exit Form */}
      {showExitForm && (
        <SpontaneousExitForm
          user={user}
          selectedPoint={selectedPoint}
          onExitRegistered={handleExitRegistered}
          onCancel={() => setShowExitForm(false)}
        />
      )}

      {/* History */}
      {showHistory && (
        <div>
          {loadingExits ? (
            <div className="text-center p-4 text-gray-400">
              Cargando historial...
            </div>
          ) : (
            <SpontaneousExitHistory exits={exits} />
          )}
        </div>
      )}
    </div>
  );
};

export default TimeManagement;
