import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import {
  User,
  PuntoAtencion,
  Moneda,
  CambioDivisa,
} from "../../types";
import { ReceiptService } from "../../services/receiptService";
import { currencyService } from "../../services/currencyService";
import { exchangeService } from "../../services/exchangeService";
import ExchangeSteps, { ExchangeCompleteData, ExchangeStepsRef } from "./ExchangeSteps";
import ExchangeList from "./ExchangeList";

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const ExchangeManagement = ({
  user,
  selectedPoint,
}: ExchangeManagementProps) => {
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const stepsRef = useRef<ExchangeStepsRef>(null);

  useEffect(() => {
    const fetchCurrencies = async () => {
      console.log('=== FETCHING CURRENCIES IN EXCHANGE MANAGEMENT ===');
      setIsLoadingCurrencies(true);
      try {
        const { currencies: fetchedCurrencies, error } = await currencyService.getAllCurrencies();
        
        if (error) {
          console.error("Error fetching currencies:", error);
          toast({
            title: "Error",
            description: "No se pudieron cargar las monedas: " + error,
            variant: "destructive",
          });
          setCurrencies([]);
        } else {
          console.log('Currencies loaded successfully:', fetchedCurrencies);
          setCurrencies(fetchedCurrencies || []);
        }
      } catch (error) {
        console.error("Error al obtener monedas:", error);
        toast({
          title: "Error",
          description: "Error de conexión al cargar las monedas.",
          variant: "destructive",
        });
        setCurrencies([]);
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    fetchCurrencies();
  }, []);

  const generateReceiptAndPrint = (exchange: CambioDivisa) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || "N/A",
      user.nombre
    );

    try {
      ReceiptService.printReceipt(receiptData, 2);
    } catch (error) {
      console.error('Error al imprimir recibo:', error);
      toast({
        title: "Advertencia",
        description: "El recibo se generó correctamente pero hubo un problema con la impresión",
        variant: "default",
      });
    }
  };

  const handleExchangeComplete = async (data: ExchangeCompleteData) => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    console.log('=== INICIANDO PROCESO DE CAMBIO DE DIVISA ===');

    try {
      const rateValue = parseFloat(data.exchangeData.rate) || 0;

      const exchangePayload = {
        moneda_origen_id: data.exchangeData.fromCurrency,
        moneda_destino_id: data.exchangeData.toCurrency,
        monto_origen: parseFloat(data.exchangeData.amount),
        monto_destino: data.exchangeData.destinationAmount,
        tasa_cambio: rateValue,
        tipo_operacion: data.exchangeData.operationType,
        punto_atencion_id: selectedPoint.id,
        datos_cliente: data.customerData,
        divisas_entregadas: data.divisasEntregadas,
        divisas_recibidas: data.divisasRecibidas,
        observacion: data.exchangeData.observation || undefined,
      };

      console.log('Datos del cambio a enviar:', exchangePayload);

      const { exchange: createdExchange, error } = await exchangeService.createExchange(exchangePayload);

      if (error) {
        console.error('Error del servicio:', error);
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      if (!createdExchange) {
        toast({
          title: "Error",
          description: "No se pudo crear el cambio de divisa",
          variant: "destructive",
        });
        return;
      }

      console.log('Cambio creado exitosamente:', createdExchange);

      setExchanges([createdExchange, ...exchanges]);

      toast({
        title: "Cambio realizado",
        description: `Cambio completado exitosamente. Recibo: ${createdExchange.numero_recibo}`,
      });

      // Reset form immediately using ref
      if (stepsRef.current) {
        stepsRef.current.resetSteps();
      }

      // Print receipt after short delay
      setTimeout(() => {
        generateReceiptAndPrint(createdExchange);
      }, 100);

    } catch (error) {
      console.error('Error inesperado al procesar cambio:', error);
      toast({
        title: "Error",
        description: "Error inesperado al procesar el cambio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Los cambios de divisas solo pueden ser realizados por operadores y
        concesiones
      </div>
    );
  }

  if (!selectedPoint) {
    return (
      <div className="p-6 text-center py-12 text-gray-500 text-lg">
        Debe seleccionar un punto de atención
      </div>
    );
  }

  if (isLoadingCurrencies) {
    return (
      <div className="p-6 text-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando monedas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cambio de Divisas</h1>
        <div className="text-sm text-gray-500">
          Punto: {selectedPoint?.nombre}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {isProcessing ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Procesando cambio...</p>
            </div>
          ) : (
            <ExchangeSteps
              ref={stepsRef}
              currencies={currencies}
              onComplete={handleExchangeComplete}
            />
          )}
        </div>

        <ExchangeList exchanges={exchanges} currencies={currencies} />
      </div>
    </div>
  );
};

export default ExchangeManagement;
