import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface PartialExchangeFormProps {
  totalAmount: number; // Monto total de la operación (a entregar al cliente)
  currency: string; // Código o etiqueta de moneda (p. ej. "USD")
  clientName: string;
  onSubmit: (data: {
    initialPayment: number;
    pendingBalance: number;
    receivedBy: string;
    observations: string;
  }) => void;
  onCancel: () => void;
}

const formatNumber = (n: number) =>
  isFinite(n)
    ? n.toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0,00";

const PartialExchangeForm = ({
  totalAmount,
  currency,
  clientName,
  onSubmit,
  onCancel,
}: PartialExchangeFormProps) => {
  const [initialPayment, setInitialPayment] = useState<string>("");
  const [receivedBy, setReceivedBy] = useState<string>("");
  const [observations, setObservations] = useState<string>("");

  // Sanitizar y calcular saldos de forma segura
  const initialPaymentNumber = useMemo(() => {
    const n = parseFloat((initialPayment || "").replace(",", "."));
    return isFinite(n) && n >= 0 ? n : 0;
  }, [initialPayment]);

  const pendingBalanceNumber = useMemo(() => {
    const raw = totalAmount - initialPaymentNumber;
    // Nunca negativo; clamp a [0, totalAmount]
    if (!isFinite(raw)) return totalAmount;
    return Math.max(0, Math.min(totalAmount, raw));
  }, [totalAmount, initialPaymentNumber]);

  const isValidForm = useMemo(() => {
    // Reglas:
    // - initialPayment > 0
    // - initialPayment < totalAmount (debe ser parcial)
    // - receivedBy no vacío
    if (!isFinite(initialPaymentNumber) || initialPaymentNumber <= 0)
      return false;
    if (!(totalAmount > 0) || initialPaymentNumber >= totalAmount) return false;
    if (!receivedBy.trim()) return false;
    return true;
  }, [initialPaymentNumber, receivedBy, totalAmount]);

  const handleSubmit = () => {
    if (!isValidForm) {
      // Mensajes específicos
      if (!isFinite(initialPaymentNumber) || initialPaymentNumber <= 0) {
        toast({
          title: "Error",
          description: "Debe ingresar un monto de abono válido (mayor a 0).",
          variant: "destructive",
        });
        return;
      }
      if (!(totalAmount > 0) || initialPaymentNumber >= totalAmount) {
        toast({
          title: "Error",
          description: "El abono no puede ser mayor o igual al monto total.",
          variant: "destructive",
        });
        return;
      }
      if (!receivedBy.trim()) {
        toast({
          title: "Error",
          description: "Debe especificar quién recibe el abono.",
          variant: "destructive",
        });
        return;
      }
    }

    onSubmit({
      initialPayment: Number(initialPaymentNumber.toFixed(2)),
      pendingBalance: Number(pendingBalanceNumber.toFixed(2)),
      receivedBy: receivedBy.trim(),
      observations: observations.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambio Parcial</CardTitle>
        <CardDescription>
          Configurar abono inicial para {clientName || "el cliente"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="font-semibold">
            Monto Total: {formatNumber(totalAmount)} {currency}
          </div>
          <div className="text-sm text-gray-600">Cliente: {clientName}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="initialPayment">Abono Inicial *</Label>
          <Input
            id="initialPayment"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0.01"
            // máx. visual, pero igual validamos en código
            max={Math.max(0, totalAmount - 0.01)}
            value={initialPayment}
            onChange={(e) => setInitialPayment(e.target.value)}
            placeholder="0.00"
            className="h-10"
          />
          {initialPayment !== "" && initialPaymentNumber <= 0 && (
            <p className="text-xs text-red-600">El abono debe ser mayor a 0.</p>
          )}
          {initialPaymentNumber >= totalAmount && (
            <p className="text-xs text-red-600">
              El abono no puede ser mayor o igual al monto total.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="receivedBy">Recibido por *</Label>
          <Input
            id="receivedBy"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            placeholder="Nombre del responsable"
            className="h-10"
          />
        </div>

        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm">
            <strong>Saldo Pendiente:</strong>{" "}
            {formatNumber(pendingBalanceNumber)} {currency}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observations">Observaciones</Label>
          <Textarea
            id="observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={!isValidForm}
          >
            Crear Cambio Parcial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PartialExchangeForm;
