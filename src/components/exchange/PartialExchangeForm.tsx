import { useMemo, useState, useCallback } from "react";
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
  /** Monto total de la operación (a entregar al cliente) */
  totalAmount: number;
  /** Código o etiqueta de moneda (p. ej. "USD") */
  currency: string;
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
  Number.isFinite(n)
    ? n.toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0,00";

/** Convierte string con coma o punto a número seguro (>=0) */
const parseMoney = (raw: string) => {
  const cleaned = (raw || "").replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

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

  const initialPaymentNumber = useMemo(
    () => parseMoney(initialPayment),
    [initialPayment]
  );

  const pendingBalanceNumber = useMemo(() => {
    const raw = Number(totalAmount) - initialPaymentNumber;
    if (!Number.isFinite(raw)) return Math.max(0, Number(totalAmount) || 0);
    // Nunca negativo; clamp a [0, totalAmount]
    return Math.max(0, Math.min(Number(totalAmount) || 0, raw));
  }, [totalAmount, initialPaymentNumber]);

  const isValidForm = useMemo(() => {
    if (!(Number(totalAmount) > 0)) return false;
    if (!Number.isFinite(initialPaymentNumber) || initialPaymentNumber <= 0)
      return false;
    if (initialPaymentNumber >= Number(totalAmount)) return false;
    if (!receivedBy.trim()) return false;
    return true;
  }, [initialPaymentNumber, receivedBy, totalAmount]);

  const showValidationToasts = useCallback(() => {
    if (!(Number(totalAmount) > 0)) {
      toast({
        title: "Error",
        description:
          "El monto total debe ser mayor a 0 para registrar cambio parcial.",
        variant: "destructive",
      });
      return true;
    }
    if (!Number.isFinite(initialPaymentNumber) || initialPaymentNumber <= 0) {
      toast({
        title: "Error",
        description: "Debe ingresar un monto de abono válido (mayor a 0).",
        variant: "destructive",
      });
      return true;
    }
    if (initialPaymentNumber >= Number(totalAmount)) {
      toast({
        title: "Error",
        description: "El abono no puede ser mayor o igual al monto total.",
        variant: "destructive",
      });
      return true;
    }
    if (!receivedBy.trim()) {
      toast({
        title: "Error",
        description: "Debe especificar quién recibe el abono.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  }, [initialPaymentNumber, receivedBy, totalAmount]);

  const handleSubmit = () => {
    if (!isValidForm) {
      showValidationToasts();
      return;
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
            Monto Total: {formatNumber(Number(totalAmount) || 0)} {currency}
          </div>
          <div className="text-sm text-gray-600">
            Cliente: {clientName || "—"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="initialPayment">Abono Inicial *</Label>
          <Input
            id="initialPayment"
            inputMode="decimal"
            type="number"
            step="0.01"
            min={0.01}
            // Máximo visual; validamos también en código
            max={Math.max(0, (Number(totalAmount) || 0) - 0.01)}
            value={initialPayment}
            onChange={(e) => setInitialPayment(e.target.value)}
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} // evita scroll accidental
            onKeyDown={(e) => {
              // Evita scientific notation y signos
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            placeholder="0.00"
            className="h-10"
          />
          {initialPayment !== "" && initialPaymentNumber <= 0 && (
            <p className="text-xs text-red-600">El abono debe ser mayor a 0.</p>
          )}
          {initialPayment !== "" &&
            Number(totalAmount) > 0 &&
            initialPaymentNumber >= Number(totalAmount) && (
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
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
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
