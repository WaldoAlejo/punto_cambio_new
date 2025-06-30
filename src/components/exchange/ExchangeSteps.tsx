import { useState, forwardRef, useImperativeHandle } from "react";
import CustomerDataForm from "./CustomerDataForm";
import ExchangeForm, { ExchangeFormData } from "./ExchangeForm";
import ExchangeDetailsForm from "./ExchangeDetailsForm";
import { DatosCliente, DetalleDivisasSimple, Moneda } from "../../types";

interface ExchangeStepsProps {
  currencies: Moneda[];
  onComplete: (data: ExchangeCompleteData) => void;
}

export interface ExchangeCompleteData {
  customerData: DatosCliente;
  exchangeData: ExchangeFormData;
  divisasEntregadas: DetalleDivisasSimple;
  divisasRecibidas: DetalleDivisasSimple;
}

export interface ExchangeStepsRef {
  resetSteps: () => void;
}

const ExchangeSteps = forwardRef<ExchangeStepsRef, ExchangeStepsProps>(
  ({ currencies, onComplete }, ref) => {
    const [step, setStep] = useState<"customer" | "exchange" | "details">(
      "customer"
    );
    const [customerData, setCustomerData] = useState<DatosCliente>({
      nombre: "",
      apellido: "",
      documento: "",
      cedula: "",
      telefono: "",
    });
    const [exchangeData, setExchangeData] = useState<ExchangeFormData | null>(
      null
    );
    const [divisasEntregadas, setDivisasEntregadas] =
      useState<DetalleDivisasSimple>({
        billetes: 0,
        monedas: 0,
        total: 0,
      });
    const [divisasRecibidas, setDivisasRecibidas] =
      useState<DetalleDivisasSimple>({
        billetes: 0,
        monedas: 0,
        total: 0,
      });

    const handleCustomerDataSubmit = (data: DatosCliente) => {
      setCustomerData(data);
      setStep("exchange");
    };

    const handleExchangeFormSubmit = (data: ExchangeFormData) => {
      setExchangeData(data);
      setStep("details");
    };

    const handleDetailsComplete = () => {
      if (exchangeData) {
        onComplete({
          customerData,
          exchangeData,
          divisasEntregadas,
          divisasRecibidas,
        });
      }
    };

    const getCurrency = (currencyId: string) => {
      return currencies.find((c) => c.id === currencyId);
    };

    const getCurrencyName = (currencyId: string) => {
      const currency = currencies.find((c) => c.id === currencyId);
      return currency ? currency.codigo : "";
    };

    const resetSteps = () => {
      setStep("customer");
      setCustomerData({
        nombre: "",
        apellido: "",
        documento: "",
        cedula: "",
        telefono: "",
      });
      setExchangeData(null);
      setDivisasEntregadas({ billetes: 0, monedas: 0, total: 0 });
      setDivisasRecibidas({ billetes: 0, monedas: 0, total: 0 });
    };

    useImperativeHandle(ref, () => ({
      resetSteps,
    }));

    // NUEVO: Validar si hay monedas antes de permitir pasos
    if (!currencies || currencies.length < 2) {
      return (
        <div className="text-center text-red-500 p-6">
          Debe haber al menos dos monedas registradas para operar un cambio.
          Solicite a un administrador registrar monedas.
        </div>
      );
    }

    switch (step) {
      case "customer":
        return (
          <CustomerDataForm
            onCustomerData={handleCustomerDataSubmit}
            initialData={customerData}
          />
        );

      case "exchange":
        return (
          <ExchangeForm
            currencies={currencies}
            onBack={() => setStep("customer")}
            onContinue={handleExchangeFormSubmit}
          />
        );

      case "details":
        return (
          <ExchangeDetailsForm
            fromCurrency={
              exchangeData ? getCurrency(exchangeData.fromCurrency) : null
            }
            toCurrency={
              exchangeData ? getCurrency(exchangeData.toCurrency) : null
            }
            fromCurrencyName={
              exchangeData ? getCurrencyName(exchangeData.fromCurrency) : ""
            }
            toCurrencyName={
              exchangeData ? getCurrencyName(exchangeData.toCurrency) : ""
            }
            onBack={() => setStep("exchange")}
            onComplete={handleDetailsComplete}
            onDivisasEntregadasChange={setDivisasEntregadas}
            onDivisasRecibidasChange={setDivisasRecibidas}
            divisasEntregadas={divisasEntregadas}
            divisasRecibidas={divisasRecibidas}
          />
        );

      default:
        return null;
    }
  }
);

ExchangeSteps.displayName = "ExchangeSteps";

export default ExchangeSteps;
