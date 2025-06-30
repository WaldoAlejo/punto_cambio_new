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
      <div className="space-y-2">
        <Label>Tipo de Operación</Label>
        <Select
          value={operationType}
          onValueChange={(value: "COMPRA" | "VENTA") => setOperationType(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo" />
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
          <Label>
            Monto a Cambiar
            {fromCurrency && ` (${getCurrencyName(fromCurrency)})`}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>
            Monto Resultante
            {toCurrency && ` (${getCurrencyName(toCurrency)})`}
          </Label>
          <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
            {isNaN(destinationAmount) ? "0.00" : destinationAmount.toFixed(2)}
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
    </div>
  );
};

export default ExchangeFormFields;
