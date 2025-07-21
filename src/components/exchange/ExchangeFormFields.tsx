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

interface ExchangeFormFieldsProps {
  operationType: "COMPRA" | "VENTA";
  setOperationType: (value: "COMPRA" | "VENTA") => void;
  fromCurrency: string;
  setFromCurrency: (value: string) => void;
  toCurrency: string;
  setToCurrency: (value: string) => void;
  rate: string;
  setRate: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  destinationAmount: number;
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
  rate,
  setRate,
  amount,
  setAmount,
  destinationAmount,
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

  return (
    <div className="space-y-6 p-6">
      {/* Tipo de operación con estilo mejorado */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Tipo de Operación</Label>
        <Select
          value={operationType}
          onValueChange={(value: "COMPRA" | "VENTA") => setOperationType(value)}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMPRA" className="text-base py-3">💰 Compra</SelectItem>
            <SelectItem value="VENTA" className="text-base py-3">💸 Venta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sección de monedas con mejor spacing */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <CurrencySearchSelect
            currencies={currencies}
            value={fromCurrency}
            onValueChange={setFromCurrency}
            placeholder="Seleccionar moneda origen"
            label="🏦 Moneda Origen"
          />
        </div>
        
        <div className="space-y-3">
          <CurrencySearchSelect
            currencies={currencies}
            value={toCurrency}
            onValueChange={setToCurrency}
            placeholder="Seleccionar moneda destino"
            label="🎯 Moneda Destino"
          />
        </div>
      </div>

      {/* Tasa de cambio destacada */}
      <div className="bg-accent/10 rounded-lg p-4 space-y-3">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          📊 Tasa de Cambio
        </Label>
        <Input
          type="number"
          step="0.0001"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Ingrese la tasa de cambio"
          className="h-12 text-base font-medium"
        />
      </div>

      {/* Montos con mejor diseño */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">
            💵 Monto a Cambiar
            {fromCurrency && (
              <span className="text-primary font-bold ml-1">
                ({getCurrencyName(fromCurrency)})
              </span>
            )}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="h-12 text-base font-medium"
          />
        </div>
        
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">
            ✨ Monto Resultante
            {toCurrency && (
              <span className="text-primary font-bold ml-1">
                ({getCurrencyName(toCurrency)})
              </span>
            )}
          </Label>
          <div className="h-12 px-4 py-3 border-2 border-primary/20 rounded-lg bg-primary/5 flex items-center">
            <span className="text-lg font-bold text-primary">
              {isNaN(destinationAmount) ? "0.00" : destinationAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Observaciones con mejor estilo */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">📝 Observaciones (Opcional)</Label>
        <Input
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Observaciones adicionales"
          className="h-12 text-base"
        />
      </div>
    </div>
  );
};

export default ExchangeFormFields;
