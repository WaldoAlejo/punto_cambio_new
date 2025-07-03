import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  onPointSelect?: (point: PuntoAtencion) => void;
}

const PointSelection = ({
  user,
  points,
  onLogout,
  onPointSelect,
}: PointSelectionProps) => {
  const [isStartingShift, setIsStartingShift] = useState(false);
  const { setSelectedPoint, selectedPoint } = useAuth();
  const navigate = useNavigate();

  // Redirige automáticamente si ya hay punto seleccionado
  useEffect(() => {
    if (selectedPoint) {
      navigate("/", { replace: true }); // ← volver al índice para que cargue Dashboard
    }
  }, [selectedPoint, navigate]);

  const handlePointSelect = async (point: PuntoAtencion) => {
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
        description: `Conectado a ${point.nombre}. Jornada iniciada automáticamente.`,
      });

      if (typeof onPointSelect === "function") {
        onPointSelect(point);
      }

      // No navegar manualmente. Lo hace el useEffect al detectar selectedPoint
    } catch {
      toast({
        title: "Error",
        description: "No se pudo obtener la ubicación",
        variant: "destructive",
      });
    } finally {
      setIsStartingShift(false);
    }
  };

  const getLocation = (): Promise<{
    lat: number;
    lng: number;
    direccion?: string;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve({
          lat: 0,
          lng: 0,
          direccion: "Ubicación no soportada",
        });
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            Seleccionar Punto de Atención
          </CardTitle>
          <CardDescription className="text-center">
            Hola {user.nombre}, selecciona el punto donde trabajarás hoy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {points.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay puntos disponibles.
              </div>
            ) : (
              points.map((point) => (
                <div
                  key={point.id}
                  className={`p-4 border rounded-lg transition-colors hover:bg-blue-50 cursor-pointer border-gray-200 ${
                    isStartingShift ? "opacity-50 pointer-events-none" : ""
                  }`}
                  onClick={() => handlePointSelect(point)}
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
                        {isStartingShift ? "Iniciando..." : "Seleccionar"}
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
