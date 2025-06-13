
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { LogOut, MapPin } from "lucide-react";
import { SalidaEspontanea, User, PuntoAtencion } from '../../types';

interface SpontaneousExitFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExitRegistered: (exit: SalidaEspontanea) => void;
}

const SpontaneousExitForm = ({ user, selectedPoint, onExitRegistered }: SpontaneousExitFormProps) => {
  const [exitData, setExitData] = useState({
    motivo: '',
    descripcion: ''
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const getLocation = (): Promise<{ lat: number; lng: number; direccion?: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsGettingLocation(false);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            direccion: 'Ubicación actual'
          });
        },
        (error) => {
          setIsGettingLocation(false);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const registerExit = async () => {
    if (!exitData.motivo) {
      toast({
        title: "Error",
        description: "Debe seleccionar un motivo de salida",
        variant: "destructive"
      });
      return;
    }

    try {
      let ubicacion;
      try {
        ubicacion = await getLocation();
      } catch (error) {
        console.log('No se pudo obtener ubicación:', error);
      }

      const newExit: SalidaEspontanea = {
        id: Date.now().toString(),
        usuario_id: user.id,
        punto_atencion_id: selectedPoint?.id || '',
        fecha_salida: new Date().toISOString(),
        motivo: exitData.motivo as any,
        descripcion: exitData.descripcion,
        ubicacion_salida: ubicacion
      };

      onExitRegistered(newExit);

      // Reset form
      setExitData({ motivo: '', descripcion: '' });

      toast({
        title: "Salida registrada",
        description: `Salida espontánea registrada por ${exitData.motivo.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al registrar la salida",
        variant: "destructive"
      });
    }
  };

  const motivosOptions = [
    { value: 'DEPOSITO', label: 'Depósito' },
    { value: 'RETIRO', label: 'Retiro' },
    { value: 'MOVILIZACION_DIVISAS', label: 'Movilización de Divisas' },
    { value: 'OTROS', label: 'Otros' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="h-5 w-5" />
          Registrar Salida Espontánea
        </CardTitle>
        <CardDescription>
          Las salidas espontáneas no afectan el horario total de labores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo de Salida</Label>
            <Select 
              value={exitData.motivo} 
              onValueChange={(value) => setExitData(prev => ({ ...prev, motivo: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción (Opcional)</Label>
            <Textarea
              value={exitData.descripcion}
              onChange={(e) => setExitData(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Describa brevemente el motivo de la salida..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              {isGettingLocation ? 'Obteniendo ubicación...' : 'Se registrará la ubicación automáticamente'}
            </div>
          </div>

          <Button 
            onClick={registerExit}
            className="w-full"
            disabled={!exitData.motivo || isGettingLocation}
          >
            Registrar Salida
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpontaneousExitForm;
