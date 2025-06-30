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
  metodoEntrega: "efectivo" | "transferencia";
  transferenciaNumero?: string;
  transferenciaBanco?: string;
  transferenciaImagen?: File | null;
  // NUEVO: Campos para abono parcial
  abonoInicialMonto?: number | null;
  abonoInicialFecha?: string | null;
  abonoInicialRecibidoPor?: string | null;
  saldoPendiente?: number | null;
  referenciaCambioPrincipal?: string | null;
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

    // Estados del método de entrega
    const [metodoEntrega, setMetodoEntrega] = useState<
      "efectivo" | "transferencia"
    >("efectivo");
    const [transferenciaNumero, setTransferenciaNumero] = useState("");
    const [transferenciaBanco, setTransferenciaBanco] = useState("");
    const [transferenciaImagen, setTransferenciaImagen] = useState<File | null>(
      null
    );

    // Estados para abono parcial
    const [abonoInicialMonto, setAbonoInicialMonto] = useState<number | null>(
      null
    );
    const [abonoInicialFecha, setAbonoInicialFecha] = useState<string | null>(
      null
    );
    const [abonoInicialRecibidoPor, setAbonoInicialRecibidoPor] = useState<
      string | null
    >(null);
    const [saldoPendiente, setSaldoPendiente] = useState<number | null>(null);
    const [referenciaCambioPrincipal, setReferenciaCambioPrincipal] = useState<
      string | null
    >(null);

    // Handlers para abonos parciales
    const handleAbonoInicialMontoChange = (v: number | null) =>
      setAbonoInicialMonto(v);
    const handleAbonoInicialFechaChange = (v: string | null) =>
      setAbonoInicialFecha(v);
    const handleAbonoInicialRecibidoPorChange = (v: string | null) =>
      setAbonoInicialRecibidoPor(v);
    const handleSaldoPendienteChange = (v: number | null) =>
      setSaldoPendiente(v);
    const handleReferenciaCambioPrincipalChange = (v: string | null) =>
      setReferenciaCambioPrincipal(v);

    const handleCustomerDataSubmit = (data: DatosCliente) => {
      setCustomerData(data);
      setStep("exchange");
    };

    const handleExchangeFormSubmit = (data: ExchangeFormData) => {
      setExchangeData(data);
      setStep("details");
    };

    const handleDivisasEntregadasChange = (data: DetalleDivisasSimple) => {
      setDivisasEntregadas(data);
    };

    const handleDivisasRecibidasChange = (data: DetalleDivisasSimple) => {
      setDivisasRecibidas(data);
    };

    const handleMetodoEntregaChange = (value: "efectivo" | "transferencia") => {
      setMetodoEntrega(value);
    };

    const handleTransferenciaNumeroChange = (value: string) => {
      setTransferenciaNumero(value);
    };

    const handleTransferenciaBancoChange = (value: string) => {
      setTransferenciaBanco(value);
    };

    const handleTransferenciaImagenChange = (file: File | null) => {
      setTransferenciaImagen(file);
    };

    // Al completar, envía todos los datos juntos (incluyendo abonos parciales)
    const handleDetailsComplete = () => {
      if (exchangeData) {
        onComplete({
          customerData,
          exchangeData,
          divisasEntregadas,
          divisasRecibidas,
          metodoEntrega,
          transferenciaNumero,
          transferenciaBanco,
          transferenciaImagen,
          abonoInicialMonto,
          abonoInicialFecha,
          abonoInicialRecibidoPor,
          saldoPendiente,
          referenciaCambioPrincipal,
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
      setMetodoEntrega("efectivo");
      setTransferenciaNumero("");
      setTransferenciaBanco("");
      setTransferenciaImagen(null);
      setAbonoInicialMonto(null);
      setAbonoInicialFecha(null);
      setAbonoInicialRecibidoPor(null);
      setSaldoPendiente(null);
      setReferenciaCambioPrincipal(null);
    };

    useImperativeHandle(ref, () => ({
      resetSteps,
    }));

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
            onDivisasEntregadasChange={handleDivisasEntregadasChange}
            onDivisasRecibidasChange={handleDivisasRecibidasChange}
            divisasEntregadas={divisasEntregadas}
            divisasRecibidas={divisasRecibidas}
            // Props para método de entrega
            metodoEntrega={metodoEntrega}
            onMetodoEntregaChange={handleMetodoEntregaChange}
            transferenciaNumero={transferenciaNumero}
            onTransferenciaNumeroChange={handleTransferenciaNumeroChange}
            transferenciaBanco={transferenciaBanco}
            onTransferenciaBancoChange={handleTransferenciaBancoChange}
            transferenciaImagen={transferenciaImagen}
            onTransferenciaImagenChange={handleTransferenciaImagenChange}
            // Props para abonos parciales
            abonoInicialMonto={abonoInicialMonto}
            onAbonoInicialMontoChange={handleAbonoInicialMontoChange}
            abonoInicialFecha={abonoInicialFecha}
            onAbonoInicialFechaChange={handleAbonoInicialFechaChange}
            abonoInicialRecibidoPor={abonoInicialRecibidoPor}
            onAbonoInicialRecibidoPorChange={
              handleAbonoInicialRecibidoPorChange
            }
            saldoPendiente={saldoPendiente}
            onSaldoPendienteChange={handleSaldoPendienteChange}
            referenciaCambioPrincipal={referenciaCambioPrincipal}
            onReferenciaCambioPrincipalChange={
              handleReferenciaCambioPrincipalChange
            }
          />
        );
      default:
        return null;
    }
  }
);

ExchangeSteps.displayName = "ExchangeSteps";

export default ExchangeSteps;
