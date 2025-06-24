
import { Button } from "@/components/ui/button";
import CurrencyDetailForm from "./CurrencyDetailForm";
import { DetalleDivisasSimple, Moneda } from "../../types";

interface ExchangeDetailsFormProps {
  fromCurrency: Moneda | null;
  toCurrency: Moneda | null;
  fromCurrencyName: string;
  toCurrencyName: string;
  onBack: () => void;
  onComplete: () => void;
  onDivisasEntregadasChange: (data: DetalleDivisasSimple) => void;
  onDivisasRecibidasChange: (data: DetalleDivisasSimple) => void;
  divisasEntregadas: DetalleDivisasSimple;
  divisasRecibidas: DetalleDivisasSimple;
}

const ExchangeDetailsForm = ({
  fromCurrency,
  toCurrency,
  fromCurrencyName,
  toCurrencyName,
  onBack,
  onComplete,
  onDivisasEntregadasChange,
  onDivisasRecibidasChange,
  divisasEntregadas,
  divisasRecibidas,
}: ExchangeDetailsFormProps) => {
  return (
    <div className="space-y-4">
      {fromCurrency && (
        <CurrencyDetailForm
          currency={fromCurrency}
          title={`Divisas Entregadas (${fromCurrencyName})`}
          onDetailData={onDivisasEntregadasChange}
          initialData={divisasEntregadas}
        />
      )}
      {toCurrency && (
        <CurrencyDetailForm
          currency={toCurrency}
          title={`Divisas Recibidas (${toCurrencyName})`}
          onDetailData={onDivisasRecibidasChange}
          initialData={divisasRecibidas}
        />
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button onClick={onComplete} className="flex-1">
          Completar Cambio
        </Button>
      </div>
    </div>
  );
};

export default ExchangeDetailsForm;
