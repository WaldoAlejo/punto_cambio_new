import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import CustomerDataForm from "./CustomerDataForm";
import ExchangeForm, {
  ExchangeFormData as BaseExchangeFormData,
} from "./ExchangeForm";
import ExchangeDetailsForm from "./ExchangeDetailsForm";
import { DatosCliente, DetalleDivisasSimple, Moneda, User } from "../../types";

interface ExchangeStepsProps {
  currencies: Moneda[];
  user: User;
  onComplete: (data: ExchangeCompleteData) => void;
}

export interface ExchangeCompleteData {
  customerData: DatosCliente;
  exchangeData: ExchangeFormData;

  // Detalles de divisas que se entregarán al cliente (método de entrega)
  divisasRecibidas: DetalleDivisasSimple;
  metodoEntrega: "efectivo" | "transferencia";
  transferenciaNumero?: string;
  transferenciaBanco?: string;
  transferenciaImagen?: File | null;

  // Campos para abono parcial
  abonoInicialMonto?: number | null;
  abonoInicialFecha?: string | null;
  abonoInicialRecibidoPor?: string | null;
  saldoPendiente?: number | null;
  referenciaCambioPrincipal?: string | null;
}

// Extiende ExchangeFormData para incluir las propiedades faltantes
interface ExchangeFormData extends BaseExchangeFormData {
  esCambioParcial?: boolean;
  montoAEntregar?: number;
}

export interface ExchangeStepsRef {
  resetSteps: () => void;
}

