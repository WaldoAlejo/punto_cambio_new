import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion, SalidaEspontanea } from "../../types";
import AutoTimeTracker from "./AutoTimeTracker";
import TimeTracker from "./TimeTracker";
import SpontaneousExitForm from "./SpontaneousExitForm";
import SpontaneousExitHistory from "./SpontaneousExitHistory";
import {
  spontaneousExitService,
  SpontaneousExit,
} from "../../services/spontaneousExitService";
import { scheduleService, Schedule } from "../../services/scheduleService";
import { toast } from "@/hooks/use-toast";

interface OperatorTimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const OperatorTimeManagement = ({
  user,
  selectedPoint,
}: OperatorTimeManagementProps) => {
  const [spontaneousExits, setSpontaneousExits] = useState<SalidaEspontanea[]>(
    []
  );
  const [isLoadingExits, setIsLoadingExits] = useState(true);
  const [showExitForm, setShowExitForm] = useState(false);

  // New state for schedules history
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [activeTab, setActiveTab] = useState("tracker");

  useEffect(() => {
    loadSpontaneousExits();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadSchedulesHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
        // Convertir SpontaneousExit a SalidaEspontanea
        const convertedExits: SalidaEspontanea[] = exits.map((exit) => ({
          id: exit.id,
          usuario_id: exit.usuario_id,
          punto_atencion_id: exit.punto_atencion_id,
          motivo: exit.motivo,
          descripcion: exit.descripcion,
          fecha_salida: exit.fecha_salida,
          fecha_regreso: exit.fecha_regreso,
          ubicacion_salida: exit.ubicacion_salida,
          ubicacion_regreso: exit.ubicacion_regreso,
          duracion_minutos: exit.duracion_minutos,
          aprobado_por: exit.aprobado_por,
          created_at: exit.created_at,
          updated_at: exit.updated_at,
          estado: exit.estado,
          usuario: {
            id: exit.usuario?.id || "",
            username: exit.usuario?.username || "",
            nombre: exit.usuario?.nombre || "",
            correo: "",
            telefono: "",
            rol: "OPERADOR" as const,
            activo: true,
            created_at: "",
            updated_at: "",
          },
        }));
        setSpontaneousExits(convertedExits);
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

  const loadSchedulesHistory = async () => {
    try {
      setIsLoadingSchedules(true);
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 28);

      const { schedules: result, error } =
        await scheduleService.getAllSchedules({
          usuario_id: user.id,
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          limit: 200,
        });

      if (error) {
        setSchedules([]);
        toast({
          title: "Error",
          description: "No se pudo cargar el historial de jornadas.",
          variant: "destructive",
        });
      } else {
        setSchedules(result);
      }
    } catch (e) {
      setSchedules([]);
      toast({
        title: "Error",
        description: "Ocurrió un error al cargar las jornadas",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const handleExitRegistered = (exit: SalidaEspontanea) => {
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
        // Convertir el exit actualizado
        const convertedExit: SalidaEspontanea = {
          id: updatedExit.id,
          usuario_id: updatedExit.usuario_id,
          punto_atencion_id: updatedExit.punto_atencion_id,
          motivo: updatedExit.motivo,
          descripcion: updatedExit.descripcion,
          fecha_salida: updatedExit.fecha_salida,
          fecha_regreso: updatedExit.fecha_regreso,
          ubicacion_salida: updatedExit.ubicacion_salida,
          ubicacion_regreso: updatedExit.ubicacion_regreso,
          duracion_minutos: updatedExit.duracion_minutos,
          aprobado_por: updatedExit.aprobado_por,
          created_at: updatedExit.created_at,
          updated_at: updatedExit.updated_at,
          estado: updatedExit.estado,
          usuario: {
            id: updatedExit.usuario?.id || "",
            username: updatedExit.usuario?.username || "",
            nombre: updatedExit.usuario?.nombre || "",
            correo: "",
            telefono: "",
            rol: "OPERADOR" as const,
            activo: true,
            created_at: "",
            updated_at: "",
          },
        };

        setSpontaneousExits((prev) =>
          prev.map((exit) => (exit.id === exitId ? convertedExit : exit))
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

  const toTime = (v?: string | null) =>
    v
      ? new Date(v).toLocaleTimeString("es-EC", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tracker">Mi Jornada</TabsTrigger>
          <TabsTrigger value="lunch">Almuerzo</TabsTrigger>
          <TabsTrigger value="spontaneous">Salidas Espontáneas</TabsTrigger>
          <TabsTrigger value="history">Mi Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker">
          <AutoTimeTracker user={user} selectedPoint={selectedPoint} />
        </TabsContent>

        <TabsContent value="lunch">
          <TimeTracker
            user={user}
            selectedPoint={selectedPoint}
            spontaneousExits={spontaneousExits}
          />
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
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold mb-2">
                Mis Jornadas (últimos 28 días)
              </h2>
              {isLoadingSchedules ? (
                <div className="text-center p-4 text-gray-400">
                  Cargando jornadas...
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center p-4 text-gray-400">
                  No hay jornadas en el período
                </div>
              ) : (
                <div className="overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Inicio</th>
                        <th className="px-3 py-2 text-left">Almuerzo</th>
                        <th className="px-3 py-2 text-left">Regreso</th>
                        <th className="px-3 py-2 text-left">Salida</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((s) => {
                        const d = new Date(s.fecha_inicio);
                        return (
                          <tr key={s.id} className="border-t">
                            <td className="px-3 py-2">
                              {d.toLocaleDateString("es-EC")}
                            </td>
                            <td className="px-3 py-2">
                              {toTime(s.fecha_inicio)}
                            </td>
                            <td className="px-3 py-2">
                              {toTime(s.fecha_almuerzo)}
                            </td>
                            <td className="px-3 py-2">
                              {toTime(s.fecha_regreso)}
                            </td>
                            <td className="px-3 py-2">
                              {toTime(s.fecha_salida)}
                            </td>
                            <td className="px-3 py-2">{s.estado}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-semibold mb-2">Mis Salidas Espontáneas</h2>
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperatorTimeManagement;
