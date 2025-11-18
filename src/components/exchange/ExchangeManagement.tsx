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
      <div className="w-full p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Encabezado */}
        <div className="bg-card rounded-xl shadow-lg p-4 sm:p-6 border border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary mb-1 sm:mb-2">
                💱 Cambio de Divisas
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
                Gestiona las operaciones donde el cliente entrega una divisa y
                recibe otra.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Punto de Atención</p>
              <p className="text-lg font-semibold text-primary truncate max-w-[260px]">
                {selectedPoint?.nombre}
              </p>
              {onReturnToDashboard && (
                <div className="mt-3">
                  <Button variant="outline" onClick={onReturnToDashboard}>
                    Volver al panel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario principal */}
        <div className="bg-card rounded-xl shadow-lg border border-border/50 overflow-hidden">
          {isProcessing ? (
            <div className="text-center py-16 px-6">
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary/20 border-t-primary mx-auto" />
              <p className="mt-6 text-lg text-muted-foreground">
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

        {/* Listas */}
        <div className="grid lg:grid-cols-2 gap-8">
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
