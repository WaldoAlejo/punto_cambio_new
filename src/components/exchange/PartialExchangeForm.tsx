import { useState } from "react";
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
  totalAmount: number;
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

const PartialExchangeForm = ({
  totalAmount,
  currency,
  clientName,
  onSubmit,
  onCancel,
}: PartialExchangeFormProps) => {
  const [initialPayment, setInitialPayment] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [observations, setObservations] = useState("");

  const pendingBalance = totalAmount - parseFloat(initialPayment || "0");

  const handleSubmit = () => {
    const payment = parseFloat(initialPayment);
    
    if (!payment || payment <= 0) {
      toast({
        title: "Error",
        description: "Debe ingresar un monto de abono válido",
        variant: "destructive",
      });
      return;
    }

    if (payment >= totalAmount) {
      toast({
        title: "Error", 
        description: "El abono no puede ser mayor o igual al monto total",
        variant: "destructive",
      });
      return;
    }

    if (!receivedBy.trim()) {
      toast({
        title: "Error",
        description: "Debe especificar quién recibe el abono",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      initialPayment: payment,
      pendingBalance,
      receivedBy: receivedBy.trim(),
      observations: observations.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambio Parcial</CardTitle>
        <CardDescription>
          Configurar abono inicial para {clientName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="font-semibold">Monto Total: {totalAmount} {currency}</div>
          <div className="text-sm text-gray-600">Cliente: {clientName}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="initialPayment">Abono Inicial *</Label>
          <Input
            id="initialPayment"
            type="number"
            step="0.01"
            min="0.01"
            max={totalAmount - 0.01}
            value={initialPayment}
            onChange={(e) => setInitialPayment(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="receivedBy">Recibido por *</Label>
          <Input
            id="receivedBy"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            placeholder="Nombre del responsable"
          />
        </div>

        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm">
            <strong>Saldo Pendiente:</strong> {pendingBalance.toFixed(2)} {currency}
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
          <Button onClick={handleSubmit} className="flex-1">
            Crear Cambio Parcial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PartialExchangeForm;