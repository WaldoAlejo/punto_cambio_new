import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { User, PuntoAtencion, CambioDivisa } from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { currencyService } from "../../services/currencyService";
import PartialPaymentForm from "./PartialPaymentForm";
import CompletePaymentForm from "./CompletePaymentForm";

interface PendingExchangesListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies?: any[];
  onReprintReceipt?: (exchange: CambioDivisa) => void;
}

const PendingExchangesList = ({
  user,
  selectedPoint,
  currencies = [],
  onReprintReceipt,
}: PendingExchangesListProps) => {
  const { ConfirmationDialog } = useConfirmationDialog();
  const [pendingExchanges, setPendingExchanges] = useState<CambioDivisa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para formularios
  const [showPartialPaymentForm, setShowPartialPaymentForm] = useState(false);
  const [exchangeForPartialPayment, setExchangeForPartialPayment] =
    useState<CambioDivisa | null>(null);
  const [showCompletePaymentForm, setShowCompletePaymentForm] = useState(false);
  const [exchangeForCompletePayment, setExchangeForCompletePayment] =
    useState<CambioDivisa | null>(null);

  // Estado para monedas (si no se proporcionan)
  const [internalCurrencies, setInternalCurrencies] = useState<any[]>([]);

  useEffect(() => {
    loadPendingExchanges();
  }, [selectedPoint]);

  useEffect(() => {
    if (currencies.length === 0) {
      loadCurrencies();
    }
  }, [currencies]);

  const loadCurrencies = async () => {
    try {
      const { currencies: loadedCurrencies, error } =
        await currencyService.getAllCurrencies();
      if (error) {
        toast.error(`Error al cargar monedas: ${error}`);
        return;
      }
      setInternalCurrencies(loadedCurrencies || []);
    } catch (error) {
      toast.error("Error al cargar monedas");
    }
  };

  // Usar las monedas proporcionadas o las cargadas internamente
  const availableCurrencies =
    currencies.length > 0 ? currencies : internalCurrencies;

  const loadPendingExchanges = async () => {
    if (!selectedPoint) return;

    setIsLoading(true);
    try {
      const { exchanges, error } =
        await exchangeService.getPendingExchangesByPoint(selectedPoint.id);
      if (error) {
        toast.error(`Error al cargar cambios pendientes: ${error}`);
        return;
      }
      setPendingExchanges(exchanges || []);
    } catch (error) {
      toast.error("Error al cargar cambios pendientes");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePartialPayment = (exchange: CambioDivisa) => {
    setExchangeForPartialPayment(exchange);
    setShowPartialPaymentForm(true);
  };

  const handlePartialPaymentComplete = async () => {
    setShowPartialPaymentForm(false);
    setExchangeForPartialPayment(null);
    await loadPendingExchanges();
  };

  const handlePartialPaymentCancel = () => {
    setShowPartialPaymentForm(false);
    setExchangeForPartialPayment(null);
  };

  const handleCompleteExchange = (exchange: CambioDivisa) => {
    setExchangeForCompletePayment(exchange);
    setShowCompletePaymentForm(true);
  };

  const handleCompletePaymentComplete = async () => {
    setShowCompletePaymentForm(false);
    setExchangeForCompletePayment(null);
    await loadPendingExchanges();
  };

  const handleCompletePaymentCancel = () => {
    setShowCompletePaymentForm(false);
    setExchangeForCompletePayment(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            Cargando cambios pendientes...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingExchanges.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">⏳ Cambios Pendientes</CardTitle>
          <CardDescription className="text-sm">
            No hay cambios de divisas con pagos pendientes
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">⏳ Cambios Pendientes</CardTitle>
          <CardDescription className="text-sm">
            {pendingExchanges.length} cambio(s) de divisas con pagos pendientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pendingExchanges.map((exchange) => (
              <div
                key={exchange.id}
                className="border rounded-lg p-3 bg-muted/20"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-sm">
                      {exchange.datos_cliente?.nombre}{" "}
                      {exchange.datos_cliente?.apellido}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Doc: {exchange.datos_cliente?.documento}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-800 text-xs"
                  >
                    {exchange.estado}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <strong>Cambio:</strong> {exchange.monto_origen}{" "}
                    {exchange.monedaOrigen?.codigo}→ {exchange.monto_destino}{" "}
                    {exchange.monedaDestino?.codigo}
                  </div>
                  <div>
                    <strong>Recibo:</strong> {exchange.numero_recibo}
                  </div>
                  <div>
                    <strong>Fecha:</strong>{" "}
                    {new Date(exchange.fecha).toLocaleDateString("es-ES")}
                  </div>
                  <div>
                    <strong>Saldo Pendiente:</strong>{" "}
                    {exchange.saldo_pendiente || exchange.monto_destino}{" "}
                    {exchange.monedaDestino?.codigo}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePartialPayment(exchange)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Registrar Abono
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteExchange(exchange)}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    Completar Pago
                  </Button>
                  {onReprintReceipt && exchange.numero_recibo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReprintReceipt(exchange)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      title="Reimprimir recibo"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog />

      {/* Modal para abono parcial usando PartialPaymentForm */}
      {showPartialPaymentForm && exchangeForPartialPayment && (
        <PartialPaymentForm
          exchange={exchangeForPartialPayment}
          user={user}
          selectedPoint={selectedPoint}
          currencies={availableCurrencies}
          onComplete={handlePartialPaymentComplete}
          onCancel={handlePartialPaymentCancel}
        />
      )}

      {/* Modal para completar pago usando CompletePaymentForm */}
      {showCompletePaymentForm && exchangeForCompletePayment && (
        <CompletePaymentForm
          exchange={exchangeForCompletePayment}
          user={user}
          selectedPoint={selectedPoint}
          onComplete={handleCompletePaymentComplete}
          onCancel={handleCompletePaymentCancel}
        />
      )}
    </>
  );
};

export default PendingExchangesList;