const ExchangeSteps = forwardRef<ExchangeStepsRef, ExchangeStepsProps>(
  ({ currencies, user, onComplete }, ref) => {
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

    const [divisasRecibidas, setDivisasRecibidas] =
      useState<DetalleDivisasSimple>({
        billetes: 0,
        monedas: 0,
        total: 0,
      });

    // Método de entrega
    const [metodoEntrega, setMetodoEntrega] = useState<
      "efectivo" | "transferencia"
    >("efectivo");
    const [transferenciaNumero, setTransferenciaNumero] = useState("");
    const [transferenciaBanco, setTransferenciaBanco] = useState("");
    const [transferenciaImagen, setTransferenciaImagen] = useState<File | null>(
      null
    );

    // Abono parcial
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

    // === Efectos ===
    // Auto-llenar "Recibido por" cuando se activa el cambio parcial
    useEffect(() => {
      if (
        exchangeData?.esCambioParcial &&
        abonoInicialMonto &&
        abonoInicialMonto > 0
      ) {
        if (!abonoInicialRecibidoPor) {
          setAbonoInicialRecibidoPor(user.nombre || user.username || user.id);
        }
        if (!abonoInicialFecha) {
          setAbonoInicialFecha(new Date().toISOString().split("T")[0]);
        }
      } else if (!exchangeData?.esCambioParcial) {
        // Limpiar campos si no es cambio parcial
        setAbonoInicialRecibidoPor(null);
        setAbonoInicialFecha(null);
      }
    }, [
      exchangeData?.esCambioParcial,
      abonoInicialMonto,
      abonoInicialRecibidoPor,
      abonoInicialFecha,
      user.id,
      user.nombre,
      user.username,
    ]);

    // Calcular automáticamente el saldo pendiente
    useEffect(() => {
      if (
        exchangeData?.esCambioParcial &&
        exchangeData?.montoAEntregar &&
        abonoInicialMonto !== null &&
        abonoInicialMonto !== undefined
      ) {
        const saldoCalculado = exchangeData.montoAEntregar - abonoInicialMonto;
        setSaldoPendiente(saldoCalculado > 0 ? saldoCalculado : 0);
      } else if (!exchangeData?.esCambioParcial) {
        setSaldoPendiente(null);
      }
    }, [
      exchangeData?.esCambioParcial,
      exchangeData?.montoAEntregar,
      abonoInicialMonto,
    ]);

    // === Handlers ===
    const handleCustomerDataSubmit = (data: DatosCliente) => {
      setCustomerData({
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        documento: (data.documento || data.cedula || "").trim(),
        cedula: data.cedula.trim(),
        telefono: (data.telefono || "").trim(),
      });
      setStep("exchange");
    };

    const handleExchangeFormSubmit = (data: ExchangeFormData) => {
      setExchangeData(data);
      // Reiniciar detalle de entrega al entrar a la etapa "details"
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
      setStep("details");
    };

    const handleDivisasRecibidasChange = (data: DetalleDivisasSimple) => {
      setDivisasRecibidas({
        billetes: Number(data.billetes || 0),
        monedas: Number(data.monedas || 0),
        total: Number(data.total || 0),
      });
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

    // Abonos parciales
    const handleAbonoInicialMontoChange = (v: number | null) =>
      setAbonoInicialMonto(v);
    const handleAbonoInicialFechaChange = (v: string | null) =>
      setAbonoInicialFecha(v);
    const handleAbonoInicialRecibidoPorChange = (v: string | null) =>
      setAbonoInicialRecibidoPor(v);
    const handleReferenciaCambioPrincipalChange = (v: string | null) =>
      setReferenciaCambioPrincipal(v);

    // Completar: empaqueta y envía todo
    const handleDetailsComplete = () => {
      if (!exchangeData) return;

      onComplete({
        customerData,
        exchangeData,
        divisasRecibidas,
        metodoEntrega,
        transferenciaNumero: transferenciaNumero?.trim() || undefined,
        transferenciaBanco: transferenciaBanco?.trim() || undefined,
        transferenciaImagen,
        abonoInicialMonto,
        abonoInicialFecha,
        abonoInicialRecibidoPor,
        saldoPendiente,
        referenciaCambioPrincipal: referenciaCambioPrincipal?.trim() || null,
      });
    };

    const getCurrency = (currencyId: string) =>
      currencies.find((c) => c.id === currencyId);

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

    useImperativeHandle(ref, () => ({ resetSteps }));

    // Guardas por si no hay monedas
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
        if (!exchangeData) {
          return null;
        }
        return (
          <ExchangeDetailsForm
            fromCurrency={
              exchangeData
                ? getCurrency(exchangeData.fromCurrency) || null
                : null
            }
            toCurrency={
              exchangeData ? getCurrency(exchangeData.toCurrency) || null : null
            }
            fromCurrencyName={
              exchangeData ? getCurrencyName(exchangeData.fromCurrency) : ""
            }
            toCurrencyName={
              exchangeData ? getCurrencyName(exchangeData.toCurrency) : ""
            }
            exchangeData={exchangeData}
            onBack={() => setStep("exchange")}
            onComplete={handleDetailsComplete}
            onDivisasRecibidasChange={handleDivisasRecibidasChange}
            divisasRecibidas={divisasRecibidas}
            // Método de entrega
            metodoEntrega={metodoEntrega}
            onMetodoEntregaChange={handleMetodoEntregaChange}
            transferenciaNumero={transferenciaNumero}
            onTransferenciaNumeroChange={handleTransferenciaNumeroChange}
            transferenciaBanco={transferenciaBanco}
            onTransferenciaBancoChange={handleTransferenciaBancoChange}
            transferenciaImagen={transferenciaImagen}
            onTransferenciaImagenChange={handleTransferenciaImagenChange}
            // Abonos parciales
            abonoInicialMonto={abonoInicialMonto}
            onAbonoInicialMontoChange={handleAbonoInicialMontoChange}
            abonoInicialFecha={abonoInicialFecha}
            onAbonoInicialFechaChange={handleAbonoInicialFechaChange}
            abonoInicialRecibidoPor={abonoInicialRecibidoPor}
            onAbonoInicialRecibidoPorChange={
              handleAbonoInicialRecibidoPorChange
            }
            saldoPendiente={saldoPendiente}
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
