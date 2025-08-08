import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users } from "lucide-react";
import { pointService } from "../../services/pointService";
import { scheduleService } from "../../services/scheduleService";
import { PuntoAtencion, User } from "../../types";
import { toast } from "@/hooks/use-toast";

interface PointSelectorProps {
  user: User;
  onPointSelected: (point: PuntoAtencion) => void;
}

export const PointSelector = ({
  user,
  onPointSelected,
}: PointSelectorProps) => {
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingSchedule, setIsStartingSchedule] = useState(false);

  useEffect(() => {
    loadAvailablePoints();
  }, []);

  const loadAvailablePoints = async () => {
    try {
      setIsLoading(true);
      const { points, error } = await pointService.getAllPoints();

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        setAvailablePoints(points);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar puntos de atención",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSchedule = async (point: PuntoAtencion) => {
    try {
      setIsStartingSchedule(true);

      const scheduleData = {
        usuario_id: user.id,
        punto_atencion_id: point.id,
        fecha_inicio: new Date().toISOString(),
      };

      const { schedule, error } = await scheduleService.createOrUpdateSchedule(
        scheduleData
      );

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else if (schedule) {
        toast({
          title: "Jornada iniciada",
          description: `Jornada iniciada en ${point.nombre}`,
        });
        onPointSelected(point);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al iniciar jornada",
        variant: "destructive",
      });
    } finally {
      setIsStartingSchedule(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-gray-600">Cargando puntos disponibles...</p>
        </div>
      </div>
    );
  }

  if (availablePoints.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <MapPin className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-xl text-yellow-800">
              No hay puntos disponibles
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Actualmente no hay puntos de atención disponibles para iniciar
              jornada.
            </p>
            <Button onClick={loadAvailablePoints} variant="outline">
              Actualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Seleccionar Punto de Atención
        </h2>
        <p className="text-gray-600">
          Selecciona un punto de atención para iniciar tu jornada laboral.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availablePoints.map((point) => (
          <Card key={point.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{point.nombre}</CardTitle>
                  <div className="flex items-center mt-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-1" />
                    {point.direccion}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  Disponible
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Ciudad:</strong> {point.ciudad}
                  </p>
                  <p>
                    <strong>Provincia:</strong> {point.provincia}
                  </p>
                  {point.telefono && (
                    <p>
                      <strong>Teléfono:</strong> {point.telefono}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleStartSchedule(point)}
                  disabled={isStartingSchedule}
                  className="w-full"
                >
                  {isStartingSchedule ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Iniciar Jornada
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
