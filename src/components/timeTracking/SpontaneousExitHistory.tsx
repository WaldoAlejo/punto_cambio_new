
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { SalidaEspontanea } from '../../types';

interface SpontaneousExitHistoryProps {
  exits: SalidaEspontanea[];
  onExitReturn: (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => void;
}

const SpontaneousExitHistory = ({ exits, onExitReturn }: SpontaneousExitHistoryProps) => {
  const [isGettingLocation, setIsGettingLocation] = useState<string | null>(null);

  const getLocation = (): Promise<{ lat: number; lng: number; direccion?: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            direccion: 'Ubicación de regreso'
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const handleReturn = async (exitId: string) => {
    try {
      setIsGettingLocation(exitId);
      const ubicacion = await getLocation();
      onExitReturn(exitId, ubicacion);
      
      toast({
        title: "Regreso registrado",
        description: "Se ha registrado el regreso de la salida espontánea",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo obtener la ubicación de regreso",
        variant: "destructive"
      });
    } finally {
      setIsGettingLocation(null);
    }
  };

  const formatearHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearDuracion = (minutos: number) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  };

  const getMotivoColor = (motivo: string) => {
    switch (motivo) {
      case 'DEPOSITO': return 'bg-blue-500';
      case 'RETIRO': return 'bg-green-500';
      case 'MOVILIZACION_DIVISAS': return 'bg-orange-500';
      case 'OTROS': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getMotivoLabel = (motivo: string) => {
    switch (motivo) {
      case 'DEPOSITO': return 'Depósito';
      case 'RETIRO': return 'Retiro';
      case 'MOVILIZACION_DIVISAS': return 'Movilización de Divisas';
      case 'OTROS': return 'Otros';
      default: return motivo;
    }
  };

  if (exits.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">
            No hay salidas espontáneas registradas hoy
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Historial de Salidas Espontáneas</h2>
      
      {exits.map((exit) => (
        <Card key={exit.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                <Badge className={`${getMotivoColor(exit.motivo)} text-white`}>
                  {getMotivoLabel(exit.motivo)}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                {formatearHora(exit.fecha_salida)}
              </div>
            </div>
            {exit.descripcion && (
              <CardDescription>{exit.descripcion}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Hora de Salida:</span>
                  <div>{formatearHora(exit.fecha_salida)}</div>
                </div>
                <div>
                  <span className="font-medium">Hora de Regreso:</span>
                  <div>
                    {exit.fecha_regreso ? formatearHora(exit.fecha_regreso) : 
                      <Badge variant="destructive">Sin regreso</Badge>
                    }
                  </div>
                </div>
                {exit.duracion_minutos && (
                  <div className="col-span-2">
                    <span className="font-medium">Duración:</span>
                    <div>{formatearDuracion(exit.duracion_minutos)}</div>
                  </div>
                )}
              </div>

              {exit.ubicacion_salida && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>Ubicación registrada: {exit.ubicacion_salida.direccion}</span>
                </div>
              )}

              {!exit.fecha_regreso && (
                <Button
                  onClick={() => handleReturn(exit.id)}
                  disabled={isGettingLocation === exit.id}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {isGettingLocation === exit.id ? 'Registrando regreso...' : 'Registrar Regreso'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SpontaneousExitHistory;
