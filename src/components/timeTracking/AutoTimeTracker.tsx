import { useEffect, useMemo, useState } from "react";
import { User, PuntoAtencion } from "../../types";
import axiosInstance from "@/services/axiosInstance";

interface AutoTimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onTimeUpdate?: (totalMinutes: number) => void;
}

interface JornadaEstadoBackend {
  id?: string;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: string;
}

interface ActiveScheduleResponse {
  success: boolean;
  schedule: JornadaEstadoBackend | null;
}

const AutoTimeTracker = ({
  user,
  selectedPoint,
  onTimeUpdate,
}: AutoTimeTrackerProps) => {
  const [now, setNow] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<JornadaEstadoBackend | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tick cada segundo para refrescar UI
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar jornada activa desde backend (persistente)
  useEffect(() => {
    const loadActiveSchedule = async () => {
      try {
        if (!user?.id) return;
        const { data } = await axiosInstance.get<ActiveScheduleResponse>(
          "/schedules/active"
        );
        if (data.success) {
          setSchedule(data.schedule);
        }
      } finally {
        setLoading(false);
      }
    };
    loadActiveSchedule();
  }, [user?.id, selectedPoint?.id]);

  // Recalcular y notificar minutos totales cuando cambie tiempo o schedule
  const totalMinutes = useMemo(() => {
    if (!schedule?.fecha_inicio) return 0;
    const start = new Date(schedule.fecha_inicio).getTime();
    const end = schedule.fecha_salida
      ? new Date(schedule.fecha_salida).getTime()
      : now.getTime();
    // Tiempo transcurrido bruto (sin descontar almuerzo o salidas)
    const diffMs = Math.max(0, end - start);
    return Math.floor(diffMs / 60000);
  }, [schedule?.fecha_inicio, schedule?.fecha_salida, now]);

  useEffect(() => {
    if (onTimeUpdate) onTimeUpdate(totalMinutes);
  }, [totalMinutes, onTimeUpdate]);

  // Formatear HH:MM desde minutos
  const fmtHM = (mins: number) => {
    const h = Math.floor((mins || 0) / 60)
      .toString()
      .padStart(2, "0");
    const m = Math.abs((mins || 0) % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}`;
  };

  const startedAt = schedule?.fecha_inicio
    ? new Date(schedule.fecha_inicio).toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-green-800">
            Tiempo de jornada
          </p>
          <p className="text-xs text-green-600">
            {loading
              ? "Cargando..."
              : schedule?.fecha_inicio
              ? `Iniciado: ${startedAt}`
              : "Sin jornada activa"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-800">
            {fmtHM(totalMinutes)}
          </p>
          <p className="text-xs text-green-600">h:m</p>
        </div>
      </div>
    </div>
  );
};

export default AutoTimeTracker;
