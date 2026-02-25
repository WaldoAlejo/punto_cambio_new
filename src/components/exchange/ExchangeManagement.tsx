import { useRef, useMemo } from "react";
import { User, PuntoAtencion } from "../../types";
import { useExchangeData } from "../../hooks/useExchangeData";
import { useExchangeProcess } from "../../hooks/useExchangeProcess";
import ExchangeSteps, { ExchangeStepsRef } from "./ExchangeSteps";
import ExchangeList from "./ExchangeList";
import PendingExchangesList from "./PendingExchangesList";
import SaldosDivisasEnTiempoReal from "../contabilidad/SaldosDivisasEnTiempoReal";
import { Button } from "@/components/ui/button";

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onReturnToDashboard?: () => void;
}

type RolPermitido = "OPERADOR" | "CONCESION" | "ADMIN" | "SUPER_USUARIO";

const ExchangeManagement = ({
  user,
  selectedPoint,
  onReturnToDashboard,
}: ExchangeManagementProps) => {
  const stepsRef = useRef<ExchangeStepsRef>(null);

  const {
    currencies,
    exchanges,
    isLoadingCurrencies,
    addExchange,
    removeExchange,
    error: dataError,
  } = useExchangeData(selectedPoint);

  const { isProcessing, processExchange, reprintReceipt } = useExchangeProcess({
    user,
    selectedPoint,
    onExchangeCreated: addExchange,
    onResetForm: () => stepsRef.current?.resetSteps(),
    onReturnToDashboard,
  });

  // Derivados de rol
  const { isAdmin, canOperate } = useMemo(() => {
    const rol = (user?.rol || "") as RolPermitido;
    return {
      isAdmin: rol === "ADMIN" || rol === "SUPER_USUARIO",
      canOperate: rol === "OPERADOR" || rol === "CONCESION",
    };
  }, [user?.rol]);

  // === Guardas ===
  if (!user) {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Cargando usuario...
      </div>
    );
  }

  if (!canOperate && !isAdmin) {
    return (
      <div className="p-6 text-center py-12 text-gray-700">
        Los cambios de divisas solo pueden ser realizados por usuarios con rol{" "}
        <span className="font-semibold">OPERADOR</span>
        {" o "}
        <span className="font-semibold">CONCESION</span>.
        {onReturnToDashboard && (
          <div className="mt-6">
            <Button variant="outline" onClick={onReturnToDashboard}>
              Volver al panel
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!selectedPoint) {
    return (
      <div className="p-6 text-center py-12 text-gray-700">
        Debe seleccionar un punto de atención.
        {onReturnToDashboard && (
          <div className="mt-6">
            <Button variant="outline" onClick={onReturnToDashboard}>
              Volver al panel
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isLoadingCurrencies) {
    return (
      <div className="p-6 text-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Cargando monedas...</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="p-6 text-center py-12 text-red-500 text-lg">
        Error al cargar datos: {String(dataError)}
        <div className="mt-6">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

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
      <div className="w-full p-2 sm:p-3 md:p-4 lg:p-6 space-y-3 sm:space-y-4 md:space-y-6">
        {/* Encabezado Responsive */}
        <div className="bg-card rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary mb-0.5 sm:mb-1">
                💱 Cambio de Divisas
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Gestiona operaciones de cambio de divisa.
              </p>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
              <p className="text-xs text-muted-foreground">Punto</p>
              <p className="text-sm sm:text-base font-semibold text-primary truncate max-w-[200px] sm:max-w-[260px]">
                {selectedPoint?.nombre}
              </p>
              {onReturnToDashboard && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={onReturnToDashboard}>
                    Volver
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario principal */}
        <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
          {isProcessing ? (
            <div className="text-center py-8 sm:py-16 px-4 sm:px-6">
              <div className="animate-spin rounded-full h-12 w-12 sm:h-20 sm:w-20 border-4 border-primary/20 border-t-primary mx-auto" />
              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground">
                Procesando cambio...
              </p>
            </div>
          ) : (
            <ExchangeSteps
              ref={stepsRef}
              currencies={currencies}
              user={user}
              onComplete={processExchange}
            />
          )}
        </div>

        {/* Saldos en tiempo real */}
        <SaldosDivisasEnTiempoReal
          user={user}
          selectedPoint={selectedPoint}
          className="bg-card rounded-xl shadow-lg border border-border/50"
        />

        {/* Listas - Responsive: apiladas en móvil, lado a lado en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
            <ExchangeList
              exchanges={exchanges || []}
              currencies={currencies}
              onReprintReceipt={reprintReceipt}
              onDeleted={(id) => removeExchange(id)}
            />
          </div>

          <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
            <PendingExchangesList
              user={user}
              selectedPoint={selectedPoint}
              currencies={currencies}
              onReprintReceipt={reprintReceipt}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeManagement;
