import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Moneda } from "../../types";
import { useExchangeCalculations } from "../../hooks/useExchangeCalculations";
import ExchangeFormFields from "./ExchangeFormFields";

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

const ExchangeForm = ({
  currencies,
  onBack,
  onContinue,
}: ExchangeFormProps) => {
  const [operationType, setOperationType] = useState<"COMPRA" | "VENTA">(
    "COMPRA"
  );
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [observation, setObservation] = useState("");
  const { rate, setRate, amount, setAmount, destinationAmount } =
    useExchangeCalculations();

  // NUEVO: Validación de monedas cargadas
  if (!currencies || currencies.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datos del Cambio</CardTitle>
          <CardDescription>
            Debe haber al menos 2 monedas registradas para operar un cambio.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  const handleSubmit = () => {
    if (!fromCurrency || !toCurrency) {
      toast.error("Debe seleccionar las monedas de origen y destino");
      return;
    }
    if (!rate) {
      toast.error("Debe ingresar la tasa de cambio");
      return;
    }
    if (!amount) {
      toast.error("Debe ingresar el monto a cambiar");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.error("La tasa de cambio debe ser un número positivo");
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
        <ExchangeFormFields
          operationType={operationType}
          setOperationType={setOperationType}
          fromCurrency={fromCurrency}
          setFromCurrency={setFromCurrency}
          toCurrency={toCurrency}
          setToCurrency={setToCurrency}
          rate={rate}
          setRate={setRate}
          amount={amount}
          setAmount={setAmount}
          destinationAmount={destinationAmount}
          observation={observation}
          setObservation={setObservation}
          currencies={currencies}
          getCurrencyName={getCurrencyName}
        />

        <div className="flex gap-2 mt-4">
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
      </CardContent>
    </Card>
  );
};

export default ExchangeForm;
