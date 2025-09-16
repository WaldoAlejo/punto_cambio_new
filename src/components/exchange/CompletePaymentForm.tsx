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

type MetodoEntrega = "efectivo" | "transferencia";

type DeliveryDetails = {
  metodoEntrega: MetodoEntrega;
  transferenciaNumero?: string;
  transferenciaBanco?: string;
  transferenciaImagen?: File | null;
  // Opcionalmente puede traer desglose de lo que el cliente recibe (por compatibilidad)
  divisasRecibidas?: { billetes: number; monedas: number; total: number };
};

const formatMoney = (n: number | null | undefined) => {
  const v = Number(n);
  return Number.isFinite(v)
    ? v.toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0,00";
};

const CompletePaymentForm = ({
  exchange,
  user,
  selectedPoint,
  onComplete,
  onCancel,
}: CompletePaymentFormProps) => {
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [deliveryDetails, setDeliveryDetails] =
    useState<DeliveryDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const clienteStr = exchange.cliente || ""; // respaldo si no viene datos_cliente
  const nombreCliente =
    exchange.datos_cliente?.nombre ||
    (clienteStr ? clienteStr.split(" ")[0] : "Cliente");
  const apellidoCliente =
    exchange.datos_cliente?.apellido ||
    (clienteStr ? clienteStr.split(" ").slice(1).join(" ") : "");

  const montoDestino = Number(exchange.monto_destino || 0);
  const saldoPendiente = Number(exchange.saldo_pendiente ?? 0);
  const codigoMonedaDestino = exchange.monedaDestino?.codigo || "";

  const handleDeliveryDetailsSubmit = (details: DeliveryDetails) => {
    // Blindaje mínimo aquí (DeliveryDetailsForm ya valida, pero reforzamos)
    if (
      details.metodoEntrega === "transferencia" &&
      (!details.transferenciaNumero?.trim() ||
        !details.transferenciaBanco?.trim())
    ) {
      toast.error("Debe indicar número y banco para la transferencia.");
      return;
    }
    setDeliveryDetails(details);
    setStep("confirm");
  };

  const handleCompletePayment = async () => {
    if (!deliveryDetails) {
      toast.error("Datos de entrega incompletos");
      return;
    }

    // Validación de transferencia (doble seguro)
    if (
      deliveryDetails.metodoEntrega === "transferencia" &&
      (!deliveryDetails.transferenciaNumero?.trim() ||
        !deliveryDetails.transferenciaBanco?.trim())
    ) {
      toast.error("Debe indicar número y banco para la transferencia.");
      return;
    }

    setIsProcessing(true);
    try {
      // 1) Completar el cambio pendiente en el backend
      const { exchange: completedExchange, error } =
        await exchangeService.completeExchange(exchange.id, deliveryDetails);

      if (error || !completedExchange) {
        toast.error(`Error al completar el cambio: ${error || "sin detalles"}`);
        return;
      }

      // 2) Procesar contabilidad (no bloquea el flujo si falla)
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
          const resumen = (result.saldos_actualizados || [])
            .map(
              (s: any) =>
                `${s.moneda_id}: ${Number(s.saldo_anterior || 0).toFixed(
                  2
                )} → ${Number(s.saldo_nuevo || 0).toFixed(2)}`
            )
            .join(", ");
          if (resumen) toast.success(`✅ Saldos actualizados: ${resumen}`);
        }
      } catch (e) {
        console.error(
          "Error inesperado al procesar contabilidad al completar cambio",
          e
        );
        toast.warning(
          "⚠️ Cambio completado pero no se pudo actualizar contabilidad"
        );
      }

      // 3) Recibo de completación
      try {
        // Mantener firma consistente con otros usos:
        // generatePartialExchangeReceipt(exchange, pointName, operador, isInitialPayment, details?)
        const receiptData = ReceiptService.generatePartialExchangeReceipt(
          completedExchange,
          selectedPoint?.nombre || "N/A",
          user.nombre,
          false,
          undefined // para completación no enviamos payload extra
        );
        ReceiptService.printReceipt(receiptData, 2);
      } catch (printErr) {
        console.warn("Fallo al imprimir recibo de completación:", printErr);
        toast.warning("⚠️ Cambio completado. No se pudo imprimir el recibo.");
      }

      // 4) Eventos para refrescar UI
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
              Cliente: {nombreCliente} {apellidoCliente}
              <br />
              Monto a entregar: {formatMoney(montoDestino)}{" "}
              {codigoMonedaDestino}
              {saldoPendiente > 0 && (
                <>
                  <br />
                  Saldo pendiente: {formatMoney(saldoPendiente)}{" "}
                  {codigoMonedaDestino}
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

  // Paso de confirmación
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmar Completación del Cambio</CardTitle>
          <div className="text-sm text-gray-600">
            Cliente: {nombreCliente} {apellidoCliente}
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
                    {formatMoney(montoDestino)} {codigoMonedaDestino}
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
                      {deliveryDetails.transferenciaBanco || "—"}
                    </div>
                    <div>
                      <strong>Número:</strong>{" "}
                      {deliveryDetails.transferenciaNumero || "—"}
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
