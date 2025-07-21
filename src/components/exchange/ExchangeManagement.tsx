import { useRef } from "react";
import { User, PuntoAtencion } from "../../types";
import { useExchangeData } from "../../hooks/useExchangeData";
import { useExchangeProcess } from "../../hooks/useExchangeProcess";
import ExchangeSteps, { ExchangeStepsRef } from "./ExchangeSteps";
import ExchangeList from "./ExchangeList";
import PendingExchangesList from "./PendingExchangesList";

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const ExchangeManagement = ({
  user,
  selectedPoint,
}: ExchangeManagementProps) => {
  const stepsRef = useRef<ExchangeStepsRef>(null);
  const {
    currencies,
    exchanges,
    isLoadingCurrencies,
    addExchange,
    error: dataError,
  } = useExchangeData(selectedPoint);

  const { isProcessing, processExchange } = useExchangeProcess({
    user,
    selectedPoint,
    onExchangeCreated: addExchange,
    onResetForm: () => stepsRef.current?.resetSteps(),
  });

  if (!user) {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Cargando usuario...
      </div>
    );
  }

  if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Los cambios de divisas solo pueden ser realizados por operadores y
        concesiones
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

  // NUEVO: Mostrar error de carga de monedas
  if (dataError) {
    return (
      <div className="p-6 text-center py-12 text-red-500 text-lg">
        Error al cargar datos: {dataError}
      </div>
    );
  }

  // NUEVO: Validar que sí existan monedas para operar
  if (!currencies || currencies.length < 2) {
    return (
      <div className="p-6 text-center py-12 text-red-500 text-lg">
        Debe haber al menos dos monedas registradas para operar un cambio.
        Solicite al administrador registrar monedas.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header mejorado */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Cambio de Divisas</h1>
              <p className="text-muted-foreground">Gestiona tus operaciones de cambio de forma eficiente</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Punto de Atención</p>
              <p className="text-lg font-semibold text-primary">{selectedPoint?.nombre}</p>
            </div>
          </div>
        </div>

        {/* Formulario principal - Ocupa todo el ancho disponible */}
        <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
          {isProcessing ? (
            <div className="text-center py-16 px-6">
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary/20 border-t-primary mx-auto"></div>
              <p className="mt-6 text-lg text-muted-foreground">Procesando cambio...</p>
            </div>
          ) : (
            <ExchangeSteps
              ref={stepsRef}
              currencies={currencies}
              onComplete={processExchange}
            />
          )}
        </div>

        {/* Listas debajo del formulario - Grid de 2 columnas */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Lista de cambios recientes */}
          <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
            <ExchangeList exchanges={exchanges || []} currencies={currencies} />
          </div>
          
          {/* Cambios pendientes */}
          <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
            <PendingExchangesList 
              user={user}
              selectedPoint={selectedPoint}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeManagement;
