import { useEffect, useMemo, useState } from "react";
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
  fromCurrencyName?: string;
  toCurrencyName?: string;

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

/** Normaliza una cadena numérica con coma o punto a número JS */
const toNumber = (v: string | number | undefined | null): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const s = String(v).replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

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

  const hasEnoughCurrencies = Array.isArray(currencies) && currencies.length >= 2;

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  const amountBilletesNum = useMemo(
    () => toNumber(amountBilletes),
    [amountBilletes]
  );
  const amountMonedasNum = useMemo(
    () => toNumber(amountMonedas),
    [amountMonedas]
  );
  const rateBilletesNum = useMemo(() => toNumber(rateBilletes), [rateBilletes]);
  const rateMonedasNum = useMemo(() => toNumber(rateMonedas), [rateMonedas]);

  const totalAmountEntregado = useMemo(
    () => amountBilletesNum + amountMonedasNum,
    [amountBilletesNum, amountMonedasNum]
  );

  const totalAmountRecibido = useMemo(() => {
    const monedaOrigen = currencies.find((c) => c.id === fromCurrency);
    const monedaDestino = currencies.find((c) => c.id === toCurrency);

    // Si falta información mínima, caer al fallback simple
    if (!monedaOrigen || !monedaDestino) {
      return (
        amountBilletesNum * rateBilletesNum + amountMonedasNum * rateMonedasNum
      );
    }

    // Comportamientos por tipo
    // Para COMPRA: el cliente entrega divisa extranjera y recibe USD (u otra)
    // Para VENTA: el cliente entrega USD (u otra) y recibe divisa extranjera
    const comportamientoBilletes =
      operationType === "COMPRA"
        ? monedaOrigen.comportamiento_compra || "MULTIPLICA"
        : monedaDestino.comportamiento_venta || "MULTIPLICA";
    const comportamientoMonedas =
      operationType === "COMPRA"
        ? monedaOrigen.comportamiento_compra || "MULTIPLICA"
        : monedaDestino.comportamiento_venta || "MULTIPLICA";

    const conv = (monto: number, tasa: number, comp: string) => {
      if (!(monto > 0 && tasa > 0)) return 0;
      return comp === "DIVIDE" ? monto / tasa : monto * tasa;
    };

    const totalBilletes = conv(
      amountBilletesNum,
      rateBilletesNum,
      comportamientoBilletes
    );
    const totalMonedas = conv(
      amountMonedasNum,
      rateMonedasNum,
      comportamientoMonedas
    );

    return totalBilletes + totalMonedas;
  }, [
    currencies,
    fromCurrency,
    toCurrency,
    amountBilletesNum,
    amountMonedasNum,
    rateBilletesNum,
    rateMonedasNum,
    operationType,
  ]);

  // Limpia la tasa que no se usa para evitar confusión visual
  useEffect(() => {
    if (amountBilletesNum === 0 && rateBilletes !== "") {
      setRateBilletes("");
    }
    if (amountMonedasNum === 0 && rateMonedas !== "") {
      setRateMonedas("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountBilletesNum, amountMonedasNum]);

  // Validación de monedas cargadas (después de hooks para no romper el orden)
  if (!hasEnoughCurrencies) {
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

  const handleSubmit = () => {
    if (!fromCurrency || !toCurrency) {
      toast.error(
        "Debe seleccionar qué moneda entrega el cliente y qué moneda recibe"
      );
      return;
    }

    // Bloquear monedas iguales (alineado con backend)
    if (fromCurrency === toCurrency) {
      toast.error("La moneda de origen y la de destino no pueden ser iguales.");
      return;
    }

    // Debe ingresar al menos un monto (billetes o monedas)
    if (!amountBilletes && !amountMonedas) {
      toast.error("Debe ingresar al menos un monto (billetes o monedas)");
      return;
    }

    // Validar tasa solo donde haya monto
    if (amountBilletesNum > 0 && !(rateBilletesNum > 0)) {
      toast.error(
        "La tasa de cambio para billetes debe ser un número positivo"
      );
      return;
    }
    if (amountMonedasNum > 0 && !(rateMonedasNum > 0)) {
      toast.error("La tasa de cambio para monedas debe ser un número positivo");
      return;
    }

    // Al menos una combinación válida (monto + tasa)
    const tieneBilletesValidos = amountBilletesNum > 0 && rateBilletesNum > 0;
    const tieneMonedasValidas = amountMonedasNum > 0 && rateMonedasNum > 0;
    if (!tieneBilletesValidos && !tieneMonedasValidas) {
      toast.error(
        "Ingrese una tasa válida para el tipo de valor ingresado (billetes o monedas)"
      );
      return;
    }

    if (!(totalAmountEntregado > 0)) {
      toast.error("El monto total entregado debe ser mayor a cero");
      return;
    }

    // Validación específica para abonos parciales
    if (isPartialPayment && maxAmount && totalAmountRecibido > maxAmount) {
      toast.error(`El abono no puede exceder ${maxAmount.toLocaleString()}`);
      return;
    }

    const formData: ExchangeFormData = {
      operationType,
      fromCurrency,
      toCurrency,
      fromCurrencyName: getCurrencyName(fromCurrency),
      toCurrencyName: getCurrencyName(toCurrency),
      rateBilletes,
      rateMonedas,
      amountBilletes,
      amountMonedas,
      totalAmountEntregado,
      totalAmountRecibido,
      observation,
    };

    // Usar onSubmit si está disponible (p.ej., para flujos de abono), sino onContinue
    if (onSubmit) onSubmit(formData);
    else if (onContinue) onContinue(formData);
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
          <Button
            variant="outline"
            onClick={onBack ? onBack : onCancel}
            type="button"
          >
            {isPartialPayment ? "Cancelar" : "Atrás"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !fromCurrency ||
              !toCurrency ||
              fromCurrency === toCurrency ||
              (!amountBilletes && !amountMonedas)
            }
            className="flex-1"
            type="button"
          >
            {isPartialPayment ? "Continuar con Abono" : "Continuar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExchangeForm;
