import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowLeft } from "lucide-react";
import { SpontaneousExit } from "../../services/spontaneousExitService";
import { toast } from "@/hooks/use-toast";
import { spontaneousExitService } from "../../services/spontaneousExitService";

interface SpontaneousExitHistoryProps {
  exits: SpontaneousExit[];
  onExitReturn?: (
    exitId: string,
    returnData: { lat: number; lng: number; direccion?: string }
  ) => void;
}

const motivoLabels: Record<string, string> = {
  BANCO: "Banco",
  DILIGENCIA_PERSONAL: "Diligencia Personal",
  TRAMITE_GOBIERNO: "Trámite de Gobierno",
  EMERGENCIA_MEDICA: "Emergencia Médica",
  OTRO: "Otro",
};

// --- Mejor fuera del componente para no redefinir cada render
function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no soportada"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

const SpontaneousExitHistory = ({
  exits,
  onExitReturn,
}: SpontaneousExitHistoryProps) => {
  const [returningIds, setReturningIds] = useState<Set<string>>(new Set());

  const handleMarkReturn = async (exitId: string) => {
    if (returningIds.has(exitId)) return;

    try {
      setReturningIds((prev) => new Set(prev).add(exitId));

      let ubicacionRegreso;
      try {
        ubicacionRegreso = await getCurrentLocation();
      } catch (locationError) {
        console.warn("No se pudo obtener ubicación:", locationError);
        // Continuar sin ubicación
      }

      const { error } = await spontaneousExitService.markReturn(exitId, {
        ubicacion_regreso: ubicacionRegreso,
      });

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Regreso registrado",
          description: "Se ha marcado tu regreso exitosamente",
        });

        if (onExitReturn && ubicacionRegreso) {
          onExitReturn(exitId, ubicacionRegreso);
        }
      }
    } catch (error) {
      console.error("Error marking return:", error);
      toast({
        title: "Error",
        description: "Error al marcar el regreso",
        variant: "destructive",
      });
    } finally {
      setReturningIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(exitId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (exit: SpontaneousExit) => {
    if (exit.fecha_regreso) {
      return <Badge className="bg-green-100 text-green-800">Completado</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">En curso</Badge>;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const calculateCurrentDuration = (fechaSalida: string) => {
    const now = new Date();
    const salida = new Date(fechaSalida);
    const diffMinutes = Math.floor(
      (now.getTime() - salida.getTime()) / (1000 * 60)
    );
    return diffMinutes;
  };

  if (!exits || exits.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No hay salidas espontáneas registradas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Historial de Salidas Espontáneas
      </h2>
      {exits.map((exit) => (
        <Card key={exit.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base">
                  {motivoLabels[exit.motivo] || exit.motivo}
                </CardTitle>
                <CardDescription>
                  {new Date(exit.fecha_salida).toLocaleString("es-ES")}
                </CardDescription>
              </div>
              {getStatusBadge(exit)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exit.descripcion && (
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Descripción:
                  </p>
                  <p className="text-sm text-gray-600">{exit.descripcion}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Salida:</p>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="h-3 w-3" />
                    {new Date(exit.fecha_salida).toLocaleTimeString("es-ES")}
                  </div>
                  {exit.ubicacion_salida && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="h-3 w-3" />
                      Ubicación registrada
                    </div>
                  )}
                </div>

                {exit.fecha_regreso ? (
                  <div>
                    <p className="font-medium text-gray-700">Regreso:</p>
                    <div className="flex items-center gap-1 text-gray-600">
                      <ArrowLeft className="h-3 w-3" />
                      {new Date(exit.fecha_regreso).toLocaleTimeString("es-ES")}
                    </div>
                    {exit.ubicacion_regreso && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="h-3 w-3" />
                        Ubicación registrada
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">Estado:</p>
                    <p className="text-yellow-600">En curso</p>
                    <p className="text-xs text-gray-500">
                      Duración actual:{" "}
                      {formatDuration(
                        calculateCurrentDuration(exit.fecha_salida)
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Mostrar siempre si la duración existe o es cero */}
              {exit.duracion_minutos !== undefined && (
                <div className="pt-2 border-t">
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">
                      Duración total:
                    </span>{" "}
                    <span className="text-blue-600">
                      {formatDuration(exit.duracion_minutos)}
                    </span>
                  </p>
                </div>
              )}

              {!exit.fecha_regreso && (
                <div className="pt-2 border-t">
                  <Button
                    onClick={() => handleMarkReturn(exit.id)}
                    disabled={returningIds.has(exit.id)}
                    size="sm"
                    className="w-full"
                  >
                    {returningIds.has(exit.id)
                      ? "Registrando regreso..."
                      : "Marcar Regreso"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SpontaneousExitHistory;
