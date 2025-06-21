
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Clock } from 'lucide-react';
import { User, PuntoAtencion } from '../../types';
import { toast } from "@/hooks/use-toast";
import { spontaneousExitService, SpontaneousExit } from '../../services/spontaneousExitService';

interface SpontaneousExitFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExitRegistered?: (exit: SpontaneousExit) => void;
}

const motivoOptions = [
  { value: 'BANCO', label: 'Banco' },
  { value: 'DILIGENCIA_PERSONAL', label: 'Diligencia Personal' },
  { value: 'TRAMITE_GOBIERNO', label: 'Trámite de Gobierno' },
  { value: 'EMERGENCIA_MEDICA', label: 'Emergencia Médica' },
  { value: 'OTRO', label: 'Otro' }
];

const SpontaneousExitForm = ({ user, selectedPoint, onExitRegistered }: SpontaneousExitFormProps) => {
  const [motivo, setMotivo] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGettingLocation(false);
        toast({
          title: "Ubicación obtenida",
          description: "Se ha registrado tu ubicación actual",
        });
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        setGettingLocation(false);
        toast({
          title: "Error",
          description: "No se pudo obtener la ubicación. Inténtalo de nuevo.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!motivo) {
      toast({
        title: "Error",
        description: "Debe seleccionar un motivo para la salida",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const exitData = {
        motivo: motivo as any,
        descripcion: descripcion || undefined,
        ubicacion_salida: location || undefined
      };

      const { exit, error } = await spontaneousExitService.createExit(exitData);

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else if (exit) {
        toast({
          title: "Salida registrada",
          description: `Se ha registrado tu salida espontánea por ${motivoOptions.find(m => m.value === motivo)?.label}`,
        });
        
        // Limpiar formulario
        setMotivo('');
        setDescripcion('');
        setLocation(null);
        
        // Notificar al componente padre
        if (onExitRegistered) {
          onExitRegistered(exit);
        }
      }
    } catch (error) {
      console.error('Error creating exit:', error);
      toast({
        title: "Error",
        description: "Error al registrar la salida espontánea",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (user.rol !== 'OPERADOR') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Las salidas espontáneas son solo para operadores</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Registrar Salida Espontánea
        </CardTitle>
        <CardDescription>
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Selecciona un punto de atención'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="motivo">Motivo de la salida *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivoOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              placeholder="Describe los detalles de tu salida..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={gettingLocation}
              className="flex items-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              {gettingLocation ? 'Obteniendo...' : 'Obtener Ubicación'}
            </Button>
            {location && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Ubicación registrada
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={isLoading || !motivo || !selectedPoint}
              className="flex-1"
            >
              {isLoading ? 'Registrando...' : 'Registrar Salida'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SpontaneousExitForm;
