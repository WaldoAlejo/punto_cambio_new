
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, PuntoAtencion, SalidaEspontanea } from '../../types';
import TimeTracker from './TimeTracker';
import SpontaneousExitForm from './SpontaneousExitForm';
import SpontaneousExitHistory from './SpontaneousExitHistory';

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  spontaneousExits?: SalidaEspontanea[];
  onExitRegistered?: (exit: SalidaEspontanea) => void;
  onExitReturn?: (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => void;
}

const TimeManagement = ({ 
  user, 
  selectedPoint, 
  spontaneousExits = [], 
  onExitRegistered,
  onExitReturn 
}: TimeManagementProps) => {
  const [localSpontaneousExits, setLocalSpontaneousExits] = useState<SalidaEspontanea[]>([]);
  const { toast } = useToast();

  // Use either the passed exits or local state
  const currentExits = spontaneousExits.length > 0 ? spontaneousExits : localSpontaneousExits;

  const handleExitRegistered = (exit: SalidaEspontanea) => {
    try {
      if (onExitRegistered) {
        onExitRegistered(exit);
      } else {
        setLocalSpontaneousExits(prev => [...prev, exit]);
      }
      
      toast({
        title: "Salida registrada",
        description: `Salida espontánea por ${exit.motivo.toLowerCase()} registrada correctamente`,
      });
    } catch (error) {
      console.error('Error registering exit:', error);
      toast({
        title: "Error",
        description: "Error al registrar la salida espontánea",
        variant: "destructive"
      });
    }
  };

  const handleExitReturn = (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => {
    try {
      if (onExitReturn) {
        onExitReturn(exitId, returnData);
      } else {
        setLocalSpontaneousExits(prev => prev.map(exit => 
          exit.id === exitId 
            ? { 
                ...exit, 
                fecha_regreso: new Date().toISOString(),
                ubicacion_regreso: returnData,
                duracion_minutos: Math.round((new Date().getTime() - new Date(exit.fecha_salida).getTime()) / (1000 * 60))
              }
            : exit
        ));
      }
      
      toast({
        title: "Regreso registrado",
        description: "Se ha registrado el regreso de la salida espontánea",
      });
    } catch (error) {
      console.error('Error registering return:', error);
      toast({
        title: "Error",
        description: "Error al registrar el regreso",
        variant: "destructive"
      });
    }
  };

  // Validación de punto seleccionado para operadores
  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO' && !selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-amber-600 text-lg">Debe seleccionar un punto de atención para continuar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="tracker" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tracker">Control de Horarios</TabsTrigger>
          <TabsTrigger value="spontaneous">Salidas Espontáneas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tracker">
          <TimeTracker 
            user={user} 
            selectedPoint={selectedPoint}
            spontaneousExits={currentExits}
          />
        </TabsContent>
        
        <TabsContent value="spontaneous">
          <SpontaneousExitForm
            user={user}
            selectedPoint={selectedPoint}
            onExitRegistered={handleExitRegistered}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <SpontaneousExitHistory
            exits={currentExits}
            onExitReturn={handleExitReturn}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TimeManagement;
