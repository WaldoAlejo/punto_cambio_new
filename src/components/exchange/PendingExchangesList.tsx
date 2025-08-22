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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  User,
  PuntoAtencion,
  CambioDivisa,
  DetalleDivisasSimple,
} from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { ReceiptService } from "../../services/receiptService";
import ExchangeDetailsForm from "./ExchangeDetailsForm";
import PartialPaymentForm from "./PartialPaymentForm";

interface PendingExchangesListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies?: any[];
}

interface PartialPaymentData {
  initialPayment: number;
  pendingBalance: number;
  receivedBy: string;
  observations: string;
}

const PendingExchangesList = ({
  user,
  selectedPoint,
  currencies = [],
}: PendingExchangesListProps) => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [pendingExchanges, setPendingExchanges] = useState<CambioDivisa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<CambioDivisa | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [partialPayment, setPartialPayment] = useState<PartialPaymentData>({
    initialPayment: 0,
    pendingBalance: 0,
    receivedBy: user?.nombre || "",
    observations: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para completar cambio con pantalla de entrega
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [exchangeToComplete, setExchangeToComplete] =
    useState<CambioDivisa | null>(null);
  const [divisasRecibidas, setDivisasRecibidas] =
    useState<DetalleDivisasSimple>({
      billetes: 0,
      monedas: 0,
      total: 0,
    });
  const [metodoEntrega, setMetodoEntrega] = useState<
    "efectivo" | "transferencia"
  >("efectivo");
  const [transferenciaNumero, setTransferenciaNumero] = useState("");
  const [transferenciaBanco, setTransferenciaBanco] = useState("");
  const [transferenciaImagen, setTransferenciaImagen] = useState<File | null>(
    null
  );

  // Estado para formulario de abono parcial
  const [showPartialPaymentForm, setShowPartialPaymentForm] = useState(false);
  const [exchangeForPartialPayment, setExchangeForPartialPayment] =
    useState<CambioDivisa | null>(null);

  useEffect(() => {
    loadPendingExchanges();
  }, [selectedPoint]);

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

  const updatePendingBalance = (payment: number) => {
    if (selectedExchange) {
      const pending = selectedExchange.monto_destino - payment;
      setPartialPayment((prev) => ({
        ...prev,
        pendingBalance: pending > 0 ? pending : 0,
      }));
    }
  };

  const handleSubmitPartialPayment = async () => {
    if (
      !selectedExchange ||
      !partialPayment.initialPayment ||
      partialPayment.initialPayment <= 0
    ) {
      toast.error("Debe ingresar un abono válido");
      return;
    }

    if (partialPayment.initialPayment >= selectedExchange.monto_destino) {
      toast.error("El abono no puede ser mayor o igual al monto total");
      return;
    }

    if (!partialPayment.receivedBy.trim()) {
      toast.error("Debe especificar quién recibe el abono");
      return;
    }

    setIsProcessing(true);
    try {
      // Generar e imprimir recibo del abono parcial
      const receiptData = ReceiptService.generatePartialExchangeReceipt(
        selectedExchange,
        selectedPoint?.nombre || "N/A",
        user.nombre,
        true,
        {
          initialPayment: partialPayment.initialPayment,
          pendingBalance: partialPayment.pendingBalance,
          receivedBy: partialPayment.receivedBy,
          observations: partialPayment.observations,
        }
      );

      try {
        ReceiptService.printReceipt(receiptData, 2);
      } catch (printError) {
        console.warn("Error al imprimir recibo:", printError);
      }

      toast.success(
        `✅ Abono de ${partialPayment.initialPayment.toLocaleString()} registrado exitosamente`
      );

      setIsDialogOpen(false);
      await loadPendingExchanges();
    } catch (error) {
      toast.error("Error al procesar el abono parcial");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteExchange = (exchange: CambioDivisa) => {
    // Abrir la pantalla de entrega de dinero
    setExchangeToComplete(exchange);
    setDivisasRecibidas({
      billetes: 0,
      monedas: 0,
      total: exchange.monto_destino,
    });
    setMetodoEntrega("efectivo");
    setTransferenciaNumero("");
    setTransferenciaBanco("");
    setTransferenciaImagen(null);
    setShowDeliveryForm(true);
  };

  const handleDeliveryComplete = async () => {
    if (!exchangeToComplete) return;

    setIsProcessing(true);
    try {
      const { error } = await exchangeService.closePendingExchange(
        exchangeToComplete.id
      );

      if (error) {
        toast.error(`Error al completar el cambio: ${error}`);
        return;
      }

      // Generar e imprimir recibo de cambio completado
      try {
        const receiptData = ReceiptService.generatePartialExchangeReceipt(
          exchangeToComplete,
          selectedPoint?.nombre || "N/A",
          user.nombre,
          false // false = cambio completado
        );
        ReceiptService.printReceipt(receiptData, 2);
      } catch (printError) {
        console.warn("Error al imprimir recibo final:", printError);
        toast.warning(
          "Cambio completado pero hubo un problema al imprimir el recibo"
        );
      }

      toast.success(
        "✅ Cambio de divisa completado exitosamente. Recibo generado."
      );

      // Disparar evento para actualizar saldos
      window.dispatchEvent(new CustomEvent("exchangeCompleted"));

      setShowDeliveryForm(false);
      setExchangeToComplete(null);
      await loadPendingExchanges();
    } catch (error) {
      toast.error("Error al completar el cambio");
    } finally {
      setIsProcessing(false);
    }
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
                    <strong>Saldo Pendiente:</strong> {exchange.monto_destino}{" "}
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Abono Parcial</DialogTitle>
          </DialogHeader>
          {selectedExchange && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p>
                  <strong>Cliente:</strong>{" "}
                  {selectedExchange.datos_cliente?.nombre}{" "}
                  {selectedExchange.datos_cliente?.apellido}
                </p>
                <p>
                  <strong>Monto Total:</strong> {selectedExchange.monto_destino}{" "}
                  {selectedExchange.monedaDestino?.codigo}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialPayment">Abono Inicial *</Label>
                <Input
                  id="initialPayment"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedExchange.monto_destino - 0.01}
                  value={partialPayment.initialPayment}
                  onChange={(e) => {
                    const payment = parseFloat(e.target.value) || 0;
                    setPartialPayment((prev) => ({
                      ...prev,
                      initialPayment: payment,
                    }));
                    updatePendingBalance(payment);
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receivedBy">Recibido por *</Label>
                <Input
                  id="receivedBy"
                  value={partialPayment.receivedBy}
                  onChange={(e) =>
                    setPartialPayment((prev) => ({
                      ...prev,
                      receivedBy: e.target.value,
                    }))
                  }
                  placeholder="Nombre del responsable"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm">
                  <strong>Saldo Pendiente:</strong>{" "}
                  {partialPayment.pendingBalance.toFixed(2)}{" "}
                  {selectedExchange.monedaDestino?.codigo}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  value={partialPayment.observations}
                  onChange={(e) =>
                    setPartialPayment((prev) => ({
                      ...prev,
                      observations: e.target.value,
                    }))
                  }
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitPartialPayment}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? "Procesando..." : "Registrar Abono"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog />

      {/* Modal para completar cambio con pantalla de entrega */}
      {showDeliveryForm && exchangeToComplete && (
        <Dialog open={showDeliveryForm} onOpenChange={setShowDeliveryForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Completar Cambio - {exchangeToComplete.datos_cliente?.nombre}{" "}
                {exchangeToComplete.datos_cliente?.apellido}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <ExchangeDetailsForm
                fromCurrency={exchangeToComplete.monedaOrigen}
                toCurrency={exchangeToComplete.monedaDestino}
                fromCurrencyName={exchangeToComplete.monedaOrigen?.codigo || ""}
                toCurrencyName={exchangeToComplete.monedaDestino?.codigo || ""}
                exchangeData={{
                  fromCurrency: exchangeToComplete.moneda_origen_id,
                  toCurrency: exchangeToComplete.moneda_destino_id,
                  operationType: exchangeToComplete.tipo_operacion,
                  rateBilletes:
                    exchangeToComplete.tasa_cambio_billetes?.toString() || "0",
                  rateMonedas:
                    exchangeToComplete.tasa_cambio_monedas?.toString() || "0",
                  amountBilletes:
                    exchangeToComplete.divisas_entregadas_billetes?.toString() ||
                    "0",
                  amountMonedas:
                    exchangeToComplete.divisas_entregadas_monedas?.toString() ||
                    "0",
                  totalAmountEntregado: exchangeToComplete.monto_origen,
                  totalAmountRecibido: exchangeToComplete.monto_destino,
                  observation: exchangeToComplete.observacion || "",
                }}
                onBack={() => setShowDeliveryForm(false)}
                onComplete={handleDeliveryComplete}
                onDivisasRecibidasChange={setDivisasRecibidas}
                divisasRecibidas={divisasRecibidas}
                metodoEntrega={metodoEntrega}
                onMetodoEntregaChange={setMetodoEntrega}
                transferenciaNumero={transferenciaNumero}
                onTransferenciaNumeroChange={setTransferenciaNumero}
                transferenciaBanco={transferenciaBanco}
                onTransferenciaBancoChange={setTransferenciaBanco}
                transferenciaImagen={transferenciaImagen}
                onTransferenciaImagenChange={setTransferenciaImagen}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para abono parcial con pantalla de cambio */}
      {showPartialPaymentForm && exchangeForPartialPayment && (
        <Dialog
          open={showPartialPaymentForm}
          onOpenChange={setShowPartialPaymentForm}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Registrar Abono Parcial -{" "}
                {exchangeForPartialPayment.datos_cliente?.nombre}{" "}
                {exchangeForPartialPayment.datos_cliente?.apellido}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <PartialPaymentForm
                exchange={exchangeForPartialPayment}
                user={user}
                selectedPoint={selectedPoint}
                currencies={currencies}
                onComplete={handlePartialPaymentComplete}
                onCancel={handlePartialPaymentCancel}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PendingExchangesList;
