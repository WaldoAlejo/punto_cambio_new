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
  onBack?: () => void;
  onContinue?: (data: ExchangeFormData) => void;
  onSubmit?: (data: ExchangeFormData) => void;
  onCancel?: () => void;
  initialData?: Partial<ExchangeFormData>;
  isPartialPayment?: boolean;
  maxAmount?: number;
}

export interface ExchangeFormData {
  operationType: "COMPRA" | "VENTA";
  fromCurrency: string;
  toCurrency: string;

  // Tasas diferenciadas
  rateBilletes: string;
  rateMonedas: string;

  // Montos entregados por el cliente
  amountBilletes: string;
  amountMonedas: string;
  totalAmountEntregado: number;

  // Monto total que recibe el cliente
  totalAmountRecibido: number;

  observation: string;
}

const ExchangeForm = ({
  currencies,
  onBack,
  onContinue,
  onSubmit,
  onCancel,
  initialData,
  isPartialPayment = false,
  maxAmount,
}: ExchangeFormProps) => {
  const [operationType, setOperationType] = useState<"COMPRA" | "VENTA">(
    initialData?.operationType || "COMPRA"
  );
  const [fromCurrency, setFromCurrency] = useState(
    initialData?.fromCurrency || ""
  );
  const [toCurrency, setToCurrency] = useState(initialData?.toCurrency || "");
  const [observation, setObservation] = useState(
    initialData?.observation || ""
  );

  // Tasas diferenciadas
  const [rateBilletes, setRateBilletes] = useState(
    initialData?.rateBilletes || ""
  );
  const [rateMonedas, setRateMonedas] = useState(
    initialData?.rateMonedas || ""
  );

  // Montos entregados por el cliente
  const [amountBilletes, setAmountBilletes] = useState(
    initialData?.amountBilletes || ""
  );
  const [amountMonedas, setAmountMonedas] = useState(
    initialData?.amountMonedas || ""
  );

  // Cálculos automáticos
  const totalAmountEntregado =
    (parseFloat(amountBilletes) || 0) + (parseFloat(amountMonedas) || 0);

  const calculateTotalRecibido = () => {
    const billetes = parseFloat(amountBilletes) || 0;
    const monedas = parseFloat(amountMonedas) || 0;
    const tasaBilletes = parseFloat(rateBilletes) || 0;
    const tasaMonedas = parseFloat(rateMonedas) || 0;

    // Si tenemos las monedas definidas, usar la nueva lógica
    if (fromCurrency && toCurrency && currencies.length > 0) {
      const monedaOrigen = currencies.find((c) => c.id === fromCurrency);
      const monedaDestino = currencies.find((c) => c.id === toCurrency);

      if (monedaOrigen && monedaDestino) {
        // Determinar el comportamiento según el tipo de operación
        const comportamientoBilletes =
          operationType === "COMPRA"
            ? monedaOrigen.comportamiento_compra
            : monedaDestino.comportamiento_venta;
        const comportamientoMonedas =
          operationType === "COMPRA"
            ? monedaOrigen.comportamiento_compra
            : monedaDestino.comportamiento_venta;

        let totalBilletes = 0;
        let totalMonedas = 0;

        if (billetes > 0 && tasaBilletes > 0) {
          totalBilletes =
            comportamientoBilletes === "MULTIPLICA"
              ? billetes * tasaBilletes
              : billetes / tasaBilletes;
        }

        if (monedas > 0 && tasaMonedas > 0) {
          totalMonedas =
            comportamientoMonedas === "MULTIPLICA"
              ? monedas * tasaMonedas
              : monedas / tasaMonedas;
        }

        return totalBilletes + totalMonedas;
      }
    }

    // Fallback al comportamiento anterior
    return billetes * tasaBilletes + monedas * tasaMonedas;
  };

  const totalAmountRecibido = calculateTotalRecibido();

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
      toast.error(
        "Debe seleccionar qué moneda entrega el cliente y qué moneda recibe"
      );
      return;
    }

    if (!rateBilletes || !rateMonedas) {
      toast.error("Debe ingresar las tasas de cambio para billetes y monedas");
      return;
    }

    if (!amountBilletes && !amountMonedas) {
      toast.error("Debe ingresar al menos un monto (billetes o monedas)");
      return;
    }

    const rateBilletesNum = parseFloat(rateBilletes);
    const rateMonedasNum = parseFloat(rateMonedas);

    if (isNaN(rateBilletesNum) || rateBilletesNum <= 0) {
      toast.error(
        "La tasa de cambio para billetes debe ser un número positivo"
      );
      return;
    }

    if (isNaN(rateMonedasNum) || rateMonedasNum <= 0) {
      toast.error("La tasa de cambio para monedas debe ser un número positivo");
      return;
    }

    if (totalAmountEntregado <= 0) {
      toast.error("El monto total entregado debe ser mayor a cero");
      return;
    }

    // Validación específica para abonos parciales
    if (isPartialPayment && maxAmount && totalAmountRecibido > maxAmount) {
      toast.error(`El abono no puede exceder ${maxAmount.toLocaleString()}`);
      return;
    }

    const formData = {
      operationType,
      fromCurrency,
      toCurrency,
      rateBilletes,
      rateMonedas,
      amountBilletes,
      amountMonedas,
      totalAmountEntregado,
      totalAmountRecibido,
      observation,
    };

    // Usar onSubmit si está disponible (para abonos parciales), sino onContinue
    if (onSubmit) {
      onSubmit(formData);
    } else if (onContinue) {
      onContinue(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>💱 Datos del Cambio de Divisas</CardTitle>
        <CardDescription>
          Configure los detalles de la operación: qué moneda entrega el cliente
          y qué moneda recibe
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
          rateBilletes={rateBilletes}
          setRateBilletes={setRateBilletes}
          rateMonedas={rateMonedas}
          setRateMonedas={setRateMonedas}
          amountBilletes={amountBilletes}
          setAmountBilletes={setAmountBilletes}
          amountMonedas={amountMonedas}
          setAmountMonedas={setAmountMonedas}
          totalAmountEntregado={totalAmountEntregado}
          totalAmountRecibido={totalAmountRecibido}
          observation={observation}
          setObservation={setObservation}
          currencies={currencies}
          getCurrencyName={getCurrencyName}
        />

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onBack || onCancel}>
            {isPartialPayment ? "Cancelar" : "Atrás"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !fromCurrency ||
              !toCurrency ||
              !rateBilletes ||
              !rateMonedas ||
              (!amountBilletes && !amountMonedas)
            }
            className="flex-1"
          >
            {isPartialPayment ? "Continuar con Abono" : "Continuar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExchangeForm;
