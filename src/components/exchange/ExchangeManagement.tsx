
import { useRef } from "react";
import { User, PuntoAtencion } from "../../types";
import { useExchangeData } from "../../hooks/useExchangeData";
import { useExchangeProcess } from "../../hooks/useExchangeProcess";
import ExchangeSteps, { ExchangeStepsRef } from "./ExchangeSteps";
import ExchangeList from "./ExchangeList";

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const ExchangeManagement = ({ user, selectedPoint }: ExchangeManagementProps) => {
  const stepsRef = useRef<ExchangeStepsRef>(null);
  const { exchanges, currencies, isLoadingCurrencies, addExchange } = useExchangeData();
  
  const { isProcessing, processExchange } = useExchangeProcess({
    user,
    selectedPoint,
    onExchangeCreated: addExchange,
    onResetForm: () => stepsRef.current?.resetSteps()
  });

  if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Los cambios de divisas solo pueden ser realizados por operadores y concesiones
      </div>
    );
  }

  if (!selectedPoint) {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Debe seleccionar un punto de atención
      </div>
    );
  }

  if (isLoadingCurrencies) {
    return (
      <div className="p-6 text-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando monedas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cambio de Divisas</h1>
        <div className="text-sm text-gray-500">
          Punto: {selectedPoint?.nombre}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {isProcessing ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Procesando cambio...</p>
            </div>
          ) : (
            <ExchangeSteps
              ref={stepsRef}
              currencies={currencies}
              onComplete={processExchange}
            />
          )}
        </div>

        <ExchangeList exchanges={exchanges} currencies={currencies} />
      </div>
    </div>
  );
};

export default ExchangeManagement;
