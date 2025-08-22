import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CambioDivisa, User, PuntoAtencion } from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { ReceiptService } from "../../services/receiptService";
import ExchangeForm, { ExchangeFormData } from "./ExchangeForm";

interface PartialPaymentFormProps {
  exchange: CambioDivisa;
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: any[];
  onComplete: () => void;
  onCancel: () => void;
}

interface PartialPaymentData {
  initialPayment: number;
  pendingBalance: number;
  receivedBy: string;
  observations: string;
}

const PartialPaymentForm = ({
  exchange,
  user,
  selectedPoint,
  currencies,
  onComplete,
  onCancel,
}: PartialPaymentFormProps) => {
  const [step, setStep] = useState<"exchange" | "details">("exchange");
  const [exchangeData, setExchangeData] = useState<ExchangeFormData | null>(
    null
  );
  const [partialPayment, setPartialPayment] = useState<PartialPaymentData>({
    initialPayment: 0,
    pendingBalance: exchange.monto_destino,
    receivedBy: user?.nombre || "",
    observations: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const getCurrency = (currencyId: string) => {
    return currencies.find((c) => c.id === currencyId);
  };

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  const handleExchangeFormSubmit = (data: ExchangeFormData) => {
    setExchangeData(data);
    setPartialPayment((prev) => ({
      ...prev,
      initialPayment: data.totalAmountRecibido,
      pendingBalance: exchange.monto_destino - data.totalAmountRecibido,
    }));
    setStep("details");
  };

  const updatePendingBalance = (payment: number) => {
    const pending = exchange.monto_destino - payment;
    setPartialPayment((prev) => ({
      ...prev,
      pendingBalance: pending > 0 ? pending : 0,
    }));
  };

  const handleSubmitPartialPayment = async () => {
    if (!exchangeData) {
      toast.error("Datos de cambio incompletos");
      return;
    }

    if (!partialPayment.initialPayment || partialPayment.initialPayment <= 0) {
      toast.error("Debe ingresar un abono válido");
      return;
    }

    if (partialPayment.initialPayment >= exchange.monto_destino) {
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
        exchange,
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
      ReceiptService.printReceipt(receiptData, 2);

      // Registrar el abono parcial
      const { error } = await exchangeService.registerPartialPayment(
        exchange.id,
        {
          monto_abono: partialPayment.initialPayment,
          recibido_por: partialPayment.receivedBy,
          observaciones: partialPayment.observations,
          saldo_pendiente: partialPayment.pendingBalance,
        }
      );

      if (error) {
        toast.error(`Error al registrar el abono: ${error}`);
        return;
      }

      toast.success(
        "✅ Abono parcial registrado exitosamente. Recibo generado."
      );

      // Disparar evento para actualizar saldos
      window.dispatchEvent(new CustomEvent("exchangeCompleted"));

      onComplete();
    } catch (error) {
      toast.error("Error al procesar el abono parcial");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "exchange") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Abono Parcial</CardTitle>
            <div className="text-sm text-gray-600">
              Cliente: {exchange.datos_cliente?.nombre}{" "}
              {exchange.datos_cliente?.apellido}
              <br />
              Monto total pendiente: {exchange.monto_destino.toLocaleString()}{" "}
              {exchange.monedaDestino?.codigo}
            </div>
          </CardHeader>
        </Card>

        <ExchangeForm
          currencies={currencies}
          onSubmit={handleExchangeFormSubmit}
          onCancel={onCancel}
          initialData={{
            fromCurrency: exchange.moneda_origen_id,
            toCurrency: exchange.moneda_destino_id,
            operationType: exchange.tipo_operacion,
            rateBilletes: exchange.tasa_cambio_billetes?.toString() || "",
            rateMonedas: exchange.tasa_cambio_monedas?.toString() || "",
            amountBilletes: "",
            amountMonedas: "",
            observation: `Abono parcial para cambio ${
              exchange.numero_recibo || exchange.id
            }`,
          }}
          isPartialPayment={true}
          maxAmount={exchange.monto_destino}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmar Abono Parcial</CardTitle>
          <div className="text-sm text-gray-600">
            Cliente: {exchange.datos_cliente?.nombre}{" "}
            {exchange.datos_cliente?.apellido}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">
                Monto del abono
              </Label>
              <div className="text-lg font-bold text-green-600">
                {partialPayment.initialPayment.toLocaleString()}{" "}
                {exchange.monedaDestino?.codigo}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">
                Saldo pendiente
              </Label>
              <div className="text-lg font-bold text-orange-600">
                {partialPayment.pendingBalance.toLocaleString()}{" "}
                {exchange.monedaDestino?.codigo}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="receivedBy">Recibido por</Label>
              <Input
                id="receivedBy"
                value={partialPayment.receivedBy}
                onChange={(e) =>
                  setPartialPayment((prev) => ({
                    ...prev,
                    receivedBy: e.target.value,
                  }))
                }
                placeholder="Nombre de quien recibe el abono"
              />
            </div>

            <div>
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
                onClick={() => setStep("exchange")}
                disabled={isProcessing}
                className="flex-1"
              >
                Volver
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
        </CardContent>
      </Card>
    </div>
  );
};

export default PartialPaymentForm;
