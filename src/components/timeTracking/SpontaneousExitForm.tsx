
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Save, X } from "lucide-react";
import { User, PuntoAtencion } from '../../types';
import { spontaneousExitService } from '../../services/spontaneousExitService';
import { useToast } from "@/hooks/use-toast";

interface SpontaneousExitFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExitRegistered: () => void;
  onCancel: () => void;
}

const exitTypes = [
  { value: 'BATHROOM', label: 'Baño' },
  { value: 'LUNCH', label: 'Almuerzo' },
  { value: 'BREAK', label: 'Descanso' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'MEDICAL', label: 'Médico' },
  { value: 'OTHER', label: 'Otro' }
];

const SpontaneousExitForm = ({ user, selectedPoint, onExitRegistered, onCancel }: SpontaneousExitFormProps) => {
  const [exitType, setExitType] = useState('');
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!exitType || !duration) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "No hay punto de atención seleccionado",
        variant: "destructive"
      });
      return;
    }

    const durationMinutes = parseInt(duration);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      toast({
        title: "Error",
        description: "La duración debe ser un número válido mayor a 0",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const exitData = {
        user_id: user.id,
        punto_atencion_id: selectedPoint.id,
        tipo_salida: exitType,
        duracion_minutos: durationMinutes,
        motivo: reason || null,
        fecha_salida: new Date().toISOString(),
        hora_salida: new Date().toLocaleTimeString('es-ES', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      console.warn('Registering spontaneous exit:', exitData);

      const { exit, error } = await spontaneousExitService.createSpontaneousExit(exitData);

      if (error || !exit) {
        throw new Error(error || 'Error desconocido al registrar salida');
      }

      toast({
        title: "Salida registrada",
        description: `Salida espontánea de ${durationMinutes} minutos registrada exitosamente`,
      });

      // Reset form
      setExitType('');
      setDuration('');
      setReason('');
      
      onExitRegistered();
      
    } catch (error) {
      console.error('Error registering spontaneous exit:', error);
      toast({
        title: "Error",
        description: "Error al registrar la salida espontánea",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Registrar Salida Espontánea
        </CardTitle>
        <CardDescription>
          Registre una salida espontánea indicando el tipo, duración y motivo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exitType">Tipo de Salida *</Label>
              <Select value={exitType} onValueChange={setExitType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {exitTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (minutos) *</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="15"
                min="1"
                max="480"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (Opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descripción adicional del motivo de la salida..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? 'Registrando...' : 'Registrar Salida'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SpontaneousExitForm;
