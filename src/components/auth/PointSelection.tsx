import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, PuntoAtencion } from "../../types";
import { scheduleService } from "../../services/scheduleService";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface PointSelectionProps {
  user: User;
  points: PuntoAtencion[];
  onLogout: () => void;
  onPointSelect?: (point: PuntoAtencion) => void; // <-- agregada para integración flexible
}

interface PuntosActivosResponse {
  puntos: { id: string }[];
}

const PointSelection = ({
  user,
  points,
  onLogout,
  onPointSelect,
}: PointSelectionProps) => {
  const [occupiedPoints, setOccupiedPoints] = useState<string[]>([]);
  const [isStartingShift, setIsStartingShift] = useState(false);

  const { setSelectedPoint, selectedPoint } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOccupiedPoints = async () => {
      try {
        const response = await axios.get<PuntosActivosResponse>(
          "/api/puntos/activos"
        );
        const ocupados = response.data.puntos.map((p) => p.id);
        setOccupiedPoints(ocupados);
      } catch {
        setOccupiedPoints([]);
      }
    };
    fetchOccupiedPoints();
  }, []);

  // Redireccionar automáticamente si ya hay punto seleccionado
  useEffect(() => {
    if (selectedPoint) {
      navigate("/dashboard", { replace: true });
    }
  }, [selectedPoint, navigate]);

  const getLocation = (): Promise<{
    lat: number;
    lng: number;
    direccion?: string;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocalización no soportada"));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            direccion: "Ubicación de inicio de jornada",
          });
        },
        () => {
          resolve({
            lat: 0,
            lng: 0,
            direccion: "Ubicación no disponible",
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const handlePointSelect = async (point: PuntoAtencion) => {
    if (occupiedPoints.includes(point.id)) return;

    setIsStartingShift(true);

    try {
      const ubicacion = await getLocation();
      const scheduleData = {
        usuario_id: user.id,
        punto_atencion_id: point.id,
        fecha_inicio: new Date().toISOString(),
        ubicacion_inicio: ubicacion,
      };

      const { error } = await scheduleService.createOrUpdateSchedule(
        scheduleData
      );

      if (error) {
        toast({
          title: "Error",
          description: `Error al iniciar jornada: ${error}`,
          variant: "destructive",
        });
        return;
      }

      setSelectedPoint(point);

      toast({
        title: "Jornada iniciada",
        description: `Bienvenido a ${point.nombre}. Tu jornada ha comenzado automáticamente.`,
      });

      // Si el padre pasa la prop onPointSelect, llamarla aquí:
      if (typeof onPointSelect === "function") {
        onPointSelect(point);
      }

      navigate("/dashboard", { replace: true });
    } catch {
      toast({
        title: "Error",
        description: "Error al iniciar la jornada automáticamente",
        variant: "destructive",
      });
    } finally {
      setIsStartingShift(false);
    }
  };

  const freePoints = points.filter(
    (point) => !occupiedPoints.includes(point.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            Seleccionar Punto de Atención
          </CardTitle>
          <CardDescription className="text-center">
            Hola {user.nombre}, selecciona el punto de atención donde trabajarás
            hoy. Tu jornada iniciará automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {freePoints.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay puntos de atención disponibles por el momento.
              </div>
            ) : (
              freePoints.map((point) => (
                <div
                  key={point.id}
                  className={`p-4 border rounded-lg transition-colors hover:bg-blue-50 cursor-pointer border-gray-200 ${
                    isStartingShift ? "opacity-50" : ""
                  }`}
                  onClick={() => !isStartingShift && handlePointSelect(point)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{point.nombre}</h3>
                      <p className="text-sm text-gray-600">{point.direccion}</p>
                      <p className="text-sm text-gray-600">
                        {point.ciudad}, {point.provincia}
                      </p>
                      {point.telefono && (
                        <p className="text-sm text-gray-600">
                          {point.telefono}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Button size="sm" disabled={isStartingShift}>
                        {isStartingShift
                          ? "Iniciando..."
                          : "Seleccionar e Iniciar"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 pt-4 border-t flex justify-center">
            <Button
              variant="outline"
              onClick={onLogout}
              className="text-red-600 border-red-600 hover:bg-red-50"
              disabled={isStartingShift}
            >
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PointSelection;
