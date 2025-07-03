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
          <div>
            {loadingExits ? (
              <div className="text-center p-4 text-gray-400">
                Cargando historial...
              </div>
            ) : (
              <SpontaneousExitHistory exits={exits} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeManagement;
