import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CambioDivisa, User, PuntoAtencion, Moneda } from "../../types";
import { ReceiptService } from "../../services/receiptService";
import ExchangeForm, { ExchangeFormData } from "./ExchangeForm";

interface PartialPaymentFormProps {
  exchange: CambioDivisa;
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: Moneda[];
  onComplete: () => void;
  onCancel: () => void;
}

interface PartialPaymentData {
  initialPayment: number;
  pendingBalance: number;
  receivedBy: string;
  observations: string;
}

const format = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0,00";

const clamp2 = (n: number) => Number(Number(n).toFixed(2));

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
    pendingBalance: Number(exchange.monto_destino) || 0,
    receivedBy: user?.nombre || user?.username || "",
    observations: "",
  });

  const handleExchangeFormSubmit = (data: ExchangeFormData) => {
    // Monto que el cliente RECIBE (abono). Validado por ExchangeForm (maxAmount)
    const initial = Math.max(0, Number(data.totalAmountRecibido) || 0);
    const totalDestino = Number(exchange.monto_destino) || 0;

    // Clamp por seguridad
    const safeInitial = Math.min(initial, Math.max(0, totalDestino - 0.01));
    const pending = Math.max(0, totalDestino - safeInitial);

    setExchangeData(data);
    setPartialPayment((prev) => ({
      ...prev,
      initialPayment: clamp2(safeInitial),
      pendingBalance: clamp2(pending),
    }));
    setStep("details");
  };

  const handleSubmitPartialPayment = async () => {
    if (!exchangeData) {
      toast.error("Datos de cambio incompletos");
      return;
    }
    if (!selectedPoint) {
      toast.error("Debe seleccionar un punto de atención");
      return;
    }
    if (!user || (!user.nombre && !user.username)) {
      toast.error(
        "Error: Usuario no identificado. Por favor, inicie sesión nuevamente."
      );
      return;
    }

    const totalDestino = Number(exchange.monto_destino) || 0;
    const initial = Number(partialPayment.initialPayment) || 0;

    if (initial <= 0) {
      toast.error("Debe ingresar un abono válido (mayor a 0)");
      return;
    }
    if (!(totalDestino > 0) || initial >= totalDestino) {
      toast.error("El abono no puede ser mayor o igual al monto total");
      return;
    }
    if (!partialPayment.receivedBy.trim()) {
      toast.error(
        "Error: No se pudo identificar el operador que recibe el abono"
      );
      return;
    }

    try {
      // Registrar el abono parcial en el backend
      const response = await fetch(
        `/api/exchanges/${exchange.id}/register-partial-payment`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            abono_inicial_monto: clamp2(initial),
            abono_inicial_fecha: new Date().toISOString(),
            observacion_parcial: partialPayment.observations.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al registrar el abono parcial"
        );
      }

      const data = await response.json();

      if (data.success) {
        // Generar recibo del abono parcial
        const receiptData = ReceiptService.generatePartialExchangeReceipt(
          exchange,
          selectedPoint?.nombre || "N/A",
          user.nombre,
          true,
          {
            initialPayment: clamp2(initial),
            pendingBalance: clamp2(partialPayment.pendingBalance),
            receivedBy: partialPayment.receivedBy.trim(),
            observations: partialPayment.observations.trim(),
          }
        );

        // Imprimir con fallback en pantalla
        try {
          ReceiptService.printReceipt(receiptData, 2);
          toast.success(
            "✅ Abono parcial registrado y recibo enviado a impresora"
          );
        } catch (e) {
          console.warn("Error al imprimir, mostrando en pantalla:", e);
          toast.success(
            "✅ Abono parcial registrado. Impresión falló, mostrando recibo en pantalla."
          );
        } finally {
          // Siempre mostramos en pantalla como confirmación
          setTimeout(() => {
            ReceiptService.showReceiptInCurrentWindow(receiptData);
          }, 400);
        }

        // Notificar UI para refrescar
        window.dispatchEvent(new CustomEvent("exchangeCompleted"));
        window.dispatchEvent(new CustomEvent("saldosUpdated"));

        onComplete();
      } else {
        throw new Error(
          data.error || "Error desconocido al registrar el abono"
        );
      }
    } catch (error) {
      console.error("Error al procesar abono parcial:", error);
      toast.error("Error al procesar el abono parcial");
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
              Monto total pendiente:{" "}
              {format(Number(exchange.monto_destino) || 0)}{" "}
              {exchange.monedaDestino?.codigo || ""}
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
          maxAmount={Number(exchange.monto_destino) || 0}
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
                {format(partialPayment.initialPayment)}{" "}
                {exchange.monedaDestino?.codigo || ""}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">
                Saldo pendiente
              </Label>
              <div className="text-lg font-bold text-orange-600">
                {format(partialPayment.pendingBalance)}{" "}
                {exchange.monedaDestino?.codigo || ""}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="receivedBy">Recibido por *</Label>
              <Input
                id="receivedBy"
                value={partialPayment.receivedBy}
                readOnly
                disabled
                placeholder="Operador que recibe el abono"
                className="h-10 bg-gray-50 text-gray-700"
                title={`Operador: ${
                  user?.nombre || user?.username || "Usuario no identificado"
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Operador actual:{" "}
                {user?.nombre || user?.username || "No identificado"}
              </p>
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
                className="flex-1"
              >
                Volver
              </Button>
              <Button onClick={handleSubmitPartialPayment} className="flex-1">
                Registrar Abono
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartialPaymentForm;
