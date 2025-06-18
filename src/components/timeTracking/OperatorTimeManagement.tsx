
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion, SalidaEspontanea } from '../../types';
import AutoTimeTracker from './AutoTimeTracker';
import SpontaneousExitForm from './SpontaneousExitForm';
import SpontaneousExitHistory from './SpontaneousExitHistory';

interface OperatorTimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  spontaneousExits?: SalidaEspontanea[];
  onExitRegistered?: (exit: SalidaEspontanea) => void;
  onExitReturn?: (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => void;
}

const OperatorTimeManagement = ({ 
  user, 
  selectedPoint, 
  spontaneousExits = [], 
  onExitRegistered,
  onExitReturn 
}: OperatorTimeManagementProps) => {
  const [localSpontaneousExits, setLocalSpontaneousExits] = useState<SalidaEspontanea[]>([]);

  const currentExits = spontaneousExits.length > 0 ? spontaneousExits : localSpontaneousExits;

  const handleExitRegistered = (exit: SalidaEspontanea) => {
    if (onExitRegistered) {
      onExitRegistered(exit);
    } else {
      setLocalSpontaneousExits(prev => [...prev, exit]);
    }
  };

  const handleExitReturn = (exitId: string, returnData: { lat: number; lng: number; direccion?: string }) => {
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
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Control de Horarios</h1>
        <p className="text-gray-600">Gestiona tu jornada laboral y salidas espontáneas</p>
      </div>

      <Tabs defaultValue="tracker" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tracker">Mi Jornada</TabsTrigger>
          <TabsTrigger value="spontaneous">Salidas Espontáneas</TabsTrigger>
          <TabsTrigger value="history">Mi Historial</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tracker">
          <AutoTimeTracker 
            user={user} 
            selectedPoint={selectedPoint}
          />
        </TabsContent>
        
        <TabsContent value="spontaneous">
          <SpontaneousExitForm
            user={user}
            selectedPoint={selectedPoint}
            onExit Registered={handleExitRegistered}
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

export default OperatorTimeManagement;
