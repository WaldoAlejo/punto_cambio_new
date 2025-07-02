import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion } from "../../types";
import AutoTimeTracker from "./AutoTimeTracker";
import SpontaneousExitForm from "./SpontaneousExitForm";
import SpontaneousExitHistory from "./SpontaneousExitHistory";
import {
  spontaneousExitService,
  SpontaneousExit,
} from "../../services/spontaneousExitService";
import { toast } from "@/hooks/use-toast";

interface OperatorTimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const OperatorTimeManagement = ({
  user,
  selectedPoint,
}: OperatorTimeManagementProps) => {
  const [spontaneousExits, setSpontaneousExits] = useState<SpontaneousExit[]>(
    []
  );
  const [isLoadingExits, setIsLoadingExits] = useState(true);
  const [showExitForm, setShowExitForm] = useState(false);

  useEffect(() => {
    loadSpontaneousExits();
  }, []);

  const loadSpontaneousExits = async () => {
    try {
      setIsLoadingExits(true);
      const { exits, error } = await spontaneousExitService.getAllExits();

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        setSpontaneousExits(exits);
      }
    } catch {
      toast({
        title: "Error",
        description: "Error al cargar las salidas espontáneas",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExits(false);
    }
  };

  const handleExitRegistered = (exit: SpontaneousExit) => {
    setSpontaneousExits((prev) => [exit, ...prev]);
    setShowExitForm(false);
    toast({
      title: "Salida registrada",
      description: `Salida espontánea por ${exit.motivo
        .toLowerCase()
        .replace("_", " ")} registrada correctamente`,
    });
  };

  const handleExitReturn = async (
    exitId: string,
    returnData: { lat: number; lng: number; direccion?: string }
  ) => {
    try {
      const { exit: updatedExit, error } =
        await spontaneousExitService.markReturn(exitId, {
          ubicacion_regreso: returnData,
        });

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      if (updatedExit) {
        setSpontaneousExits((prev) =>
          prev.map((exit) => (exit.id === exitId ? updatedExit : exit))
        );

        toast({
          title: "Regreso registrado",
          description: "Se ha registrado el regreso de la salida espontánea",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Error al registrar el regreso",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Control de Horarios
        </h1>
        <p className="text-gray-600">
          Gestiona tu jornada laboral y salidas espontáneas
        </p>
      </div>

      <Tabs defaultValue="tracker" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tracker">Mi Jornada</TabsTrigger>
          <TabsTrigger value="spontaneous">Salidas Espontáneas</TabsTrigger>
          <TabsTrigger value="history">Mi Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          <AutoTimeTracker user={user} selectedPoint={selectedPoint} />
        </TabsContent>

        <TabsContent value="spontaneous">
          <div className="space-y-6">
            <button
              onClick={() => setShowExitForm(true)}
              className="mb-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Registrar Salida Espontánea
            </button>

            {showExitForm && (
              <SpontaneousExitForm
                user={user}
                selectedPoint={selectedPoint}
                onExitRegistered={handleExitRegistered}
                onCancel={() => setShowExitForm(false)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          {isLoadingExits ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando historial...</p>
            </div>
          ) : (
            <SpontaneousExitHistory
              exits={spontaneousExits}
              onExitReturn={handleExitReturn}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperatorTimeManagement;
