import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  User,
  PuntoAtencion,
  CambioDivisa,
  DatosCliente,
  DetalleDivisasSimple,
} from "../types";
import { exchangeService } from "../services/exchangeService";
import { ReceiptService } from "../services/receiptService";
import { ExchangeCompleteData } from "../components/exchange/ExchangeSteps";

interface UseExchangeProcessProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExchangeCreated: (exchange: CambioDivisa) => void;
  onResetForm: () => void;
}

interface ExchangePayload {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  tipo_operacion: "COMPRA" | "VENTA";
  punto_atencion_id: string;
  datos_cliente: DatosCliente;
  divisas_entregadas: DetalleDivisasSimple;
  divisas_recibidas: DetalleDivisasSimple;
  observacion?: string;
  metodo_entrega: "efectivo" | "transferencia";
  transferencia_numero?: string | null;
  transferencia_banco?: string | null;
  transferencia_imagen_url?: string | null;
  // NUEVOS CAMPOS flujo parcial
  abono_inicial_monto?: number | null;
  abono_inicial_fecha?: string | null;
  saldo_pendiente?: number | null;
  referencia_cambio_principal?: string | null;
}

type ExchangeCompleteDataExtend = ExchangeCompleteData & {
  metodoEntrega: "efectivo" | "transferencia";
  transferenciaNumero?: string;
  transferenciaBanco?: string;
  transferenciaImagen?: File | null;
  abonoInicialMonto?: number | null;
  abonoInicialFecha?: string | null;
  saldoPendiente?: number | null;
  referenciaCambioPrincipal?: string | null;
};

export const useExchangeProcess = ({
  user,
  selectedPoint,
  onExchangeCreated,
  onResetForm,
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
      console.warn("Error al imprimir recibo:", error);
      toast({
        title: "Advertencia",
        description:
          "El recibo se generó correctamente pero hubo un problema con la impresión",
        variant: "default",
      });
    }
  };

  const processExchange = async (data: ExchangeCompleteDataExtend) => {
    if (isProcessing) return;
    if (!user) {
      toast({
        title: "Error",
        description: "Usuario no válido, reintente sesión.",
        variant: "destructive",
      });
      return;
    }
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
      const rateValue = parseFloat(data.exchangeData.rate);
      const montoOrigen = parseFloat(data.exchangeData.amount);

      if (
        !data.exchangeData.fromCurrency ||
        !data.exchangeData.toCurrency ||
        isNaN(rateValue) ||
        isNaN(montoOrigen) ||
        !data.exchangeData.operationType
      ) {
        toast({
          title: "Error",
          description: "Datos incompletos o inválidos para procesar el cambio.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      let transferenciaImagenUrl: string | null = null;
      if (data.metodoEntrega === "transferencia" && data.transferenciaImagen) {
        // Aquí podrías implementar la subida del archivo y obtener la URL
        toast({
          title: "Nota",
          description:
            "El archivo de comprobante de transferencia se debe subir manualmente (integra S3/Cloudinary si deseas).",
          variant: "default",
        });
      }

      const exchangePayload: ExchangePayload = {
        moneda_origen_id: data.exchangeData.fromCurrency,
        moneda_destino_id: data.exchangeData.toCurrency,
        monto_origen: montoOrigen,
        monto_destino: data.exchangeData.destinationAmount,
        tasa_cambio: rateValue,
        tipo_operacion: data.exchangeData.operationType as "COMPRA" | "VENTA",
        punto_atencion_id: selectedPoint.id,
        datos_cliente: data.customerData,
        divisas_entregadas: data.divisasEntregadas,
        divisas_recibidas: data.divisasRecibidas,
        observacion: data.exchangeData.observation || undefined,
        metodo_entrega: data.metodoEntrega,
        transferencia_numero:
          data.metodoEntrega === "transferencia"
            ? data.transferenciaNumero || ""
            : undefined,
        transferencia_banco:
          data.metodoEntrega === "transferencia"
            ? data.transferenciaBanco || ""
            : undefined,
        transferencia_imagen_url: transferenciaImagenUrl,
        // --- CAMPOS DE ABONO PARCIAL ---
        abono_inicial_monto: data.abonoInicialMonto ?? null,
        abono_inicial_fecha: data.abonoInicialFecha ?? null,
        saldo_pendiente: data.saldoPendiente ?? null,
        referencia_cambio_principal: data.referenciaCambioPrincipal ?? null,
      };

      const { exchange: createdExchange, error } =
        await exchangeService.createExchange(exchangePayload);

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
      console.error("Error al procesar cambio:", error);
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
    processExchange,
  };
};
