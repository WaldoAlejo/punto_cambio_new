import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moneda } from "../../types";
import CurrencySearchSelect from "../ui/currency-search-select";
import CurrencyBehaviorInfo from "./CurrencyBehaviorInfo";

interface ExchangeFormFieldsProps {
  operationType: "COMPRA" | "VENTA";
  setOperationType: (value: "COMPRA" | "VENTA") => void;
  fromCurrency: string;
  setFromCurrency: (value: string) => void;
  toCurrency: string;
  setToCurrency: (value: string) => void;

  // Tasas diferenciadas
  rateBilletes: string;
  setRateBilletes: (value: string) => void;
  rateMonedas: string;
  setRateMonedas: (value: string) => void;

  // Montos entregados por el cliente
  amountBilletes: string;
  setAmountBilletes: (value: string) => void;
  amountMonedas: string;
  setAmountMonedas: (value: string) => void;
  totalAmountEntregado: number;

  // Monto total que recibe el cliente
  totalAmountRecibido: number;

  observation: string;
  setObservation: (value: string) => void;
  currencies: Moneda[];
  getCurrencyName: (currencyId: string) => string;
}

const ExchangeFormFields = ({
  operationType,
  setOperationType,
  fromCurrency,
  setFromCurrency,
  toCurrency,
  setToCurrency,
  rateBilletes,
  setRateBilletes,
  rateMonedas,
  setRateMonedas,
  amountBilletes,
  setAmountBilletes,
  amountMonedas,
  setAmountMonedas,
  totalAmountEntregado,
  totalAmountRecibido,
  observation,
  setObservation,
  currencies,
  getCurrencyName,
}: ExchangeFormFieldsProps) => {
  // Si no hay monedas, muestra mensaje claro
  if (!currencies || currencies.length === 0) {
    return (
      <div className="text-red-500 text-sm py-4">
        No hay monedas registradas en el sistema. Solicite a un administrador
        que registre al menos dos monedas para operar.
      </div>
    );
  }

  // Evitar seleccionar la misma moneda en origen/destino
  const handleSelectFrom = (value: string) => {
    setFromCurrency(value);
    if (value === toCurrency) {
      // Si el usuario eligió la misma, limpiamos destino para forzar corrección
      setToCurrency("");
    }
  };
  const handleSelectTo = (value: string) => {
    setToCurrency(value);
    if (value === fromCurrency) {
      setFromCurrency("");
    }
  };

  // Filtrar listas para no ofrecer la moneda ya elegida al otro lado (mejor UX)
  const fromOptions = currencies.filter((c) => c.id !== toCurrency);
  const toOptions = currencies.filter((c) => c.id !== fromCurrency);

  // Helpers para limpiar tasas cuando no se usa el monto asociado
  const onAmountBilletesChange = (v: string) => {
    setAmountBilletes(v);
    const n = parseFloat(v);
    if (!v || isNaN(n) || n <= 0) {
      // si ya no hay billetes, limpiar tasa de billetes para evitar validaciones confusas
      if (rateBilletes !== "") setRateBilletes("");
    }
  };
  const onAmountMonedasChange = (v: string) => {
    setAmountMonedas(v);
    const n = parseFloat(v);
    if (!v || isNaN(n) || n <= 0) {
      if (rateMonedas !== "") setRateMonedas("");
    }
  };

  const billetesActivos =
    !!amountBilletes && (parseFloat(amountBilletes) || 0) > 0;
  const monedasActivas =
    !!amountMonedas && (parseFloat(amountMonedas) || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Tipo de operación compacto */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tipo de Operación</Label>
        <Select
          value={operationType}
          onValueChange={(value: "COMPRA" | "VENTA") => setOperationType(value)}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMPRA">COMPRA</SelectItem>
            <SelectItem value="VENTA">VENTA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monedas en una sola fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <CurrencySearchSelect
            currencies={fromOptions}
            value={fromCurrency}
            onValueChange={handleSelectFrom}
            placeholder="Seleccionar moneda que entrega el cliente"
            label="💰 Moneda que ENTREGA el Cliente"
          />
        </div>

        <div className="space-y-2">
          <CurrencySearchSelect
            currencies={toOptions}
            value={toCurrency}
            onValueChange={handleSelectTo}
            placeholder="Seleccionar moneda que recibe el cliente"
            label="💵 Moneda que RECIBE el Cliente"
          />
        </div>
      </div>

      {/* Información del comportamiento de cálculo */}
      {fromCurrency && toCurrency && (
        <CurrencyBehaviorInfo
          monedaOrigen={currencies.find((c) => c.id === fromCurrency)}
          monedaDestino={currencies.find((c) => c.id === toCurrency)}
          tipoOperacion={operationType}
        />
      )}

      {/* Tasas diferenciadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm font-medium">
            💴 Tasa de Cambio para Billetes
          </Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={rateBilletes}
            onChange={(e) => setRateBilletes(e.target.value)}
            placeholder={
              billetesActivos ? "0.0000" : "Se habilita con billetes"
            }
            className="h-10"
            disabled={!billetesActivos}
          />
          <p className="text-xs text-muted-foreground">
            Solo requerida si ingresa monto en <b>billetes</b>.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium">
            🪙 Tasa de Cambio para Monedas
          </Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={rateMonedas}
            onChange={(e) => setRateMonedas(e.target.value)}
            placeholder={monedasActivas ? "0.0000" : "Se habilita con monedas"}
            className="h-10"
            disabled={!monedasActivas}
          />
          <p className="text-xs text-muted-foreground">
            Solo requerida si ingresa monto en <b>monedas</b>.
          </p>
        </div>
      </div>

      {/* Montos que entrega el cliente */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <Label className="text-sm font-medium mb-3 block">
          💰 Montos que Entrega el Cliente
          {fromCurrency && (
            <span className="text-muted-foreground ml-1">
              ({getCurrencyName(fromCurrency)})
            </span>
          )}
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">💴 Billetes</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountBilletes}
              onChange={(e) => onAmountBilletesChange(e.target.value)}
              placeholder="0.00"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">🪙 Monedas</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountMonedas}
              onChange={(e) => onAmountMonedasChange(e.target.value)}
              placeholder="0.00"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">💰 Total Entregado</Label>
            <div className="h-9 px-3 py-2 border rounded-md bg-white flex items-center font-bold text-blue-700">
              {isNaN(totalAmountEntregado)
                ? "0.00"
                : totalAmountEntregado.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Monto total que recibe el cliente */}
      <div className="border rounded-lg p-4 bg-green-50">
        <Label className="text-sm font-medium mb-3 block">
          💵 Monto Total que Recibe el Cliente
          {toCurrency && (
            <span className="text-muted-foreground ml-1">
              ({getCurrencyName(toCurrency)})
            </span>
          )}
        </Label>
        <div className="h-12 px-4 py-3 border rounded-md bg-white flex items-center">
          <span className="text-xl font-bold text-green-700">
            {isNaN(totalAmountRecibido)
              ? "0.00"
              : totalAmountRecibido.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Observaciones más compactas */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Observaciones (Opcional)</Label>
        <Input
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Observaciones adicionales..."
          className="h-10"
        />
      </div>
    </div>
  );
};

export default ExchangeFormFields;
