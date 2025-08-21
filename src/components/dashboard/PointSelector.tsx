import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Cargando puntos disponibles...
          </p>
        </div>
      </div>
    );
  }

  if (availablePoints.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">No hay puntos disponibles</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Actualmente no hay puntos de atención disponibles para iniciar
              jornada.
            </p>
            <Button onClick={loadAvailablePoints} variant="outline" size="sm">
              Actualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-1">
          Seleccionar Punto de Atención
        </h2>
        <p className="text-muted-foreground text-sm">
          Selecciona un punto de atención para iniciar tu jornada laboral.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availablePoints.map((point) => (
          <Card key={point.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{point.nombre}</CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {point.direccion}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 text-xs"
                >
                  Disponible
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Ciudad:</span> {point.ciudad}
                  </p>
                  <p>
                    <span className="font-medium">Provincia:</span>{" "}
                    {point.provincia}
                  </p>
                  {point.telefono && (
                    <p>
                      <span className="font-medium">Teléfono:</span>{" "}
                      {point.telefono}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleStartSchedule(point)}
                  disabled={isStartingSchedule}
                  className="w-full h-9"
                  size="sm"
                >
                  {isStartingSchedule ? "Iniciando..." : "Iniciar Jornada"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
