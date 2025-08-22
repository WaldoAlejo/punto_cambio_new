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
            currencies={currencies}
            value={fromCurrency}
            onValueChange={setFromCurrency}
            placeholder="Seleccionar moneda que entrega el cliente"
            label="💰 Moneda que ENTREGA el Cliente"
          />
        </div>

        <div className="space-y-2">
          <CurrencySearchSelect
            currencies={currencies}
            value={toCurrency}
            onValueChange={setToCurrency}
            placeholder="Seleccionar moneda que recibe el cliente"
            label="💵 Moneda que RECIBE el Cliente"
          />
        </div>
      </div>

      {/* Tasa y montos en una fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tasa de Cambio</Label>
          <Input
            type="number"
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.0000"
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            💰 Monto que Entrega el Cliente
            {fromCurrency && (
              <span className="text-muted-foreground ml-1">
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
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            💵 Monto que Recibe el Cliente
            {toCurrency && (
              <span className="text-muted-foreground ml-1">
                ({getCurrencyName(toCurrency)})
              </span>
            )}
          </Label>
          <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 flex items-center">
            <span className="font-medium text-primary">
              {isNaN(destinationAmount) ? "0.00" : destinationAmount.toFixed(2)}
            </span>
          </div>
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
