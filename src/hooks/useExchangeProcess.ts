
import { useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, CambioDivisa } from '../types';
import { exchangeService } from '../services/exchangeService';
import { ReceiptService } from '../services/receiptService';
import { ExchangeCompleteData } from '../components/exchange/ExchangeSteps';

interface UseExchangeProcessProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExchangeCreated: (exchange: CambioDivisa) => void;
  onResetForm: () => void;
}

export const useExchangeProcess = ({ 
  user, 
  selectedPoint, 
  onExchangeCreated, 
  onResetForm 
}: UseExchangeProcessProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const generateReceiptAndPrint = (exchange: CambioDivisa) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || "N/A",
      user.nombre
    );

    try {
      ReceiptService.printReceipt(receiptData, 2);
    } catch (error) {
      toast({
        title: "Advertencia",
        description: "El recibo se generó correctamente pero hubo un problema con la impresión",
        variant: "default",
      });
    }
  };

  const processExchange = async (data: ExchangeCompleteData) => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

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

      const { exchange: createdExchange, error } = await exchangeService.createExchange(exchangePayload);

      if (error) {
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

      onExchangeCreated(createdExchange);

      toast({
        title: "Cambio realizado",
        description: `Cambio completado exitosamente. Recibo: ${createdExchange.numero_recibo}`,
      });

      onResetForm();

      setTimeout(() => {
        generateReceiptAndPrint(createdExchange);
      }, 100);

    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al procesar el cambio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processExchange
  };
};
