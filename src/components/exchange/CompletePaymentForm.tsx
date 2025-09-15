import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CambioDivisa, User, PuntoAtencion } from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { ReceiptService } from "../../services/receiptService";
import { movimientosContablesService } from "../../services/movimientosContablesService";
import DeliveryDetailsForm from "./DeliveryDetailsForm";

interface CompletePaymentFormProps {
  exchange: CambioDivisa;
  user: User;
  selectedPoint: PuntoAtencion | null;
  onComplete: () => void;
  onCancel: () => void;
}

const CompletePaymentForm = ({
  exchange,
  user,
  selectedPoint,
  onComplete,
  onCancel,
}: CompletePaymentFormProps) => {
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [deliveryDetails, setDeliveryDetails] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeliveryDetailsSubmit = (details: any) => {
    setDeliveryDetails(details);
    setStep("confirm");
  };

  const handleCompletePayment = async () => {
    if (!deliveryDetails) {
      toast.error("Datos de entrega incompletos");
      return;
    }

    setIsProcessing(true);
    try {
      // Completar el cambio pendiente
      const { exchange: completedExchange, error } =
        await exchangeService.completeExchange(exchange.id, deliveryDetails);

      if (error || !completedExchange) {
        toast.error(`Error al completar el cambio: ${error || "sin detalles"}`);
        return;
      }

      // Procesar contabilidad tras completar
      try {
        const { result, error: contabError } =
          await movimientosContablesService.procesarMovimientosCambio(
            completedExchange,
            user.id
          );

        if (contabError) {
          toast.warning(
            `⚠️ Cambio completado pero error en contabilidad: ${contabError}`
          );
        } else if (result?.success) {
          const resumen = result.saldos_actualizados
            .map(
              (s: any) =>
                `${s.moneda_id}: ${s.saldo_anterior.toFixed(
                  2
                )} → ${s.saldo_nuevo.toFixed(2)}`
            )
            .join(", ");
          toast.success(`✅ Saldos actualizados: ${resumen}`);
        }
      } catch (e) {
        // No bloquear el flujo si falla contabilidad
        console.error(
          "Error inesperado al procesar contabilidad al completar cambio",
          e
        );
        toast.warning(
          "⚠️ Cambio completado pero no se pudo actualizar contabilidad"
        );
      }

      // Generar e imprimir recibo de completación
      const receiptData = ReceiptService.generatePartialExchangeReceipt(
        completedExchange,
        selectedPoint?.nombre || "N/A",
        user.nombre,
        false // isInitialPayment = false para completación
      );
      ReceiptService.printReceipt(receiptData, 2);

      // Disparar evento para actualizar saldos
      window.dispatchEvent(new CustomEvent("exchangeCompleted"));
      window.dispatchEvent(new CustomEvent("saldosUpdated"));

      onComplete();
    } catch (error) {
      toast.error("Error al completar el cambio");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "details") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Completar Cambio Pendiente</CardTitle>
            <div className="text-sm text-gray-600">
              Cliente: {exchange.datos_cliente?.nombre}{" "}
              {exchange.datos_cliente?.apellido}
              <br />
              Monto a entregar: {exchange.monto_destino.toLocaleString()}{" "}
              {exchange.monedaDestino?.codigo}
              <br />
              {exchange.saldo_pendiente && exchange.saldo_pendiente > 0 && (
                <>
                  Saldo pendiente: {exchange.saldo_pendiente.toLocaleString()}{" "}
                  {exchange.monedaDestino?.codigo}
                </>
              )}
            </div>
          </CardHeader>
        </Card>

        <DeliveryDetailsForm
          exchange={exchange}
          onSubmit={handleDeliveryDetailsSubmit}
          onCancel={onCancel}
          isCompletion={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmar Completación del Cambio</CardTitle>
          <div className="text-sm text-gray-600">
            Cliente: {exchange.datos_cliente?.nombre}{" "}
            {exchange.datos_cliente?.apellido}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">
                Resumen de la operación
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Monto total:</span>
                  <div className="font-bold text-green-700">
                    {exchange.monto_destino.toLocaleString()}{" "}
                    {exchange.monedaDestino?.codigo}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Método de entrega:</span>
                  <div className="font-bold text-green-700">
                    {deliveryDetails?.metodoEntrega === "efectivo"
                      ? "Efectivo"
                      : "Transferencia"}
                  </div>
                </div>
              </div>

              {deliveryDetails?.metodoEntrega === "transferencia" && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="text-sm">
                    <div>
                      <strong>Banco:</strong>{" "}
                      {deliveryDetails.transferenciaBanco}
                    </div>
                    <div>
                      <strong>Número:</strong>{" "}
                      {deliveryDetails.transferenciaNumero}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("details")}
                disabled={isProcessing}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? "Procesando..." : "Completar Cambio"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletePaymentForm;
