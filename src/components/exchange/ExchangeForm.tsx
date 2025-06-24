
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Moneda } from "../../types";
import CurrencySearchSelect from "../ui/currency-search-select";

interface ExchangeFormProps {
  currencies: Moneda[];
  onBack: () => void;
  onContinue: (data: ExchangeFormData) => void;
}

export interface ExchangeFormData {
  operationType: "COMPRA" | "VENTA";
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  amount: string;
  destinationAmount: number;
  observation: string;
}

const ExchangeForm = ({ currencies, onBack, onContinue }: ExchangeFormProps) => {
  const [operationType, setOperationType] = useState<"COMPRA" | "VENTA">("COMPRA");
  const [rate, setRate] = useState("");
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState(0);
  const [observation, setObservation] = useState("");

  useEffect(() => {
    if (rate && amount) {
      const rateValue = parseFloat(rate) || 0;
      const amountValue = parseFloat(amount) || 0;
      setDestinationAmount(amountValue * rateValue);
    } else {
      setDestinationAmount(0);
    }
  }, [amount, rate]);

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  const handleSubmit = () => {
    if (!fromCurrency || !toCurrency) {
      toast({
        title: "Error",
        description: "Debe seleccionar las monedas de origen y destino",
        variant: "destructive",
      });
      return;
    }
    if (!rate) {
      toast({
        title: "Error",
        description: "Debe ingresar la tasa de cambio",
        variant: "destructive",
      });
      return;
    }
    if (!amount) {
      toast({
        title: "Error",
        description: "Debe ingresar el monto a cambiar",
        variant: "destructive",
      });
      return;
    }

    onContinue({
      operationType,
      fromCurrency,
      toCurrency,
      rate,
      amount,
      destinationAmount,
      observation,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del Cambio</CardTitle>
        <CardDescription>
          Configure los detalles de la operación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Operación</Label>
            <Select
              value={operationType}
              onValueChange={(value: "COMPRA" | "VENTA") =>
                setOperationType(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPRA">Compra</SelectItem>
                <SelectItem value="VENTA">Venta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CurrencySearchSelect
            currencies={currencies}
            value={fromCurrency}
            onValueChange={setFromCurrency}
            placeholder="Seleccionar moneda origen"
            label="Moneda Origen"
          />

          <CurrencySearchSelect
            currencies={currencies}
            value={toCurrency}
            onValueChange={setToCurrency}
            placeholder="Seleccionar moneda destino"
            label="Moneda Destino"
          />

          <div className="space-y-2">
            <Label>Tasa de Cambio</Label>
            <Input
              type="number"
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Ingrese la tasa de cambio"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto a Cambiar ({getCurrencyName(fromCurrency)})</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto Resultante ({getCurrencyName(toCurrency)})</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {destinationAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones (Opcional)</Label>
            <Input
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Observaciones adicionales"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              Atrás
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!fromCurrency || !toCurrency || !amount || !rate}
              className="flex-1"
            >
              Continuar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExchangeForm;
