import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

  // Detección de inversión USD según tipo de operación
  const usdCurrency = currencies.find(
    (c) => (c?.codigo || "").toUpperCase() === "USD"
  );
  const isUSDFrom = !!usdCurrency && fromCurrency === usdCurrency.id;
  const isUSDTo = !!usdCurrency && toCurrency === usdCurrency.id;
  const usdInversion =
    !!usdCurrency &&
    ((operationType === "COMPRA" && isUSDFrom) ||
      (operationType === "VENTA" && isUSDTo));

  const fixUSDInversion = () => {
    // Intercambia origen/destino y limpia montos/tasas para evitar unidades equivocadas
    const prevFrom = fromCurrency;
    const prevTo = toCurrency;
    setFromCurrency(prevTo);
    setToCurrency(prevFrom);
    setAmountBilletes("");
    setAmountMonedas("");
    setRateBilletes("");
    setRateMonedas("");
  };

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
    <div className="space-y-3 sm:space-y-4">
      {/* Tipo de operación compacto */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-xs sm:text-sm font-medium">Tipo de Operación</Label>
        <Select
          value={operationType}
          onValueChange={(value) =>
            setOperationType(value as "COMPRA" | "VENTA")
          }
        >
          <SelectTrigger className="h-9 sm:h-10 text-sm">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMPRA">COMPRA</SelectItem>
            <SelectItem value="VENTA">VENTA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monedas - Responsive: apiladas en móvil */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <CurrencySearchSelect
            currencies={fromOptions}
            value={fromCurrency}
            onValueChange={handleSelectFrom}
            placeholder="Moneda que entrega"
            label="💰 Entrega el Cliente"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <CurrencySearchSelect
            currencies={toOptions}
            value={toCurrency}
            onValueChange={handleSelectTo}
            placeholder="Moneda que recibe"
            label="💵 Recibe el Cliente"
          />
        </div>
      </div>

      {/* Aviso y corrección si USD está invertido */}
      {usdInversion && (
        <div className="p-2.5 sm:p-3 border border-yellow-300 bg-yellow-50 rounded-md text-xs sm:text-sm flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1">
            <p className="font-medium text-yellow-800">
              USD invertido para {operationType}
            </p>
            <p className="text-yellow-800/90 text-xs">
              USD debe ser {operationType === "COMPRA" ? "DESTINO" : "ORIGEN"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={fixUSDInversion}>
            Corregir
          </Button>
        </div>
      )}

      {/* Información del comportamiento de cálculo */}
      {fromCurrency && toCurrency && (
        <CurrencyBehaviorInfo
          monedaOrigen={currencies.find((c) => c.id === fromCurrency)}
          monedaDestino={currencies.find((c) => c.id === toCurrency)}
          tipoOperacion={operationType}
        />
      )}

      {/* Tasas diferenciadas - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1">
          <Label className="text-xs sm:text-sm font-medium">
            💴 Tasa Billetes
          </Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={rateBilletes}
            onChange={(e) => setRateBilletes(e.target.value)}
            placeholder={billetesActivos ? "0.0000" : "Con billetes"}
            className="h-9 sm:h-10 text-sm"
            disabled={!billetesActivos}
          />
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Solo con billetes
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs sm:text-sm font-medium">
            🪙 Tasa Monedas
          </Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={rateMonedas}
            onChange={(e) => setRateMonedas(e.target.value)}
            placeholder={monedasActivas ? "0.0000" : "Con monedas"}
            className="h-9 sm:h-10 text-sm"
            disabled={!monedasActivas}
          />
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Solo con monedas
          </p>
        </div>
      </div>

      {/* Montos que entrega el cliente - Responsive */}
      <div className="border rounded-lg p-3 sm:p-4 bg-blue-50">
        <Label className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 block">
          💰 Entrega el Cliente
          {fromCurrency && (
            <span className="text-muted-foreground ml-1">
              ({getCurrencyName(fromCurrency)})
            </span>
          )}
        </Label>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-[10px] sm:text-xs">💴 Billetes</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={amountBilletes}
              onChange={(e) => onAmountBilletesChange(e.target.value)}
              placeholder="0.00"
              className="h-8 sm:h-9 text-sm"
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-[10px] sm:text-xs">🪙 Monedas</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={amountMonedas}
              onChange={(e) => onAmountMonedasChange(e.target.value)}
              placeholder="0.00"
              className="h-8 sm:h-9 text-sm"
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-[10px] sm:text-xs">💰 Total</Label>
            <div className="h-8 sm:h-9 px-2 sm:px-3 py-1.5 sm:py-2 border rounded-md bg-white flex items-center font-bold text-blue-700 text-sm">
              {isNaN(totalAmountEntregado)
                ? "0.00"
                : totalAmountEntregado.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Monto total que recibe el cliente - Responsive */}
      <div className="border rounded-lg p-3 sm:p-4 bg-green-50">
        <Label className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 block">
          💵 Recibe el Cliente
          {toCurrency && (
            <span className="text-muted-foreground ml-1">
              ({getCurrencyName(toCurrency)})
            </span>
          )}
        </Label>
        <div className="h-10 sm:h-12 px-3 sm:px-4 py-2 sm:py-3 border rounded-md bg-white flex items-center">
          <span className="text-lg sm:text-xl font-bold text-green-700">
            {isNaN(totalAmountRecibido)
              ? "0.00"
              : totalAmountRecibido.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-xs sm:text-sm font-medium">Observaciones</Label>
        <Input
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Observaciones..."
          className="h-9 sm:h-10 text-sm"
        />
      </div>
    </div>
  );
};

export default ExchangeFormFields;
