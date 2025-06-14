
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion, SalidaEspontanea } from '../../types';
import TimeTracker from './TimeTracker';
import SpontaneousExitForm from './SpontaneousExitForm';
import SpontaneousExitHistory from './SpontaneousExitHistory';

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeManagement = ({ user, selectedPoint }: TimeManagementProps) => {
  const [spontaneousExits, setSpontaneousExits] = useState<SalidaEspontanea[]>([]);

  const handleExitRegistered = (exit: SalidaEspontanea) => {
    setSpontaneousExits(prev => [...prev, exit]);
  };

  const handleExitReturn = (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => {
    setSpontaneousExits(prev => prev.map(exit => 
      exit.id === exitId 
        ? { 
            ...exit, 
            fecha_regreso: new Date().toISOString(),
            ubicacion_regreso: returnData,
            duracion_minutos: Math.round((new Date().getTime() - new Date(exit.fecha_salida).getTime()) / (1000 * 60))
          }
        : exit
    ));
  };

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
            spontaneousExits={spontaneousExits}
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
            exits={spontaneousExits}
            onExitReturn={handleExitReturn}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TimeManagement;
