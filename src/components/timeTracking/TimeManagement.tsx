import { useState, useEffect } from "react";
import TimeTracker from "./TimeTracker";
import SpontaneousExitForm from "./SpontaneousExitForm";
import SpontaneousExitHistory from "./SpontaneousExitHistory";
import { User, PuntoAtencion, SalidaEspontanea } from "../../types";
import { spontaneousExitService } from "../../services/spontaneousExitService";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

type TabType = "mi-jornada" | "salidas-espontaneas" | "mi-historial";

const TimeManagement = ({ user, selectedPoint }: TimeManagementProps) => {
  const [selectedTab, setSelectedTab] = useState<TabType>("mi-jornada");
  const [exits, setExits] = useState<SalidaEspontanea[]>([]);
  const [showExitForm, setShowExitForm] = useState(false);
  const [loadingExits, setLoadingExits] = useState(false);
  const [schedules, setSchedules] = useState<
    {
      id: string;
      fecha_inicio: string;
      fecha_almuerzo?: string | null;
      fecha_regreso?: string | null;
      fecha_salida?: string | null;
      estado: string;
    }[]
  >([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  useEffect(() => {
    if (
      selectedTab === "salidas-espontaneas" ||
      selectedTab === "mi-historial"
    ) {
      setLoadingExits(true);
      spontaneousExitService
        .getAllExits(user.id)
        .then(({ exits, error }) => {
          setExits(error ? [] : (exits as SalidaEspontanea[]));
          if (error) {
            toast({
              title: "Error",
              description:
                "No se pudo cargar el historial de salidas espontáneas.",
              variant: "destructive",
            });
          }
        })
        .finally(() => setLoadingExits(false));
    }

    if (selectedTab === "mi-historial") {
      // Cargar últimas 4 semanas de jornadas del usuario
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 28);
      setLoadingSchedules(true);
      import("@/services/scheduleService").then(({ scheduleService }) =>
        scheduleService
          .getAllSchedules({
            usuario_id: user.id,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            limit: 200,
          })
          .then(({ schedules, error }) => {
            if (error) {
              setSchedules([]);
              toast({
                title: "Error",
                description: "No se pudo cargar el historial de jornadas.",
                variant: "destructive",
              });
            } else {
              setSchedules(
                (schedules || []).map((s) => ({
                  id: s.id,
                  fecha_inicio: s.fecha_inicio,
                  fecha_almuerzo: s.fecha_almuerzo,
                  fecha_regreso: s.fecha_regreso,
                  fecha_salida: s.fecha_salida,
                  estado: s.estado,
                }))
              );
            }
          })
          .finally(() => setLoadingSchedules(false))
      );
    }
    // 🔴 Quitamos 'toast' de dependencias:
  }, [selectedTab, user.id, showExitForm]);

  const handleExitRegistered = () => {
    setShowExitForm(false);
    setSelectedTab("mi-historial");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        Control de Horarios
      </h1>
      <p className="mb-6 text-gray-500">
        Gestiona tu jornada laboral y salidas espontáneas
      </p>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            selectedTab === "mi-jornada"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
          onClick={() => setSelectedTab("mi-jornada")}
        >
          Mi Jornada
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            selectedTab === "salidas-espontaneas"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
          onClick={() => setSelectedTab("salidas-espontaneas")}
        >
          Salidas Espontáneas
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            selectedTab === "mi-historial"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
          onClick={() => setSelectedTab("mi-historial")}
        >
          Mi Historial
        </button>
      </div>

      {/* Contenido de los tabs */}
      <div>
        {selectedTab === "mi-jornada" && (
          <TimeTracker
            user={user}
            selectedPoint={selectedPoint}
            spontaneousExits={exits}
          />
        )}

        {selectedTab === "salidas-espontaneas" && (
          <>
            {!showExitForm ? (
              <Card>
                <CardContent className="py-8 flex flex-col items-center">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                    onClick={() => setShowExitForm(true)}
                  >
                    Registrar Salida Espontánea
                  </button>
                </CardContent>
              </Card>
            ) : (
              <SpontaneousExitForm
                user={user}
                selectedPoint={selectedPoint}
                onExitRegistered={handleExitRegistered}
                onCancel={() => setShowExitForm(false)}
              />
            )}
          </>
        )}

        {selectedTab === "mi-historial" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold mb-2">
                Mis Jornadas (últimos 28 días)
              </h2>
              {loadingSchedules ? (
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
                        const toTime = (v?: string | null) =>
                          v
                            ? new Date(v).toLocaleTimeString("es-EC", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-";
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
              {loadingExits ? (
                <div className="text-center p-4 text-gray-400">
                  Cargando historial...
                </div>
              ) : (
                <SpontaneousExitHistory exits={exits} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeManagement;
